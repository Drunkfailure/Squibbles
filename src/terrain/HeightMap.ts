/**
 * HeightMap - Per-tile elevation queries for 3D terrain and entity footing
 */

import {
  WATER_SURFACE_HEIGHT,
  WATER_WORLD_Z,
  landHeightToWorldZ,
} from '../render/ViewProjection';

export class HeightMap {
  private grid: Float32Array;
  private waterMask: boolean[];
  private tileSize: number;
  private rows: number;
  private cols: number;

  constructor(
    grid: Float32Array,
    waterMask: boolean[],
    tileSize: number,
    rows: number,
    cols: number
  ) {
    this.grid = grid;
    this.waterMask = waterMask;
    this.tileSize = Math.max(1, tileSize);
    this.rows = rows;
    this.cols = cols;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  isWaterTile(row: number, col: number): boolean {
    const r = Math.max(0, Math.min(this.rows - 1, row));
    const c = Math.max(0, Math.min(this.cols - 1, col));
    return this.waterMask[r * this.cols + c];
  }

  isWaterAt(x: number, y: number): boolean {
    const ts = this.tileSize;
    const col = Math.floor(x / ts);
    const row = Math.floor(y / ts);
    return this.isWaterTile(row, col);
  }

  getTileHeight(row: number, col: number): number {
    if (this.isWaterTile(row, col)) return WATER_SURFACE_HEIGHT;
    const r = Math.max(0, Math.min(this.rows - 1, row));
    const c = Math.max(0, Math.min(this.cols - 1, col));
    return this.grid[r * this.cols + c];
  }

  /** World Z at a grid vertex — average of adjacent land tile heights. */
  cornerWorldZ(row: number, col: number): number {
    let sum = 0;
    let count = 0;
    const tiles: [number, number][] = [
      [row, col],
      [row, col - 1],
      [row - 1, col],
      [row - 1, col - 1],
    ];
    for (const [tr, tc] of tiles) {
      if (tr < 0 || tr >= this.rows || tc < 0 || tc >= this.cols) continue;
      if (this.isWaterTile(tr, tc)) continue;
      sum += landHeightToWorldZ(this.grid[tr * this.cols + tc]);
      count++;
    }
    return count > 0 ? sum / count : WATER_WORLD_Z;
  }

  /** Flat world Z for a land tile center (matches voxel tops). */
  tileWorldZ(row: number, col: number): number {
    if (this.isWaterTile(row, col)) return WATER_WORLD_Z;
    return landHeightToWorldZ(this.getTileHeight(row, col));
  }

  /**
   * Bilinear world Z on the tile surface — same corner layout as TerrainVoxelRenderer.
   * Creatures walk on this height so they match visible terrain.
   */
  getSurfaceWorldZ(x: number, y: number): number {
    if (this.isWaterAt(x, y)) return WATER_WORLD_Z;

    const ts = this.tileSize;
    const col = Math.floor(x / ts);
    const row = Math.floor(y / ts);
    const x0 = col * ts;
    const y0 = row * ts;
    const tx = Math.max(0, Math.min(1, (x - x0) / ts));
    const ty = Math.max(0, Math.min(1, (y - y0) / ts));

    const z00 = this.cornerWorldZ(row, col);
    const z10 = this.cornerWorldZ(row, col + 1);
    const z01 = this.cornerWorldZ(row + 1, col);
    const z11 = this.cornerWorldZ(row + 1, col + 1);

    const top = z00 * (1 - tx) + z10 * tx;
    const bot = z01 * (1 - tx) + z11 * tx;
    return top * (1 - ty) + bot * ty;
  }

  getHeightAt(x: number, y: number): number {
    if (this.isWaterAt(x, y)) return WATER_SURFACE_HEIGHT;

    const ts = this.tileSize;
    const gx = x / ts - 0.5;
    const gy = y / ts - 0.5;
    const c0 = Math.floor(gx);
    const r0 = Math.floor(gy);
    const c1 = Math.min(this.cols - 1, c0 + 1);
    const r1 = Math.min(this.rows - 1, r0 + 1);
    const tc0 = Math.max(0, Math.min(this.cols - 1, c0));
    const tr0 = Math.max(0, Math.min(this.rows - 1, r0));
    const fx = gx - c0;
    const fy = gy - r0;

    const h00 = this.getTileHeight(tr0, tc0);
    const h10 = this.getTileHeight(tr0, c1);
    const h01 = this.getTileHeight(r1, tc0);
    const h11 = this.getTileHeight(r1, c1);

    const top = h00 * (1 - fx) + h10 * fx;
    const bot = h01 * (1 - fx) + h11 * fx;
    return top * (1 - fy) + bot * fy;
  }

  getSlopeAt(x: number, y: number): number {
    if (this.isWaterAt(x, y)) return 0;
    const e = 2;
    const z = this.getSurfaceWorldZ(x, y);
    const zx = this.getSurfaceWorldZ(x + e, y) - this.getSurfaceWorldZ(x - e, y);
    const zy = this.getSurfaceWorldZ(x, y + e) - this.getSurfaceWorldZ(x, y - e);
    return Math.sqrt(zx * zx + zy * zy) / (e * 2);
  }

  isSteep(x: number, y: number, threshold: number = 2.5): boolean {
    return this.getSlopeAt(x, y) >= threshold;
  }

  /** @deprecated Use getSurfaceWorldZ */
  getSurfaceZ(x: number, y: number, _zScale?: number): number {
    return this.getSurfaceWorldZ(x, y);
  }
}
