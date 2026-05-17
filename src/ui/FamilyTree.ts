/**
 * FamilyTree - Family tree visualization using family-chart
 */

import { createChart, Data, Datum, handlers } from 'family-chart';
import 'family-chart/styles/family-chart.css';
import { select, zoomTransform } from 'd3';
import { Squibble } from '../creatures/Squibble';
import { Gnawlin } from '../creatures/Gnawlin';
import { FontLoader } from '../utils/FontLoader';

// Union type for creatures that can be in the family tree
type Creature = Squibble | Gnawlin;

export class FamilyTree {
  /** Max generations up (ancestors) or down (descendants) from the focused creature */
  private static readonly MAX_TREE_DEPTH = 10;
  private static readonly DEBUG_TREE = false;
  /** Zoom limits — keep the tree readable without free exploration */
  private static readonly ZOOM_MIN = 0.85;
  private static readonly ZOOM_MAX = 1.35;
  /** How far past the tree bounds panning may go (fraction of viewport, capped) */
  private static readonly PAN_SLACK_RATIO = 0.1;
  private static readonly PAN_SLACK_MAX_PX = 90;

  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private chart: any = null; // Chart instance from family-chart
  private selectedCreature: Creature | null = null;
  private onCreatureSelect: ((creature: Creature) => void) | null = null;
  private allCreatures: Creature[] = [];
  private creatureMap: Map<number, Creature> = new Map(); // Map ID to Creature
  private linkObserver: MutationObserver | null = null;
  private chartAreaResizeObserver: ResizeObserver | null = null;
  private recenterOnMain = false;

  /**
   * Show the family tree for a selected creature (Squibble or Gnawlin)
   */
  show(
    selectedCreature: Creature,
    allSquibbles: Squibble[],
    allGnawlins: Gnawlin[],
    onCreatureSelect: (creature: Creature) => void
  ): void {
    if (this.isVisible) {
      this.hide();
    }

    this.selectedCreature = selectedCreature;
    // Combine all creatures
    this.allCreatures = [...allSquibbles, ...allGnawlins];
    this.onCreatureSelect = onCreatureSelect;
    this.isVisible = true;
    this.createOverlay();
    this.renderTree();
  }

  /**
   * Hide the family tree
   */
  hide(): void {
    this.isVisible = false;
    if (this.linkObserver) {
      this.linkObserver.disconnect();
      this.linkObserver = null;
    }
    if (this.chartAreaResizeObserver) {
      this.chartAreaResizeObserver.disconnect();
      this.chartAreaResizeObserver = null;
    }
    if (this.container) {
      document.body.removeChild(this.container);
      // Remove backdrop if it exists
      const backdrop = (this.container as any).backdrop;
      if (backdrop && backdrop.parentNode) {
        document.body.removeChild(backdrop);
      }
      this.container = null;
      this.chart = null;
    }
    // Also check for standalone backdrop
    const standaloneBackdrop = document.getElementById('family-tree-backdrop');
    if (standaloneBackdrop) {
      document.body.removeChild(standaloneBackdrop);
    }
  }

