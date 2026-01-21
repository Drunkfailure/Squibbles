/**
 * StatsGraphRenderer - Renders graphs from tracked statistics
 * Creates an overlay with interactive charts at end of simulation
 */

import { StatsRecorder, StatConfig } from './StatsRecorder';

export class StatsGraphRenderer {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private recorder: StatsRecorder;
  
  private selectedStats: Set<string> = new Set();
  private hoveredPoint: { stat: string; index: number } | null = null;
  
  // Creature type filter
  private currentCreatureType: 'squibble' | 'gnawlin' = 'squibble';
  
  // Graph dimensions
  private graphPadding = { top: 60, right: 200, bottom: 60, left: 80 };
  private legendWidth = 180;
  
  // Live update
  private updateInterval: number | null = null;
  private isVisible: boolean = false;
  
  // Event listener references for cleanup
  private resizeHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private mousemoveHandler: ((e: MouseEvent) => void) | null = null;
  
  // Throttle resize to prevent excessive renders
  private resizeTimeout: number | null = null;
  
  // Prevent overlapping renders
  private isRendering: boolean = false;
  
  constructor(recorder: StatsRecorder) {
    this.recorder = recorder;
    
    // Default selected stats (will be filtered by creature type)
    // Initialize with Squibble stats
    const defaultStats = this.getDefaultStatsForType('squibble');
    defaultStats.forEach(stat => {
      if (this.recorder.getStatConfig(stat)) {
        this.selectedStats.add(stat);
      }
    });
  }
  
  /**
   * Show the stats graph overlay
   */
  show(): void {
    if (this.isVisible) return; // Prevent multiple shows
    
    // Clean up any existing overlay first (safety check)
    if (this.container) {
      this.hide();
    }
    
    this.isVisible = true;
    this.createOverlay();
    this.render();
    
    // Start live update interval (every 500ms)
    this.updateInterval = window.setInterval(() => {
      if (this.isVisible) {
        this.render();
        this.updateInfoBar();
      }
    }, 500);
  }
  
  /**
   * Check if the graph overlay is currently visible
   */
  isGraphVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Hide and cleanup the overlay
   */
  hide(): void {
    this.isVisible = false;
    
    // Stop live updates
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Clear resize timeout
    if (this.resizeTimeout !== null) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    
    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.mousemoveHandler && this.canvas) {
      this.canvas.removeEventListener('mousemove', this.mousemoveHandler);
      this.mousemoveHandler = null;
    }
    
