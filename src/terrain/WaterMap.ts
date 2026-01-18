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
  
  /**
   * Find nearest water tile center within vision range
   */
  findNearestWater(x: number, y: number, visionRange: number): { x: number; y: number } | null {
    const ts = this.tileSize;
    const minCx = Math.floor(Math.max(0, (x - visionRange) / ts));
    const maxCx = Math.floor(Math.min(this.cols - 1, (x + visionRange) / ts));
    const minCy = Math.floor(Math.max(0, (y - visionRange) / ts));
    const maxCy = Math.floor(Math.min(this.rows - 1, (y + visionRange) / ts));
    
    let nearestWater: { x: number; y: number } | null = null;
    let nearestDistSq = visionRange * visionRange;
    
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (this.mask[cy * this.cols + cx]) {
          // Center of water tile
          const waterX = (cx + 0.5) * ts;
          const waterY = (cy + 0.5) * ts;
          const dx = waterX - x;
          const dy = waterY - y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestWater = { x: waterX, y: waterY };
          }
        }
      }
    }
    
    return nearestWater;
  }

  /**
   * Find a land tile on the other side of water in the given direction
   * Searches along the direction vector for the first non-water tile
   */
  findLandInDirection(x: number, y: number, direction: number, maxSearchDistance: number = 500): { x: number; y: number } | null {
    const ts = this.tileSize;
    const stepSize = ts * 0.5; // Check every half tile
    const steps = Math.floor(maxSearchDistance / stepSize);
    
    // Start searching a bit ahead (we're already in water or about to enter)
    const startOffset = ts * 2;
    
    for (let i = 1; i <= steps; i++) {
      const distance = startOffset + (i * stepSize);
      const checkX = x + Math.cos(direction) * distance;
      const checkY = y + Math.sin(direction) * distance;
      
      // Check if this position is within bounds
      const cx = Math.floor(checkX / ts);
      const cy = Math.floor(checkY / ts);
      if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) {
        continue; // Out of bounds, keep searching
      }
      
      // Check if this is land (not water)
      if (!this.isWaterAt(checkX, checkY)) {
        // Found land! Return the center of this tile
        return {
          x: (cx + 0.5) * ts,
          y: (cy + 0.5) * ts
        };
      }
    }
    
    // No land found in that direction
    return null;
  }
}
