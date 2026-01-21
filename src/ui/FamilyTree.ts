/**
 * FamilyTree - Family tree visualization using family-chart
 */

import { createChart, Data, Datum } from 'family-chart';
import 'family-chart/styles/family-chart.css';
import { Squibble } from '../creatures/Squibble';
import { Gnawlin } from '../creatures/Gnawlin';
import { FontLoader } from '../utils/FontLoader';

// Union type for creatures that can be in the family tree
type Creature = Squibble | Gnawlin;

export class FamilyTree {
  private container: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private chart: any = null; // Chart instance from family-chart
  private selectedCreature: Creature | null = null;
  private onCreatureSelect: ((creature: Creature) => void) | null = null;
  private allCreatures: Creature[] = [];
  private creatureMap: Map<number, Creature> = new Map(); // Map ID to Creature

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

    const title = document.createElement('h2');
    title.textContent = 'Family Tree';
    title.style.cssText = 'margin: 0; color: #ecf0f1;';
    header.appendChild(title);

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
      overflow: hidden;
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
        #family-tree-chart svg path.link,
        #family-tree-chart svg line.link,
        #family-tree-chart svg .link {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          stroke: #ffffff !important;
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
    
                console.log('Family tree debug:', {
                  rootId: this.selectedCreature.id,
                  allCreaturesCount: this.allCreatures.length,
                  dataLength: data.length,
                  hasParents: this.selectedCreature.parent1Id !== null || this.selectedCreature.parent2Id !== null,
                  childrenCount: this.allCreatures.filter(c => c.parent1Id === this.selectedCreature!.id || c.parent2Id === this.selectedCreature!.id).length
                });
    
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

