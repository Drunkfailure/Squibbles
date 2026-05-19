/**
 * TerrainVoxelRenderer - Shared grid corners (watertight tops) + depth-sorted faces
 */

import { Graphics } from 'pixi.js';
import { Biome, BIOME_COLORS, WATER_COLOR } from './Biome';
import { WorldData } from './WorldGenerator';
import { HeightMap } from './HeightMap';
import { Camera3D } from '../render/Camera3D';
import { SceneDrawable } from '../render/SceneDrawQueue';
import { drawQuadAsTris, drawQuadAlways, ScreenPoint } from '../render/terrainCull';
import { WATER_WORLD_Z } from '../render/ViewProjection';

const WALL_DARKEN = 0.9;

interface CornerProj {
  sx: number;
  sy: number;
  depth: number;
}

function rgbHex(color: [number, number, number]): number {
  return (color[0] << 16) | (color[1] << 8) | color[2];
}

function darken(color: [number, number, number], factor: number): number {
  return rgbHex([
    Math.round(color[0] * factor),
    Math.round(color[1] * factor),
    Math.round(color[2] * factor),
  ]);
}

function avgDepth(...depths: number[]): number {
  let s = 0;
  for (const d of depths) s += d;
  return s / depths.length;
}

function sp(c: CornerProj): ScreenPoint {
  return { sx: c.sx, sy: c.sy };
}

export class TerrainVoxelRenderer {
  render(
    g: Graphics,
    worldData: WorldData,
    heightMap: HeightMap,
    camera: Camera3D
  ): void {
    g.clear();
    const drawables: SceneDrawable[] = [];
    this.collectDrawables(drawables, worldData, heightMap, camera);
    for (const d of drawables) {
      if (d.drawTerrain) d.drawTerrain(g);
    }
  }

  collectDrawables(
    out: SceneDrawable[],
    worldData: WorldData,
    heightMap: HeightMap,
    camera: Camera3D
  ): void {
    const { biomeGrid, tileSize, cols, rows } = worldData;
    const { halfW, halfH } = camera.getViewHalfExtents();
    const tileZ = (row: number, col: number): number => heightMap.tileWorldZ(row, col);

    // Shared corner projections — adjacent tiles use identical edge vertices (no gaps)
    const corners: CornerProj[][] = [];
    for (let r = 0; r <= rows; r++) {
      corners[r] = [];
      for (let c = 0; c <= cols; c++) {
        const wz = heightMap.cornerWorldZ(r, c);
        const p = camera.project(c * tileSize, r * tileSize, wz);
        corners[r][c] = { sx: p.sx, sy: p.sy, depth: p.depth };
      }
    }

    const pushTop = (fill: number, nw: CornerProj, ne: CornerProj, se: CornerProj, sw: CornerProj) => {
      const depth = avgDepth(nw.depth, ne.depth, se.depth, sw.depth);
      out.push({
        depth,
        kind: 'terrain',
        drawTerrain: (g) => drawQuadAsTris(g, fill, sp(nw), sp(ne), sp(se), sp(sw)),
      });
    };

    const pushWall = (
      fill: number,
      topL: CornerProj,
      topR: CornerProj,
      wx0: number,
      wy0: number,
      wz0: number,
      wx1: number,
      wy1: number,
      wz1: number
    ) => {
      const bl = camera.project(wx0, wy0, wz0);
      const br = camera.project(wx1, wy1, wz1);
      const botL: ScreenPoint = { sx: bl.sx, sy: bl.sy };
      const botR: ScreenPoint = { sx: br.sx, sy: br.sy };
      const depth = avgDepth(topL.depth, topR.depth, bl.depth, br.depth);
      out.push({
        depth,
        kind: 'terrain',
        drawTerrain: (g) => drawQuadAlways(g, fill, sp(topL), sp(topR), botR, botL),
      });
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isWater = heightMap.isWaterTile(r, c);
        const x0 = c * tileSize;
        const y0 = r * tileSize;
        const x1 = x0 + tileSize;
        const y1 = y0 + tileSize;

        const nw = corners[r][c];
        const ne = corners[r][c + 1];
        const se = corners[r + 1][c + 1];
        const sw = corners[r + 1][c];

        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const zTop = isWater ? WATER_WORLD_Z : tileZ(r, c);
        const centerProj = camera.project(cx, cy, zTop);
        if (
          centerProj.sx < -halfW ||
          centerProj.sx > camera.screenW + halfW ||
          centerProj.sy < -halfH ||
          centerProj.sy > camera.screenH + halfH
        ) {
          continue;
        }

        const biome = biomeGrid[r * cols + c] as Biome;
        const topColor = isWater ? WATER_COLOR : BIOME_COLORS[biome] ?? BIOME_COLORS[Biome.PLAINS];
        const topHex = rgbHex(topColor);
        const wallHex = isWater ? topHex : darken(topColor, WALL_DARKEN);

        if (isWater) {
          pushTop(topHex, nw, ne, se, sw);
          continue;
        }

        const myZ = tileZ(r, c);

        const addWall = (
          topL: CornerProj,
          topR: CornerProj,
          wx0: number,
          wy0: number,
          bottomZ: number,
          wx1: number,
          wy1: number
        ) => {
          if (myZ > bottomZ + 0.25) {
            pushWall(wallHex, topL, topR, wx0, wy0, bottomZ, wx1, wy1, bottomZ);
          }
        };

        // Shores: all sides next to water
        if (r > 0 && heightMap.isWaterTile(r - 1, c)) {
          addWall(nw, ne, x0, y0, WATER_WORLD_Z, x1, y0);
        }
        if (r < rows - 1 && heightMap.isWaterTile(r + 1, c)) {
          addWall(sw, se, x0, y1, WATER_WORLD_Z, x1, y1);
        }
        if (c > 0 && heightMap.isWaterTile(r, c - 1)) {
          addWall(nw, sw, x0, y0, WATER_WORLD_Z, x0, y1);
        }
        if (c < cols - 1 && heightMap.isWaterTile(r, c + 1)) {
          addWall(ne, se, x1, y0, WATER_WORLD_Z, x1, y1);
        }

        // Land steps: south / east only (no duplicate walls)
        if (r < rows - 1 && !heightMap.isWaterTile(r + 1, c)) {
          addWall(sw, se, x0, y1, tileZ(r + 1, c), x1, y1);
        }
        if (c < cols - 1 && !heightMap.isWaterTile(r, c + 1)) {
          addWall(ne, se, x1, y0, tileZ(r, c + 1), x1, y1);
        }

        pushTop(topHex, nw, ne, se, sw);
      }
    }
  }
}