  /**
   * Check if the family tree is visible
   */
  isTreeVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Create the overlay container
   */
  private createOverlay(): void {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'family-tree-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      z-index: 10002;
    `;
    backdrop.onclick = () => this.hide();
    document.body.appendChild(backdrop);

    // Create centered modal container
    this.container = document.createElement('div');
    this.container.id = 'family-tree-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      height: 85vh;
      max-width: 1600px;
      max-height: 1200px;
      background: #0d0d1a;
      border: 2px solid #34495e;
      border-radius: 8px;
      z-index: 10003;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: '${FontLoader.getFontFamily()}', monospace;
      color: white;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 2px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; flex-direction: column; align-items: flex-start; flex: 1; min-width: 0;';

    const title = document.createElement('h2');
    title.textContent = 'Family Tree';
    title.style.cssText = 'margin: 0; color: #ecf0f1;';
    headerLeft.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.id = 'family-tree-subtitle';
    subtitle.style.cssText = 'margin: 8px 0 0 0; font-size: 12px; color: #95a5a6;';
    headerLeft.appendChild(subtitle);

    header.appendChild(headerLeft);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close (ESC)';
    closeBtn.style.cssText = `
      padding: 10px 20px;
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    `;
    closeBtn.onclick = () => this.hide();
    header.appendChild(closeBtn);

    this.container.appendChild(header);

    // Chart container
    const chartContainer = document.createElement('div');
    chartContainer.id = 'family-tree-chart';
    chartContainer.style.cssText = `
      flex: 1;
      overflow: visible;
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 400px;
    `;
    this.container.appendChild(chartContainer);

    document.body.appendChild(this.container);
    
    // Store backdrop reference for cleanup
    (this.container as any).backdrop = backdrop;

    // Inject CSS to ensure links are always visible
    const styleId = 'family-tree-link-fix';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* family-chart clips links when #f3Canvas uses overflow:hidden — allow paths to paint */
        #family-tree-chart #f3Canvas,
        #family-tree-chart #htmlSvg,
        #family-tree-chart svg.main_svg,
        #family-tree-chart svg.main_svg .view,
        #family-tree-chart svg.main_svg .links_view {
          overflow: visible !important;
        }
        #family-tree-chart svg path.link,
        #family-tree-chart svg line.link,
        #family-tree-chart svg .link {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          fill: none !important;
          stroke: #cbd5e1 !important;
          stroke-width: 2px !important;
          pointer-events: none;
        }
        #family-tree-chart svg path[class*="link"],
        #family-tree-chart svg line[class*="link"] {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
      `;
      document.head.appendChild(style);
    }

    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
        window.removeEventListener('keydown', escHandler);
      }
    };
    window.addEventListener('keydown', escHandler);
  }

  /**
   * Generate family tree data and render
   */
  private renderTree(): void {
    if (!this.container || !this.selectedCreature) return;

    const chartContainer = document.getElementById('family-tree-chart');
    if (!chartContainer) return;

    // Ensure the selected creature is in allCreatures for child lookup
    if (!this.allCreatures.find(c => c.id === this.selectedCreature!.id)) {
      this.allCreatures.push(this.selectedCreature);
    }

    // Build family tree data
    const data = this.buildFamilyTreeData(this.selectedCreature);

    const subtitleEl = document.getElementById('family-tree-subtitle');
    if (subtitleEl) {
      const sq = this.allCreatures.filter(c => !(c instanceof Gnawlin));
      const gn = this.allCreatures.filter(c => c instanceof Gnawlin);
      const alive = this.allCreatures.filter(c => c.alive).length;
      const focusLabel =
        this.selectedCreature instanceof Gnawlin
          ? `Gnawlin #${this.selectedCreature.id}`
          : `Squibble #${this.selectedCreature.id}`;
      subtitleEl.textContent = `${data.length} in this view · Centered on ${focusLabel} · Archive: ${sq.length} squibbles, ${gn.length} gnawlins (${alive} alive) · Limited pan/zoom`;
    }

    if (FamilyTree.DEBUG_TREE) {
      console.log('Family tree debug:', {
        rootId: this.selectedCreature.id,
        allCreaturesCount: this.allCreatures.length,
        dataLength: data.length,
      });
    }

    if (data.length === 0) {
      chartContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">
                      <p>No family tree data available (this creature has no known ancestors or descendants).</p>
                    </div>
      `;
      return;
    }

    // Clear container
    chartContainer.innerHTML = '';
    this.recenterOnMain = true;

    // Initialize family-chart
    try {
      if (FamilyTree.DEBUG_TREE) {
        console.log('Creating chart with data:', data);
      }

      this.chart = createChart(chartContainer, data);
      if (this.chart.store?.state) {
        this.chart.store.state.transition_time = 0;
      }

      // Set the main person (root creature) - center the tree on this creature
      this.chart.updateMainId(this.selectedCreature.id.toString());
      
      // Set up HTML card with custom rendering
      const cardHtml = this.chart.setCardHtml();
      
      // Set card dimensions to accommodate portrait and text
      cardHtml.setCardDim({
        width: 120,
        height: 140,
        text_x: 60, // Center text horizontally
        text_y: 100, // Position text below portrait
        img_width: 80,
        img_height: 80,
        img_x: 20, // Center image horizontally (120/2 - 80/2 = 20)
        img_y: 10, // Position image at top
      });
      
      // Set custom inner HTML creator for full control
      // This completely replaces the default card rendering
      cardHtml.setCardInnerHtmlCreator((d: any) => {
        const id = d.data?.id || d.id;
        if (!id) {
          console.warn('No ID found in card data:', d);
          return '';
        }

        if (d.data?.isPlaceholder) {
          return this.renderPlaceholderCard(d);
        }

        const creatureId = typeof id === 'string' ? parseInt(id, 10) : id;
        const creature = this.creatureMap.get(creatureId);
        if (!creature) {
          console.warn('Creature not found for ID:', creatureId);
          return this.renderMissingRecordCard(typeof id === 'string' ? id : String(id));
        }
        return this.renderCard(creature, d);
      });
      
      // Set click handler - clicking on a portrait shows their stats in a popup
      cardHtml.setOnCardClick((e: MouseEvent, d: any) => {
        const id = d.data?.id || d.id;
        if (!id || d.data?.isPlaceholder) {
          return;
        }

        const creatureId = typeof id === 'string' ? parseInt(id, 10) : id;
        const creature = this.creatureMap.get(creatureId);
        if (creature) {
          this.showStatsPopup(creature);
        }
      });

      if (FamilyTree.DEBUG_TREE) {
        console.log(
          'Family tree relationships:',
          data.map((datum) => ({
            id: datum.id,
            name: datum.data.name,
            parents: datum.rels.parents.length,
            children: datum.rels.children.length,
            spouses: datum.rels.spouses.length,
          }))
        );
      }

      const chartEl = chartContainer as HTMLElement;
      this.chart.afterUpdate = () => {
        if (this.recenterOnMain) {
          this.centerTreeOnMain(chartEl);
          this.recenterOnMain = false;
        }
        this.clampFamilyTreePanZoom(chartEl);
        this.syncFamilyTreeTransforms(chartEl);
        this.repairFamilyTreeLinks(chartEl);
        requestAnimationFrame(() => {
          if (!this.isVisible) return;
          this.syncFamilyTreeTransforms(chartEl);
          this.repairFamilyTreeLinks(chartEl);
        });
      };

      // initial:true runs treeFit and ignores main_to_middle — center via afterUpdate instead
      this.chart.updateTree({
        initial: false,
        tree_position: 'inherit',
        transition_time: 0,
      });

      if (this.chartAreaResizeObserver) {
        this.chartAreaResizeObserver.disconnect();
      }
      this.chartAreaResizeObserver = new ResizeObserver(() => {
        if (!this.isVisible) return;
        this.clampFamilyTreePanZoom(chartEl);
        this.syncFamilyTreeTransforms(chartEl);
        this.repairFamilyTreeLinks(chartEl);
      });
      this.chartAreaResizeObserver.observe(chartEl);

      const onChartActivity = () => {
        this.syncFamilyTreeTransforms(chartEl);
        this.repairFamilyTreeLinks(chartEl);
      };
      onChartActivity();
      setTimeout(onChartActivity, 50);
      setTimeout(onChartActivity, 200);

      const f3Canvas = chartContainer.querySelector('#f3Canvas');
      if (f3Canvas) {
        f3Canvas.addEventListener('wheel', onChartActivity, { passive: true });
        f3Canvas.addEventListener('pointerup', onChartActivity);
        f3Canvas.addEventListener('pointercancel', onChartActivity);
      }

      const svg = this.chart.svg;
      if (svg) {
        const viewGroup = svg.querySelector('.view');
        if (viewGroup) {
          if (this.linkObserver) this.linkObserver.disconnect();
          this.linkObserver = new MutationObserver(() => {
            onChartActivity();
          });
          this.linkObserver.observe(viewGroup, {
            attributes: true,
            attributeFilter: ['transform', 'style', 'd'],
            subtree: true,
            childList: true,
          });
        }
      }
    } catch (error) {
      console.error('Error rendering family tree:', error);
      chartContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #e74c3c;">
          <p>Error rendering family tree. Check console for details.</p>
        </div>
      `;
    }
  }

  /**
   * Center the viewport on the focused creature (family-chart main id).
   */
  private centerTreeOnMain(chartContainer: HTMLElement): void {
    if (!this.chart?.svg || !this.selectedCreature) return;

    const store = this.chart.store as {
      getTreeMainDatum?: () => { x: number; y: number };
      getTree?: () => { data?: Array<{ x: number; y: number; data?: { id?: string } }> } | null;
    } | undefined;

    let mainDatum: { x: number; y: number } | undefined;
    try {
      mainDatum = store?.getTreeMainDatum?.();
    } catch {
      const focusId = this.selectedCreature.id.toString();
      mainDatum = store
        ?.getTree?.()
        ?.data?.find((d) => d.data?.id === focusId || String(d.data?.id) === focusId);
    }
    if (!mainDatum || typeof mainDatum.x !== 'number' || typeof mainDatum.y !== 'number') {
      return;
    }

    const f3El = chartContainer.querySelector('#f3Canvas') as HTMLElement | null;
    const svgDim = (f3El ?? chartContainer).getBoundingClientRect();
    handlers.cardToMiddle({
      datum: mainDatum,
      svg: this.chart.svg,
      svg_dim: svgDim,
      scale: 1,
      transition_time: 0,
    });
  }

  /**
   * Keep HTML cards and SVG links on the same pan/zoom transform (clamp can desync them).
   */
  private syncFamilyTreeTransforms(chartContainer: HTMLElement): void {
    const f3El = chartContainer.querySelector('#f3Canvas') as HTMLElement | null;
    if (!f3El) return;
    const t = zoomTransform(f3El);
    const transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
    const svgView = chartContainer.querySelector('svg .view') as HTMLElement | null;
    const htmlView = chartContainer.querySelector('#htmlSvg .cards_view') as HTMLElement | null;
    if (svgView) svgView.style.transform = transform;
    if (htmlView) htmlView.style.transform = transform;
  }

  /**
   * Unclip link layers and force connector paths visible (family-chart transitions often leave opacity 0).
   */
  private repairFamilyTreeLinks(chartContainer: HTMLElement): void {
    const f3 = chartContainer.querySelector('#f3Canvas') as HTMLElement | null;
    const htmlLayer = chartContainer.querySelector('#htmlSvg') as HTMLElement | null;
    const mainSvg = chartContainer.querySelector('svg.main_svg') as SVGSVGElement | null;
    const view = chartContainer.querySelector('svg .view') as SVGGElement | null;
    const linksView = chartContainer.querySelector('svg .links_view') as SVGGElement | null;

    for (const el of [f3, htmlLayer, mainSvg, view, linksView]) {
      if (el) el.style.setProperty('overflow', 'visible', 'important');
    }

    const svg = this.chart?.svg as SVGSVGElement | undefined;
    if (!svg) return;

    const links = svg.querySelectorAll('.links_view path.link, path.link');
    links.forEach((link) => {
      const el = link as SVGPathElement;
      el.style.opacity = '1';
      el.style.visibility = 'visible';
      el.style.display = 'block';
      el.setAttribute('fill', 'none');
      if (!el.getAttribute('stroke') || el.getAttribute('stroke') === 'none') {
        el.setAttribute('stroke', '#cbd5e1');
      }
      if (!el.getAttribute('stroke-width') || el.getAttribute('stroke-width') === '0') {
        el.setAttribute('stroke-width', '2');
      }
    });
  }

  /**
   * Clip the chart to the modal panel and constrain d3 zoom so the tree cannot be panned away.
   * Uses layout node positions from family-chart (final x/y), matching setCardDim card size.
   */
  private clampFamilyTreePanZoom(chartContainer: HTMLElement): void {
    const chart = this.chart as {
      store?: { getTree?: () => { data?: Array<{ x?: number; y?: number }> } | null };
    };
    const tree = chart?.store?.getTree?.();
    const nodes = tree?.data;
    if (!nodes?.length) return;

    const cardW = 120;
    const cardH = 140;
    const pad = 180;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const d of nodes) {
      if (typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      minX = Math.min(minX, d.x);
      minY = Math.min(minY, d.y);
      maxX = Math.max(maxX, d.x + cardW);
      maxY = Math.max(maxY, d.y + cardH);
    }
    if (!Number.isFinite(minX)) return;

    const f3El = chartContainer.querySelector('#f3Canvas') as HTMLElement & {
      __zoomObj?: {
        extent: (e: [[number, number], [number, number]]) => unknown;
        translateExtent: (e: [[number, number], [number, number]]) => unknown;
        scaleExtent: (e: [number, number]) => unknown;
        translateBy: (selection: unknown, dx: number, dy: number) => void;
      };
    };
    const zoom = f3El.__zoomObj;
    if (!f3El || !zoom) return;

    const w = Math.max(1, f3El.clientWidth);
    const h = Math.max(1, f3El.clientHeight);

    const k = Math.max(zoomTransform(f3El).k, 1e-6);
    // Viewport size in chart/world space — translateExtent must be at least this wide/tall or d3
    // clamps all panning (see defaultConstrain in d3-zoom).
    const vw = w / k;
    const vh = h / k;

    zoom.extent([
      [0, 0],
      [w, h],
    ]);
    zoom.scaleExtent([FamilyTree.ZOOM_MIN, FamilyTree.ZOOM_MAX]);

    let tx0 = minX - pad;
    let tx1 = maxX + pad;
    let ty0 = minY - pad;
    let ty1 = maxY + pad;
    const bw = tx1 - tx0;
    const bh = ty1 - ty0;
    if (bw < vw) {
      const cx = (tx0 + tx1) / 2;
      tx0 = cx - vw / 2;
      tx1 = cx + vw / 2;
    }
    if (bh < vh) {
      const cy = (ty0 + ty1) / 2;
      ty0 = cy - vh / 2;
      ty1 = cy + vh / 2;
    }
    // Small slack: slight pan only, still clipped by the modal
    const slackX = Math.min(vw * FamilyTree.PAN_SLACK_RATIO, FamilyTree.PAN_SLACK_MAX_PX);
    const slackY = Math.min(vh * FamilyTree.PAN_SLACK_RATIO, FamilyTree.PAN_SLACK_MAX_PX);
    zoom.translateExtent([
      [tx0 - slackX, ty0 - slackY],
      [tx1 + slackX, ty1 + slackY],
    ]);

    select(f3El).call(zoom.translateBy, 0, 0);
    this.syncFamilyTreeTransforms(chartContainer);
  }

  /**
   * Build family tree data structure in family-chart format
   * Uses IDs to track parent/child relationships
   */
  private buildFamilyTreeData(rootCreature: Creature): Data {
    const data: Data = [];
    const visited = new Set<number>(); // Track visited creature IDs
    const placeholderIds = new Set<string>();
    this.creatureMap.clear();

    // Create a map of all creatures by ID for quick lookup
    // Always include the root creature, even if it's not in allCreatures
    const creatureById = new Map<number, Creature>();
    creatureById.set(rootCreature.id, rootCreature); // Ensure root is always included
    for (const creature of this.allCreatures) {
      creatureById.set(creature.id, creature);
    }

    const ensureMissingParentRecord = (rawParentId: number, childIsGnawlin: boolean): string => {
      const nodeId = `m${rawParentId}`;
      if (placeholderIds.has(nodeId)) return nodeId;
      placeholderIds.add(nodeId);
      const portraitUrl = this.generateUnknownParentPortrait(childIsGnawlin ? 'Gnawlin' : 'Squibble');
      data.push({
        id: nodeId,
        data: {
          id: nodeId,
          gender: 'M',
          name: `Parent not in archive (#${rawParentId})`,
          isDead: true,
          portrait: portraitUrl,
          isPlaceholder: true,
        },
        rels: {
          parents: [],
          spouses: [],
          children: [],
        },
      });
      return nodeId;
    };

    const resolveParentNode = (rawParentId: number, depth: number, childIsGnawlin: boolean): string | null => {
      const parent = creatureById.get(rawParentId);
      const usable = parent && (parent instanceof Gnawlin) === childIsGnawlin;
      if (usable) {
        return addCreature(rawParentId, depth + 1);
      }
      if (depth + 1 > FamilyTree.MAX_TREE_DEPTH) {
        return null;
      }
      return ensureMissingParentRecord(rawParentId, childIsGnawlin);
    };

    // Recursive function to add creature and ancestors (using IDs)
    const addCreature = (creatureId: number, depth: number = 0): string | null => {
      if (depth > FamilyTree.MAX_TREE_DEPTH) return null;
      if (visited.has(creatureId)) return creatureId.toString();

      const creature = creatureById.get(creatureId);
      if (!creature) return null; // Creature not found (may have been removed)

      visited.add(creatureId);
      this.creatureMap.set(creatureId, creature);

      const nodeId = creatureId.toString();
      const parents: string[] = [];
      const children: string[] = [];
      const spouses: string[] = [];

      // Add parents using IDs (only same species); stub missing references so the chart stays connected
      const isGnawlin = creature instanceof Gnawlin;
      if (creature.parent1Id !== null) {
        const parentId = resolveParentNode(creature.parent1Id, depth, isGnawlin);
        if (parentId) {
          parents.push(parentId);
        }
      }
      if (creature.parent2Id !== null) {
        const parentId = resolveParentNode(creature.parent2Id, depth, isGnawlin);
        if (parentId && !parents.includes(parentId)) {
          parents.push(parentId);
        }
      }

      // Add mates to spouses array (only same species)
      // Note: Reciprocal relationships will be added when the mate's node is processed
      for (const mateId of creature.mateIds) {
        if (mateId === creature.parent1Id || mateId === creature.parent2Id) continue;
        const mate = creatureById.get(mateId);
        // Only add mate if it's the same species
        if (mate && (mate instanceof Gnawlin) === isGnawlin) {
          const mateNodeId = addCreature(mateId, depth);
          if (mateNodeId && !spouses.includes(mateNodeId)) {
            spouses.push(mateNodeId);
          }
        }
      }

      // Generate portrait URL for this creature
      const portraitUrl = this.generatePortraitUrl(creature);
      
      // Determine creature type and name
      const creatureType = creature instanceof Gnawlin ? 'Gnawlin' : 'Squibble';
      const creatureName = `${creatureType} #${creature.id}`;
      
      // Create datum
      const datum: Datum = {
        id: nodeId,
        data: {
          gender: creature.gender === 'male' ? 'M' : 'F',
          name: creatureName,
          isDead: !creature.alive,
          portrait: portraitUrl, // Add portrait URL to data
          creature: creature, // Store reference for click handler
        },
        rels: {
          parents,
          spouses,
          children,
        },
      };

      data.push(datum);
      for (const pId of parents) {
        const pDatum = data.find((d) => d.id === pId);
        if (pDatum && !pDatum.rels.children.includes(nodeId)) {
          pDatum.rels.children.push(nodeId);
        }
      }
      return nodeId;
    };

    // Start from root
    addCreature(rootCreature.id);

    // Add descendants (children) using IDs and update parent-child relationships
    // Only track children of the same species
    const addChildren = (creatureId: number, depthFromRoot: number = 0) => {
      if (depthFromRoot > FamilyTree.MAX_TREE_DEPTH) return;

      const creature = creatureById.get(creatureId);
      if (!creature) return;

      const isGnawlin = creature instanceof Gnawlin;

      for (const other of this.allCreatures) {
        // Check if this creature is a parent of 'other' using IDs
        // Only if they're the same species
        if (
          (other.parent1Id === creatureId || other.parent2Id === creatureId) &&
          !visited.has(other.id) &&
          (other instanceof Gnawlin) === isGnawlin
        ) {
          const childId = addCreature(other.id, 0);
          if (childId) {
            // Find parent's datum and add child
            const parentDatum = data.find((d) => d.id === creatureId.toString());
            if (parentDatum && !parentDatum.rels.children.includes(childId)) {
              parentDatum.rels.children.push(childId);
            }
          }
          addChildren(other.id, depthFromRoot + 1); // Recursively add grandchildren
        }
      }
    };

    addChildren(rootCreature.id);

    // Siblings share at least one parent — include them once, linked only through parents' children.
    let expandedSiblings = true;
    while (expandedSiblings) {
      expandedSiblings = false;
      for (const datum of [...data]) {
        if (datum.data?.isPlaceholder) continue;
        const creatureId = parseInt(datum.id, 10);
        if (Number.isNaN(creatureId)) continue;
        const creature = creatureById.get(creatureId);
        if (!creature) continue;
        if (creature.parent1Id === null && creature.parent2Id === null) continue;

        const isGnawlin = creature instanceof Gnawlin;

        for (const other of this.allCreatures) {
          if (other.id === creatureId) continue;
          if ((other instanceof Gnawlin) !== isGnawlin) continue;

          const shareParent =
            (creature.parent1Id !== null &&
              (other.parent1Id === creature.parent1Id || other.parent2Id === creature.parent1Id)) ||
            (creature.parent2Id !== null &&
              (other.parent1Id === creature.parent2Id || other.parent2Id === creature.parent2Id));

          if (shareParent && !visited.has(other.id)) {
            addCreature(other.id, 0);
            addChildren(other.id);
            expandedSiblings = true;
          }
        }
      }
    }

    this.ensureParentChildLinksForSiblings(data, creatureById);

    // Ensure all mate relationships are reciprocal (mates only — not siblings)
    for (const datum of data) {
      for (const spouseId of datum.rels.spouses) {
        const spouseDatum = data.find((d) => d.id === spouseId);
        if (spouseDatum && !spouseDatum.rels.spouses.includes(datum.id)) {
          spouseDatum.rels.spouses.push(datum.id);
        }
      }
    }

    this.removeSiblingSpouseLinks(data, creatureById);

    return data;
  }

  /** Siblings appear once, as co-children on shared parent nodes (no horizontal sibling edges). */
  private ensureParentChildLinksForSiblings(
    data: Data,
    creatureById: Map<number, Creature>
  ): void {
    const creaturesShareParent = (a: Creature, b: Creature): boolean => {
      if (a.parent1Id === null && a.parent2Id === null) return false;
      return (
        (a.parent1Id !== null &&
          (b.parent1Id === a.parent1Id || b.parent2Id === a.parent1Id)) ||
        (a.parent2Id !== null &&
          (b.parent1Id === a.parent2Id || b.parent2Id === a.parent2Id))
      );
    };

    for (const datum of data) {
      if (datum.data?.isPlaceholder) continue;
      const creatureId = parseInt(datum.id, 10);
      if (Number.isNaN(creatureId)) continue;
      const creature = creatureById.get(creatureId);
      if (!creature) continue;

      for (const other of this.allCreatures) {
        if (other.id === creatureId) continue;
        if (other instanceof Gnawlin !== creature instanceof Gnawlin) continue;
        if (!creaturesShareParent(creature, other)) continue;

        const childId = other.id.toString();
        const childDatum = data.find((d) => d.id === childId);
        if (!childDatum) continue;

        for (const parentId of [creature.parent1Id, creature.parent2Id]) {
          if (parentId === null) continue;
          const parentDatum = data.find((d) => d.id === parentId.toString());
          if (parentDatum && !parentDatum.rels.children.includes(childId)) {
            parentDatum.rels.children.push(childId);
          }
        }
        for (const parentId of [other.parent1Id, other.parent2Id]) {
          if (parentId === null) continue;
          const parentDatum = data.find((d) => d.id === parentId.toString());
          if (parentDatum && !parentDatum.rels.children.includes(datum.id)) {
            parentDatum.rels.children.push(datum.id);
          }
        }
      }
    }
  }

  private removeSiblingSpouseLinks(data: Data, creatureById: Map<number, Creature>): void {
    const areSiblings = (idA: string, idB: string): boolean => {
      const aId = parseInt(idA, 10);
      const bId = parseInt(idB, 10);
      if (Number.isNaN(aId) || Number.isNaN(bId)) return false;
      const a = creatureById.get(aId);
      const b = creatureById.get(bId);
      if (!a || !b) return false;
      if (a instanceof Gnawlin !== b instanceof Gnawlin) return false;
      return (
        (a.parent1Id !== null &&
          (b.parent1Id === a.parent1Id || b.parent2Id === a.parent1Id)) ||
        (a.parent2Id !== null &&
          (b.parent1Id === a.parent2Id || b.parent2Id === a.parent2Id))
      );
    };

    for (const datum of data) {
      datum.rels.spouses = datum.rels.spouses.filter((spouseId) => !areSiblings(datum.id, spouseId));
    }
  }

  private generateUnknownParentPortrait(species: 'Gnawlin' | 'Squibble'): string {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(0, 0, 80, 80);
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 2;
      if (species === 'Gnawlin') {
        ctx.strokeRect(20, 20, 40, 40);
      } else {
        ctx.beginPath();
        ctx.arc(40, 40, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#bdc3c7';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 40, 40);
    }
    return canvas.toDataURL();
  }

  private renderPlaceholderCard(d: any): string {
    const name = d.data?.name ?? 'Unknown parent';
    const portraitUrl = d.data?.portrait ?? '';
    return `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background: #2a2a32;
        border: 2px dashed #7f8c8d;
        border-radius: 8px;
        padding: 8px;
        box-sizing: border-box;
      ">
        <img src="${portraitUrl}" alt="" style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin-bottom: 8px;
          display: block;
          object-fit: cover;
        " />
        <div style="
          font-size: 10px;
          text-align: center;
          color: #bdc3c7;
          font-weight: bold;
          font-family: '${FontLoader.getFontFamily()}', monospace;
        ">
          ${name}
        </div>
        <div style="
          font-size: 9px;
          text-align: center;
          color: #7f8c8d;
          font-family: '${FontLoader.getFontFamily()}', monospace;
        ">
          Not in archive
        </div>
      </div>
    `;
  }

  private renderMissingRecordCard(nodeId: string): string {
    return `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #2c2c2c;
        border: 2px solid #c0392b;
        border-radius: 8px;
        padding: 8px;
        box-sizing: border-box;
      ">
        <div style="font-size: 11px; color: #ecf0f1; text-align: center; font-family: '${FontLoader.getFontFamily()}', monospace;">
          Missing record
        </div>
        <div style="font-size: 9px; color: #95a5a6; margin-top: 4px;">${nodeId}</div>
      </div>
    `;
  }

  /**
   * Generate a portrait URL (data URL) for a creature
   * Creates a simple colored circle for Squibbles, square for Gnawlins
   */
  private generatePortraitUrl(creature: Creature): string {
    const color = creature.color;
    const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    const isDead = !creature.alive;
    const opacity = isDead ? 0.5 : 1.0;
    const isGnawlin = creature instanceof Gnawlin;

    // Generate portrait
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = rgb;
      ctx.globalAlpha = opacity;
      
      if (isGnawlin) {
        // Draw square for Gnawlins
        const size = 50;
        ctx.fillRect(40 - size/2, 40 - size/2, size, size);
      } else {
        // Draw circle for Squibbles
        ctx.beginPath();
        ctx.arc(40, 40, 35, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Add ID text in the center (white text for visibility)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${creature.id}`, 40, 40);
    }

    return canvas.toDataURL();
  }

  /**
   * Render a card with portrait and ID
   * This function is called by family-chart to create the inner HTML for each card
   * Renders a simple colored circle for Squibbles, square for Gnawlins
   * (Eventually this will be updated when visual traits are implemented)
   */
  private renderCard(creature: Creature, datum: any): string {
    const stats = creature.getStats();
    const isDead = !creature.alive;
    const isGnawlin = creature instanceof Gnawlin;
    const creatureType = isGnawlin ? 'Gnawlin' : 'Squibble';
    
    // Get portrait URL from datum data (already generated)
    const portraitUrl = datum.data?.portrait || this.generatePortraitUrl(creature);
    const grayscale = isDead ? 'filter: grayscale(100%);' : '';

    // Return HTML that will be inserted into the card
    // Using img tag with the canvas-generated data URL for reliable rendering
    return `
      <div style="
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        background: ${isDead ? '#2c2c2c' : '#34495e'};
        border: 2px solid ${isDead ? '#555' : '#3498db'};
        border-radius: 8px;
        padding: 8px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ${grayscale}
      " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.5)';" 
         onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.3)';">
        <img src="${portraitUrl}" alt="${creatureType} #${creature.id}" style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid ${isDead ? '#666' : '#ecf0f1'};
          margin-bottom: 8px;
          display: block;
          object-fit: cover;
          ${grayscale}
        " />
        <div style="
          font-size: 11px;
          text-align: center;
          color: ${isDead ? '#999' : '#ecf0f1'};
          font-weight: bold;
          font-family: '${FontLoader.getFontFamily()}', monospace;
          margin-bottom: 2px;
        ">
          ${creatureType} #${creature.id}
        </div>
        <div style="
          font-size: 9px;
          text-align: center;
          color: ${isDead ? '#666' : '#95a5a6'};
          font-family: '${FontLoader.getFontFamily()}', monospace;
        ">
          ${isDead ? 'Deceased' : `Age: ${stats.age.toFixed(1)}s`}
        </div>
      </div>
    `;
  }

  /**
   * Show a popup window with squibble stats
   */
  private showStatsPopup(creature: Creature): void {
    // Remove existing popup if any
    const existingPopup = document.getElementById('creature-stats-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    const stats = creature.getStats();
    const isGnawlin = creature instanceof Gnawlin;
    const creatureType = isGnawlin ? 'Gnawlin' : 'Squibble';
    const popup = document.createElement('div');
    popup.id = 'creature-stats-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 80vh;
      background: #2c3e50;
      border: 2px solid #3498db;
      border-radius: 8px;
      padding: 20px;
      z-index: 10003;
      color: white;
      font-family: '${FontLoader.getFontFamily()}', monospace;
      overflow-y: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    // Header with close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #34495e;
    `;
    
    const title = document.createElement('h3');
    title.textContent = `${creatureType} #${creature.id}`;
    title.style.cssText = 'margin: 0; color: #ecf0f1;';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: #e74c3c;
      color: white;
      border: none;
      border-radius: 4px;
      width: 30px;
      height: 30px;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      font-family: inherit;
    `;
    closeBtn.onclick = () => {
      popup.remove();
      const backdrop = document.getElementById('creature-stats-backdrop');
      if (backdrop) backdrop.remove();
    };
    header.appendChild(closeBtn);
    popup.appendChild(header);

    // Stats content
    const content = document.createElement('div');
    content.style.cssText = 'font-size: 14px; line-height: 1.6;';

    // Basic Info
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Basic Info:</strong><br>`;
    content.innerHTML += `Gender: ${stats.gender === 'male' ? 'Male' : 'Female'}<br>`;
    content.innerHTML += `Age: ${stats.age.toFixed(1)}s / ${stats.max_age.toFixed(1)}s<br>`;
    content.innerHTML += `Alive: ${stats.alive ? 'Yes' : 'No'}<br></div>`;

    // Health Stats
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Health:</strong><br>`;
    content.innerHTML += `Health: ${stats.health.toFixed(1)} / ${stats.max_health.toFixed(1)} HP<br>`;
    content.innerHTML += `Health: ${stats.health_percentage.toFixed(1)}%<br>`;
    content.innerHTML += `Hunger: ${stats.hunger.toFixed(1)} / ${stats.hunger_capacity.toFixed(1)}<br>`;
    content.innerHTML += `Thirst: ${stats.thirst.toFixed(1)} / ${stats.thirst_capacity.toFixed(1)}<br></div>`;

    // Traits
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Traits:</strong><br>`;
    content.innerHTML += `Speed: ${stats.speed.toFixed(2)}<br>`;
    content.innerHTML += `Vision: ${stats.vision.toFixed(1)}<br>`;
    content.innerHTML += `Size: ${stats.size.toFixed(2)}<br>`;
    content.innerHTML += `Intelligence: ${stats.intelligence.toFixed(2)}<br>`;
    content.innerHTML += `Swim: ${stats.swim.toFixed(2)}<br>`;
    content.innerHTML += `Metabolism: ${stats.metabolism.toFixed(2)}<br>`;
    content.innerHTML += `Damage Resistance: ${stats.damage_resistance.toFixed(2)}<br>`;
    content.innerHTML += `Aggressiveness: ${stats.aggressiveness.toFixed(2)}<br>`;
    content.innerHTML += `Damage: ${stats.damage.toFixed(1)}<br>`;
    content.innerHTML += `Combat speed: ${(stats as any).combat_speed != null ? (stats as any).combat_speed.toFixed(2) : '1.00'}×<br></div>`;

    // Breeding
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Breeding:</strong><br>`;
    if (!isGnawlin && 'attractiveness' in stats) {
      content.innerHTML += `Attractiveness: ${(stats as any).attractiveness.toFixed(2)}<br>`;
      content.innerHTML += `Min Attractiveness: ${(stats as any).min_attractiveness.toFixed(2)}<br>`;
    }
    content.innerHTML += `Virility: ${stats.virility.toFixed(2)}<br>`;
    content.innerHTML += `Cooldown: ${stats.breeding_cooldown > 0 ? `${stats.breeding_cooldown.toFixed(1)}s` : 'Ready'}<br>`;
    content.innerHTML += `Pregnant: ${stats.is_pregnant ? 'Yes' : 'No'}<br>`;
    if (stats.is_pregnant) {
      content.innerHTML += `Pregnancy Progress: ${(stats.pregnancy_progress * 100).toFixed(1)}%<br>`;
      content.innerHTML += `Time Remaining: ${stats.pregnancy_time_remaining.toFixed(1)}s<br>`;
    }
    content.innerHTML += `Litter Size: ${stats.litter_size.toFixed(1)} (avg)<br>`;
    content.innerHTML += `Gestation: ${stats.gestation_duration.toFixed(1)}s<br>`;
    content.innerHTML += `Multi-baby Pregnancies: ${stats.multi_baby_pregnancies}<br></div>`;

    // Status
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Status:</strong><br>`;
    content.innerHTML += `Seeking Food: ${stats.seeking_food ? 'Yes' : 'No'}<br>`;
    content.innerHTML += `Seeking Mate: ${stats.seeking_mate ? 'Yes' : 'No'}<br>`;
    if (stats.wet_timer > 0) {
      content.innerHTML += `Wet: ${stats.wet_timer.toFixed(1)}s remaining<br>`;
    }
    content.innerHTML += `</div>`;

    // Visual Traits
    content.innerHTML += `<div style="margin-bottom: 15px;"><strong style="color: #3498db;">Appearance:</strong><br>`;
    content.innerHTML += `Horns: ${stats.horn_style}<br>`;
    content.innerHTML += `Eyes: ${stats.eye_type}<br>`;
    content.innerHTML += `Ears: ${stats.ear_type}<br>`;
    content.innerHTML += `Tail: ${stats.tail_type}<br>`;
    content.innerHTML += `Pattern: ${stats.pattern_type}<br>`;
    content.innerHTML += `Body: ${stats.body_shape}<br></div>`;

    popup.appendChild(content);

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'creature-stats-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10002;
    `;
    backdrop.onclick = () => {
      popup.remove();
      backdrop.remove();
    };
    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    // Close on ESC key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.getElementById('creature-stats-popup')) {
        popup.remove();
        backdrop.remove();
        window.removeEventListener('keydown', escHandler);
      }
    };
    window.addEventListener('keydown', escHandler);
  }
}