    // Initialize family-chart
    try {
      console.log('Creating chart with data:', data);
      console.log('Chart container:', chartContainer, 'Dimensions:', chartContainer.offsetWidth, chartContainer.offsetHeight);
      
      this.chart = createChart(chartContainer, data);
      console.log('Chart created:', this.chart);
      console.log('Chart container after creation:', chartContainer.innerHTML.substring(0, 200));
      
      // Set the main person (root creature) - center the tree on this creature
      this.chart.updateMainId(this.selectedCreature.id.toString());
      console.log('Main ID set to:', this.selectedCreature.id.toString());
      
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
        // TreeDatum has data.id, not d.id directly
        const id = d.data?.id || d.id;
        if (!id) {
          console.warn('No ID found in card data:', d);
          return '';
        }
        
        const creatureId = typeof id === 'string' ? parseInt(id) : id;
        const creature = this.creatureMap.get(creatureId);
        if (!creature) {
          console.warn('Creature not found for ID:', creatureId, 'Available IDs:', Array.from(this.creatureMap.keys()));
          return '';
        }
        return this.renderCard(creature, d);
      });
      
      // Set click handler - clicking on a portrait shows their stats in a popup
      cardHtml.setOnCardClick((e: MouseEvent, d: any) => {
        // TreeDatum has data.id, not d.id directly
        const id = d.data?.id || d.id;
        if (!id) {
          console.warn('No ID found in clicked card:', d);
          return;
        }
        
        const creatureId = typeof id === 'string' ? parseInt(id) : id;
        const creature = this.creatureMap.get(creatureId);
        if (creature) {
          this.showStatsPopup(creature);
        }
      });
      
      // Log relationship data for debugging
      console.log('Family tree relationships:', data.map(d => ({
        id: d.id,
        name: d.data.name,
        parents: d.rels.parents.length,
        children: d.rels.children.length,
        spouses: d.rels.spouses.length,
        spousesIds: d.rels.spouses
      })));
      
      // Update the tree (center on the root creature)
      console.log('Updating tree...');
      this.chart.updateTree({ 
        initial: true,
        tree_position: 'main_to_middle'
      });
      console.log('Tree updated');
      
      // Set up monitoring to ensure lines stay visible during pan/zoom
      // This fixes the issue where lines disappear when dragging
      const ensureLinksVisible = () => {
        if (!this.chart || !this.chart.svg) return;
        
        // Find all link elements (paths and lines connecting nodes)
        const links = this.chart.svg.querySelectorAll('path.link, line.link, .link, path[class*="link"], line[class*="link"]');
        links.forEach((link: any) => {
          // Ensure links are visible and have proper styling
          if (link.style) {
            link.style.display = '';
            link.style.opacity = '1';
            link.style.visibility = 'visible';
            // Ensure stroke is visible
            if (!link.getAttribute('stroke') || link.getAttribute('stroke') === 'none') {
              link.setAttribute('stroke', '#ffffff');
            }
            if (!link.getAttribute('stroke-width') || link.getAttribute('stroke-width') === '0') {
              link.setAttribute('stroke-width', '2');
            }
          }
        });
      };
      
      // Ensure links are visible after initial render
      setTimeout(ensureLinksVisible, 100);
      
      // Monitor for pan/zoom events and ensure links stay visible
      const svg = this.chart.svg;
      if (svg) {
        // Listen for mouse events that might trigger pan/zoom
        let isDragging = false;
        svg.addEventListener('mousedown', () => {
          isDragging = true;
        });
        svg.addEventListener('mousemove', () => {
          if (isDragging) {
            ensureLinksVisible();
          }
        });
        svg.addEventListener('mouseup', () => {
          isDragging = false;
          ensureLinksVisible();
        });
        
        // Also monitor for transform changes (zoom/pan)
        const viewGroup = svg.querySelector('.view') || svg;
        if (viewGroup) {
          const observer = new MutationObserver(() => {
            ensureLinksVisible();
          });
          
          observer.observe(viewGroup, {
            attributes: true,
            attributeFilter: ['transform', 'style'],
            subtree: true
          });
          
          // Also observe the SVG itself for any changes
          observer.observe(svg, {
            childList: true,
            subtree: true
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
   * Build family tree data structure in family-chart format
   * Uses IDs to track parent/child relationships
   */
  private buildFamilyTreeData(rootCreature: Creature): Data {
    const data: Data = [];
    const visited = new Set<number>(); // Track visited creature IDs
    this.creatureMap.clear();

    // Create a map of all creatures by ID for quick lookup
    // Always include the root creature, even if it's not in allCreatures
    const creatureById = new Map<number, Creature>();
    creatureById.set(rootCreature.id, rootCreature); // Ensure root is always included
    for (const creature of this.allCreatures) {
      creatureById.set(creature.id, creature);
    }

    // Recursive function to add creature and ancestors (using IDs)
    const addCreature = (creatureId: number, depth: number = 0): string | null => {
      if (depth > 5) return null; // Limit depth to prevent infinite recursion
      if (visited.has(creatureId)) return creatureId.toString();

      const creature = creatureById.get(creatureId);
      if (!creature) return null; // Creature not found (may have been removed)

      visited.add(creatureId);
      this.creatureMap.set(creatureId, creature);

      const nodeId = creatureId.toString();
      const parents: string[] = [];
      const children: string[] = [];
      const spouses: string[] = [];

      // Add parents using IDs (only same species)
      const isGnawlin = creature instanceof Gnawlin;
      if (creature.parent1Id !== null) {
        const parent = creatureById.get(creature.parent1Id);
        // Only add parent if it's the same species
        if (parent && (parent instanceof Gnawlin) === isGnawlin) {
          const parentId = addCreature(creature.parent1Id, depth + 1);
          if (parentId) {
            parents.push(parentId);
          }
        }
      }
      if (creature.parent2Id !== null) {
        const parent = creatureById.get(creature.parent2Id);
        // Only add parent if it's the same species
        if (parent && (parent instanceof Gnawlin) === isGnawlin) {
          const parentId = addCreature(creature.parent2Id, depth + 1);
          if (parentId && !parents.includes(parentId)) {
            parents.push(parentId);
          }
        }
      }

      // Add mates to spouses array (only same species)
      // Note: Reciprocal relationships will be added when the mate's node is processed
      for (const mateId of creature.mateIds) {
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
      return nodeId;
    };

    // Start from root
    addCreature(rootCreature.id);

    // Add descendants (children) using IDs and update parent-child relationships
    // Only track children of the same species
    const addChildren = (creatureId: number) => {
      const creature = creatureById.get(creatureId);
      if (!creature) return;
      
      const isGnawlin = creature instanceof Gnawlin;
      
      for (const other of this.allCreatures) {
        // Check if this creature is a parent of 'other' using IDs
        // Only if they're the same species
        if ((other.parent1Id === creatureId || other.parent2Id === creatureId) && 
            !visited.has(other.id) &&
            (other instanceof Gnawlin) === isGnawlin) {
          const childId = addCreature(other.id);
          if (childId) {
            // Find parent's datum and add child
            const parentDatum = data.find(d => d.id === creatureId.toString());
            if (parentDatum && !parentDatum.rels.children.includes(childId)) {
              parentDatum.rels.children.push(childId);
            }
          }
          addChildren(other.id); // Recursively add grandchildren
        }
      }
    };

    addChildren(rootCreature.id);

    // Add siblings - creatures that share the same parents (only same species)
    // This needs to happen after all nodes are added
    for (const datum of data) {
      const creatureId = parseInt(datum.id);
      const creature = creatureById.get(creatureId);
      if (!creature) continue;

      // Only add siblings if this creature has parents
      if (creature.parent1Id === null && creature.parent2Id === null) continue;
      
      const isGnawlin = creature instanceof Gnawlin;
      
      for (const other of this.allCreatures) {
        // Skip self
        if (other.id === creatureId) continue;
        
        // Only consider same species
        if ((other instanceof Gnawlin) !== isGnawlin) continue;

        // Check if they share at least one parent (siblings)
        const shareParent =
          (creature.parent1Id !== null && (other.parent1Id === creature.parent1Id || other.parent2Id === creature.parent1Id)) ||
          (creature.parent2Id !== null && (other.parent1Id === creature.parent2Id || other.parent2Id === creature.parent2Id));

        if (shareParent) {
          const siblingId = other.id.toString();
          // Check if sibling is already in the tree
          const siblingDatum = data.find(d => d.id === siblingId);
          if (siblingDatum) {
            // Add sibling to spouses array (family-chart uses spouses for horizontal connections like siblings)
            if (!datum.rels.spouses.includes(siblingId)) {
              datum.rels.spouses.push(siblingId);
            }
            // Also add reciprocal relationship
            if (!siblingDatum.rels.spouses.includes(datum.id)) {
              siblingDatum.rels.spouses.push(datum.id);
            }
          }
        }
      }
    }

    // Ensure all mate relationships are reciprocal
    // This ensures that if A has B as a mate, B also has A as a spouse
    for (const datum of data) {
      for (const spouseId of datum.rels.spouses) {
        const spouseDatum = data.find(d => d.id === spouseId);
        if (spouseDatum && !spouseDatum.rels.spouses.includes(datum.id)) {
          spouseDatum.rels.spouses.push(datum.id);
        }
      }
    }

    return data;
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
    content.innerHTML += `Damage: ${stats.damage.toFixed(1)}<br></div>`;

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
