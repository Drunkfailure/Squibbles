/**
 * WaterMap - Helper for water proximity queries
 */

export class WaterMap {
  private mask: boolean[];
  private tileSize: number;
  private rows: number;
  private cols: number;
  
  constructor(waterMask: boolean[], tileSize: number, rows: number, cols: number) {
    this.mask = waterMask;
    this.tileSize = Math.max(1, tileSize);
    this.rows = rows;
    this.cols = cols;
  }
  
  isWaterAt(x: number, y: number): boolean {
    const cx = Math.floor(x / this.tileSize);
    const cy = Math.floor(y / this.tileSize);
    const clampedCx = Math.max(0, Math.min(this.cols - 1, cx));
    const clampedCy = Math.max(0, Math.min(this.rows - 1, cy));
    return this.mask[clampedCy * this.cols + clampedCx];
  }
  
  isWaterNear(x: number, y: number, radius: number): boolean {
    const ts = this.tileSize;
    const minCx = Math.floor(Math.max(0, (x - radius) / ts));
    const maxCx = Math.floor(Math.min(this.cols - 1, (x + radius) / ts));
    const minCy = Math.floor(Math.max(0, (y - radius) / ts));
    const maxCy = Math.floor(Math.min(this.rows - 1, (y + radius) / ts));
    
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (this.mask[cy * this.cols + cx]) {
          return true;
        }
      }
    }
    
    return false;
  }
}