    // Remove DOM elements
    if (this.container) {
      if (this.container.parentNode) {
        document.body.removeChild(this.container);
      }
      this.container = null;
      this.canvas = null;
      this.ctx = null;
    }
  }
  
  /**
   * Update the info bar with current stats
   */
  private updateInfoBar(): void {
    const infoBar = document.getElementById('stats-info-bar');
    if (infoBar) {
      infoBar.textContent = `Duration: ${this.recorder.getDuration().toFixed(1)}s | Data points: ${this.recorder.getDataPoints().length} | Live updating...`;
    }
  }
  
  /**
   * Create the overlay DOM elements
   */
  private createOverlay(): void {
    // Main container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: 'Segoe UI', Arial, sans-serif;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: #1a1a2e;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #4a4a6a;
    `;
    
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = 'display: flex; align-items: center; gap: 20px; flex: 1;';
    
    // Check if Gnawlin stats are enabled
    const gnawlinStatsEnabled = this.recorder.getStatConfigs().some(stat => 
      stat.name.startsWith('gnawlin_') && stat.enabled
    );
    
    // Navigation arrows (only show if Gnawlin stats are enabled)
    let prevBtn: HTMLButtonElement | null = null;
    let nextBtn: HTMLButtonElement | null = null;
    
    if (gnawlinStatsEnabled) {
      prevBtn = this.createNavButton('◀', () => this.switchCreatureType('squibble'), this.currentCreatureType === 'squibble');
      nextBtn = this.createNavButton('▶', () => this.switchCreatureType('gnawlin'), this.currentCreatureType === 'gnawlin');
    }
    
    const title = document.createElement('h1');
    title.id = 'stats-title';
    title.textContent = `Simulation Statistics - ${this.currentCreatureType.charAt(0).toUpperCase() + this.currentCreatureType.slice(1)}s`;
    title.style.cssText = 'margin: 0; color: #fff; font-size: 24px;';
    
    if (prevBtn) {
      titleContainer.appendChild(prevBtn);
    }
    titleContainer.appendChild(title);
    if (nextBtn) {
      titleContainer.appendChild(nextBtn);
    }
    header.appendChild(titleContainer);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 10px;';
    
    // Export buttons
    const exportCSV = this.createButton('Export CSV', () => this.exportCSV());
    const exportJSON = this.createButton('Export JSON', () => this.exportJSON());
    const closeBtn = this.createButton('Close (ESC)', () => this.hide(), '#e74c3c');
    
    buttonContainer.appendChild(exportCSV);
    buttonContainer.appendChild(exportJSON);
    buttonContainer.appendChild(closeBtn);
    header.appendChild(buttonContainer);
    
    this.container.appendChild(header);
    
    // Main content area
    const content = document.createElement('div');
    content.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
    `;
    
    // Sidebar for stat selection
    const sidebar = this.createSidebar();
    content.appendChild(sidebar);
    
    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
      flex: 1;
      padding: 20px;
      display: flex;
      flex-direction: column;
    `;
    
    // Info bar
    const infoBar = document.createElement('div');
    infoBar.id = 'stats-info-bar';
    infoBar.style.cssText = `
      color: #aaa;
      font-size: 14px;
      margin-bottom: 10px;
    `;
    infoBar.textContent = `Duration: ${this.recorder.getDuration().toFixed(1)}s | Data points: ${this.recorder.getDataPoints().length}`;
    canvasContainer.appendChild(infoBar);
    
    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'flex: 1; background: #0d0d1a; border-radius: 8px;';
    canvasContainer.appendChild(this.canvas);
    
    content.appendChild(canvasContainer);
    this.container.appendChild(content);
    
    document.body.appendChild(this.container);
    
    // Setup canvas
    this.resizeCanvas();
    this.ctx = this.canvas.getContext('2d');
    
    // Event listeners (store references for cleanup)
    this.resizeHandler = () => {
      // Throttle resize to prevent excessive renders
      if (this.resizeTimeout !== null) {
        clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = window.setTimeout(() => {
        if (this.isVisible) {
          this.resizeCanvas();
        }
      }, 100); // Throttle to max once per 100ms
    };
    
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    
    this.mousemoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('keydown', this.keydownHandler);
    this.canvas.addEventListener('mousemove', this.mousemoveHandler);
  }
  
  /**
   * Create a navigation button for switching creature types
   */
  private createNavButton(text: string, onClick: () => void, isActive: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 8px 16px;
      background: ${isActive ? '#3498db' : '#555'};
      color: white;
      border: none;
      border-radius: 5px;
      cursor: ${isActive ? 'default' : 'pointer'};
      font-size: 18px;
      font-weight: bold;
      transition: opacity 0.2s;
      opacity: ${isActive ? '1' : '0.6'};
    `;
    if (!isActive) {
      btn.onmouseover = () => btn.style.opacity = '1';
      btn.onmouseout = () => btn.style.opacity = '0.6';
      btn.onclick = onClick;
    }
    return btn;
  }
  
  /**
   * Switch between Squibble and Gnawlin stats
   */
  private switchCreatureType(type: 'squibble' | 'gnawlin'): void {
    if (this.currentCreatureType === type) return;
    
    this.currentCreatureType = type;
    
    // Update title
    const title = this.container?.querySelector('#stats-title');
    if (title) {
      title.textContent = `Simulation Statistics - ${type.charAt(0).toUpperCase() + type.slice(1)}s`;
    }
    
    // Update navigation buttons (they're in the title container)
    const titleContainer = this.container?.querySelector('#stats-title')?.parentElement;
    if (titleContainer) {
      const buttons = titleContainer.querySelectorAll('button');
      // Check if Gnawlin stats are enabled
      const gnawlinStatsEnabled = this.recorder.getStatConfigs().some(stat => 
        stat.name.startsWith('gnawlin_') && stat.enabled
      );
      
      if (buttons.length >= 2 && gnawlinStatsEnabled) {
        const prevBtn = buttons[0] as HTMLButtonElement;
        const nextBtn = buttons[1] as HTMLButtonElement;
        
        prevBtn.style.background = type === 'squibble' ? '#3498db' : '#555';
        prevBtn.style.opacity = type === 'squibble' ? '1' : '0.6';
        prevBtn.style.cursor = type === 'squibble' ? 'default' : 'pointer';
        if (type === 'squibble') {
          prevBtn.onclick = null;
        } else {
          prevBtn.onclick = () => this.switchCreatureType('squibble');
        }
        
        nextBtn.style.background = type === 'gnawlin' ? '#3498db' : '#555';
        nextBtn.style.opacity = type === 'gnawlin' ? '1' : '0.6';
        nextBtn.style.cursor = type === 'gnawlin' ? 'default' : 'pointer';
        if (type === 'gnawlin') {
          nextBtn.onclick = null;
        } else {
          nextBtn.onclick = () => this.switchCreatureType('gnawlin');
        }
      } else if (buttons.length >= 1) {
        // Only prev button exists (Gnawlin stats disabled)
        const prevBtn = buttons[0] as HTMLButtonElement;
        prevBtn.style.background = '#3498db';
        prevBtn.style.opacity = '1';
        prevBtn.style.cursor = 'default';
        prevBtn.onclick = null;
      }
    }
    
    // Rebuild sidebar with filtered stats
    const sidebar = this.container?.querySelector('#stats-sidebar');
    if (sidebar) {
      const content = sidebar.parentElement;
      if (content) {
        sidebar.remove();
        const newSidebar = this.createSidebar();
        content.insertBefore(newSidebar, content.firstChild);
      }
    }
    
    // Clear and reset selected stats for new creature type
    this.selectedStats.clear();
    const defaultStats = this.getDefaultStatsForType(type);
    defaultStats.forEach(stat => {
      // Only add if the stat exists in the recorder
      if (this.recorder.getStatConfig(stat)) {
        this.selectedStats.add(stat);
      }
    });
    
    // Re-render
    this.render();
  }
  
  /**
   * Get default stats for a creature type
   */
  private getDefaultStatsForType(type: 'squibble' | 'gnawlin'): string[] {
    const prefix = type === 'squibble' ? '' : 'gnawlin_';
    return [
      `${prefix}population`,
      `${prefix}avg_hunger`,
      `${prefix}avg_speed`,
    ];
  }
  
  /**
   * Create a styled button
   */
  private createButton(text: string, onClick: () => void, bgColor: string = '#3498db'): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 10px 20px;
      background: ${bgColor};
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      transition: opacity 0.2s;
    `;
    btn.onmouseover = () => btn.style.opacity = '0.8';
    btn.onmouseout = () => btn.style.opacity = '1';
    btn.onclick = onClick;
    return btn;
  }
  
  /**
   * Create the sidebar with stat checkboxes (filtered by creature type)
   */
  private createSidebar(): HTMLDivElement {
    const sidebar = document.createElement('div');
    sidebar.id = 'stats-sidebar';
    sidebar.style.cssText = `
      width: 250px;
      background: #1a1a2e;
      padding: 20px;
      overflow-y: auto;
      border-right: 2px solid #4a4a6a;
    `;
    
    const title = document.createElement('h3');
    title.textContent = `Select ${this.currentCreatureType.charAt(0).toUpperCase() + this.currentCreatureType.slice(1)} Stats`;
    title.style.cssText = 'color: #fff; margin: 0 0 15px 0;';
    sidebar.appendChild(title);
    
    // Filter stats by creature type and enabled status
    const prefix = this.currentCreatureType === 'squibble' ? '' : 'gnawlin_';
    const allStats = this.recorder.getStatConfigs();
    const filteredStats = allStats.filter(stat => {
      // Only show enabled stats
      if (!stat.enabled) return false;
      
      // Squibble stats don't have prefix, Gnawlin stats have 'gnawlin_' prefix
      if (this.currentCreatureType === 'squibble') {
        return !stat.name.startsWith('gnawlin_');
      } else {
        return stat.name.startsWith('gnawlin_');
      }
    });
    
    // Group by category
    const categories = new Set<string>();
    filteredStats.forEach(stat => categories.add(stat.category));
    
    for (const category of categories) {
      const categoryDiv = document.createElement('div');
      categoryDiv.style.cssText = 'margin-bottom: 15px;';
      
      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryTitle.style.cssText = 'color: #888; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;';
      categoryDiv.appendChild(categoryTitle);
      
      const stats = filteredStats.filter(s => s.category === category);
      for (const stat of stats) {
        const label = document.createElement('label');
        label.style.cssText = `
          display: flex;
          align-items: center;
          color: #ccc;
          margin: 5px 0;
          cursor: pointer;
          font-size: 13px;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = this.selectedStats.has(stat.name);
        checkbox.style.cssText = 'margin-right: 8px;';
        checkbox.onchange = () => {
          if (checkbox.checked) {
            this.selectedStats.add(stat.name);
          } else {
            this.selectedStats.delete(stat.name);
          }
          this.render();
        };
        
        const colorBox = document.createElement('span');
        colorBox.style.cssText = `
          width: 12px;
          height: 12px;
          background: ${stat.color};
          margin-right: 8px;
          border-radius: 2px;
        `;
        
        // Remove prefix from label for display
        const displayLabel = stat.name.startsWith('gnawlin_') 
          ? stat.label.replace(/^Gnawlin /i, '') 
          : stat.label;
        
        label.appendChild(checkbox);
        label.appendChild(colorBox);
        label.appendChild(document.createTextNode(displayLabel));
        categoryDiv.appendChild(label);
      }
      
      sidebar.appendChild(categoryDiv);
    }
    
    return sidebar;
  }
  
  /**
   * Resize canvas to fit container
   */
  private resizeCanvas(): void {
    if (!this.canvas || !this.isVisible) return;
    
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width - 40;
      this.canvas.height = rect.height - 60;
      // Only render if we have a context
      if (this.ctx) {
        this.render();
      }
    }
  }
  
  /**
   * Main render function
   */
  render(): void {
    if (!this.ctx || !this.canvas || !this.isVisible) return;
    
    // Prevent overlapping renders
    if (this.isRendering) return;
    this.isRendering = true;
    
    try {
      const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // Clear
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, width, height);
    
    const dataPoints = this.recorder.getDataPoints();
    if (dataPoints.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough data to display graphs', width / 2, height / 2);
      return;
    }
    
    // Calculate graph area
    const graphX = this.graphPadding.left;
    const graphY = this.graphPadding.top;
    const graphWidth = width - this.graphPadding.left - this.graphPadding.right;
    const graphHeight = height - this.graphPadding.top - this.graphPadding.bottom;
    
    // Find time range
    const minTime = dataPoints[0].time;
    const maxTime = dataPoints[dataPoints.length - 1].time;
    const timeRange = maxTime - minTime || 1;
    
    // Find value range across all selected stats (filtered by creature type)
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    for (const statName of this.selectedStats) {
      // Only consider stats that match the current creature type
      if (this.currentCreatureType === 'squibble' && statName.startsWith('gnawlin_')) continue;
      if (this.currentCreatureType === 'gnawlin' && !statName.startsWith('gnawlin_')) continue;
      
      for (const dp of dataPoints) {
        const val = dp[statName];
        if (val !== undefined) {
          minValue = Math.min(minValue, val);
          maxValue = Math.max(maxValue, val);
        }
      }
    }
    
    // Add padding to value range
    const valueRange = maxValue - minValue || 1;
    minValue = Math.max(0, minValue - valueRange * 0.1);
    maxValue = maxValue + valueRange * 0.1;
    const adjustedRange = maxValue - minValue;
    
    // Draw grid
    this.drawGrid(ctx, graphX, graphY, graphWidth, graphHeight, minTime, maxTime, minValue, maxValue);
    
    // Draw each selected stat (filtered by creature type)
    let legendY = graphY;
    for (const statName of this.selectedStats) {
      // Only show stats that match the current creature type
      if (this.currentCreatureType === 'squibble' && statName.startsWith('gnawlin_')) continue;
      if (this.currentCreatureType === 'gnawlin' && !statName.startsWith('gnawlin_')) continue;
      
      const config = this.recorder.getStatConfig(statName);
      if (!config) continue;
      
      const data = this.recorder.getStatData(statName);
      if (data.length < 2) continue;
      
      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2;
      
      let first = true;
      for (const point of data) {
        const x = graphX + ((point.time - minTime) / timeRange) * graphWidth;
        const y = graphY + graphHeight - ((point.value - minValue) / adjustedRange) * graphHeight;
        
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      // Draw legend entry
      ctx.fillStyle = config.color;
      ctx.fillRect(width - this.graphPadding.right + 20, legendY, 15, 15);
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(config.label, width - this.graphPadding.right + 45, legendY + 12);
      legendY += 25;
    }
    } finally {
      this.isRendering = false;
    }
  }
  
  /**
   * Draw grid lines and labels
   */
  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    width: number, height: number,
    minTime: number, maxTime: number,
    minValue: number, maxValue: number
  ): void {
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#888';
    ctx.font = '11px Arial';
    
    // Horizontal grid lines (values)
    const numHLines = 5;
    for (let i = 0; i <= numHLines; i++) {
      const lineY = y + (i / numHLines) * height;
      const value = maxValue - (i / numHLines) * (maxValue - minValue);
      
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + width, lineY);
      ctx.stroke();
      
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(1), x - 10, lineY + 4);
    }
    
    // Vertical grid lines (time)
    const numVLines = 6;
    for (let i = 0; i <= numVLines; i++) {
      const lineX = x + (i / numVLines) * width;
      const time = minTime + (i / numVLines) * (maxTime - minTime);
      
      ctx.beginPath();
      ctx.moveTo(lineX, y);
      ctx.lineTo(lineX, y + height);
      ctx.stroke();
      
      ctx.textAlign = 'center';
      ctx.fillText(time.toFixed(0) + 's', lineX, y + height + 20);
    }
    
    // Axis labels
    ctx.fillStyle = '#aaa';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (seconds)', x + width / 2, y + height + 45);
    
    ctx.save();
    ctx.translate(20, y + height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Value', 0, 0);
    ctx.restore();
  }
  
  /**
   * Handle mouse movement for tooltips
   */
  private onMouseMove(e: MouseEvent): void {
    // Could add tooltip functionality here
  }
  
  /**
   * Export data as CSV and download
   */
  private exportCSV(): void {
    const csv = this.recorder.exportCSV();
    this.downloadFile(csv, 'simulation_stats.csv', 'text/csv');
  }
  
  /**
   * Export data as JSON and download
   */
  private exportJSON(): void {
    const json = this.recorder.exportJSON();
    this.downloadFile(json, 'simulation_stats.json', 'application/json');
  }
  
  /**
   * Trigger file download
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
