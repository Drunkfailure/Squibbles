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
  
  // Graph dimensions
  private graphPadding = { top: 60, right: 200, bottom: 60, left: 80 };
  private legendWidth = 180;
  
  // Live update
  private updateInterval: number | null = null;
  private isVisible: boolean = false;
  
  constructor(recorder: StatsRecorder) {
    this.recorder = recorder;
    
    // Default selected stats
    this.selectedStats.add('population');
    this.selectedStats.add('avg_hunger');
    this.selectedStats.add('avg_speed');
  }
  
  /**
   * Show the stats graph overlay
   */
  show(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.createOverlay();
    this.render();
    
    // Start live update interval (every 500ms)
    this.updateInterval = window.setInterval(() => {
      this.render();
      this.updateInfoBar();
    }, 500);
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
    
    if (this.container) {
      document.body.removeChild(this.container);
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
    
    const title = document.createElement('h1');
    title.textContent = 'Simulation Statistics';
    title.style.cssText = 'margin: 0; color: #fff; font-size: 24px;';
    header.appendChild(title);
    
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
    
    // Event listeners
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
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
   * Create the sidebar with stat checkboxes
   */
  private createSidebar(): HTMLDivElement {
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
      width: 250px;
      background: #1a1a2e;
      padding: 20px;
      overflow-y: auto;
      border-right: 2px solid #4a4a6a;
    `;
    
    const title = document.createElement('h3');
    title.textContent = 'Select Stats';
    title.style.cssText = 'color: #fff; margin: 0 0 15px 0;';
    sidebar.appendChild(title);
    
    // Group by category
    const categories = this.recorder.getCategories();
    
    for (const category of categories) {
      const categoryDiv = document.createElement('div');
      categoryDiv.style.cssText = 'margin-bottom: 15px;';
      
      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryTitle.style.cssText = 'color: #888; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;';
      categoryDiv.appendChild(categoryTitle);
      
      const stats = this.recorder.getStatsByCategory(category);
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
        
        label.appendChild(checkbox);
        label.appendChild(colorBox);
        label.appendChild(document.createTextNode(stat.label));
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
    if (!this.canvas) return;
    
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width - 40;
      this.canvas.height = rect.height - 60;
      this.render();
    }
  }
  
  /**
   * Main render function
   */
  render(): void {
    if (!this.ctx || !this.canvas) return;
    
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
    
    // Find value range across all selected stats
    let minValue = Infinity;
    let maxValue = -Infinity;
    
    for (const statName of this.selectedStats) {
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
    
    // Draw each selected stat
    let legendY = graphY;
    for (const statName of this.selectedStats) {
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
