/**
 * TerrainRenderer - Renders terrain to a canvas/texture with 2.5D height shading
 */

import { Texture, BaseTexture, Sprite, Container } from 'pixi.js';
import { Biome, BIOME_COLORS, WATER_COLOR } from './Biome';
import { WorldData } from './WorldGenerator';
import { AssetLoader } from '../utils/AssetLoader';

const CLIFF_THRESHOLD = 0.12;

function shadeRgb(color: [number, number, number], factor: number): string {
  const f = Math.max(0, Math.min(1.5, factor));
  const r = Math.round(Math.min(255, color[0] * f));
  const g = Math.round(Math.min(255, color[1] * f));
  const b = Math.round(Math.min(255, color[2] * f));
  return `rgb(${r}, ${g}, ${b})`;
}

function applyHeightTint(
  color: [number, number, number],
  h: number,
  biome: Biome
): [number, number, number] {
  let factor = 0.72 + h * 0.28;
  if (h < 0.35) factor *= 0.9;
  if (h > 0.72 && biome !== Biome.WATER) {
    const peak = (h - 0.72) / 0.28;
    if (biome === Biome.TUNDRA) {
      return [
        Math.round(color[0] + peak * 25),
        Math.round(color[1] + peak * 28),
        Math.round(color[2] + peak * 35),
      ];
    }
    if (biome === Biome.DESERT) {
      return [
        Math.round(color[0] - peak * 15),
        Math.round(color[1] - peak * 18),
        Math.round(color[2] - peak * 22),
      ];
    }
    return [
      Math.round(color[0] - peak * 20),
      Math.round(color[1] - peak * 22),
      Math.round(color[2] - peak * 25),
    ];
  }
  return [
    Math.round(color[0] * factor),
    Math.round(color[1] * factor),
    Math.round(color[2] * factor),
  ];
}

export class TerrainRenderer {
  private terrainTexture: Texture | null = null;
  private terrainSprite: Sprite | null = null;

  createTerrainTexture(worldData: WorldData): Texture {
    const { biomeGrid, waterMask, heightGrid, tileSize, cols, rows } = worldData;

    const canvas = document.createElement('canvas');
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d')!;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = c * tileSize;
        const y = r * tileSize;
        const biome = biomeGrid[idx] as Biome;
        const h = heightGrid[idx];

        if (biome === Biome.WATER || waterMask[idx]) {
          const depth = 0.85 + h * 0.15;
          ctx.fillStyle = shadeRgb(WATER_COLOR, depth);
          ctx.fillRect(x, y, tileSize, tileSize);
        } else {
          const biomeNames: Partial<Record<Biome, string>> = {
            [Biome.PLAINS]: 'plains',
            [Biome.FOREST]: 'forest',
            [Biome.DESERT]: 'desert',
            [Biome.TUNDRA]: 'tundra',
          };
          const biomeName = biomeNames[biome];
          const texture = biomeName ? AssetLoader.getTerrainTexture(biomeName) : null;
          const baseColor = BIOME_COLORS[biome];
          const tinted = applyHeightTint(baseColor, h, biome);

          if (texture) {
            const resource = texture.baseTexture.resource as { source?: HTMLImageElement };
            const img = resource.source;
            if (img && img.complete) {
              ctx.drawImage(img, x, y, tileSize, tileSize);
              ctx.fillStyle = `rgba(${tinted[0]}, ${tinted[1]}, ${tinted[2]}, 0.35)`;
              ctx.fillRect(x, y, tileSize, tileSize);
            } else {
              ctx.fillStyle = shadeRgb(tinted, 1);
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          } else {
            ctx.fillStyle = shadeRgb(tinted, 1);
            ctx.fillRect(x, y, tileSize, tileSize);
          }
        }
      }
    }

    this.drawCliffEdges(ctx, heightGrid, biomeGrid, waterMask, rows, cols, tileSize);

    const baseTexture = BaseTexture.from(canvas);
    return Texture.from(baseTexture);
  }

  private drawCliffEdges(
    ctx: CanvasRenderingContext2D,
    heightGrid: Float32Array,
    biomeGrid: Uint8Array,
    waterMask: boolean[],
    rows: number,
    cols: number,
    tileSize: number
  ): void {
    ctx.strokeStyle = 'rgba(20, 25, 30, 0.45)';
    ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));

    const isWater = (idx: number) =>
      biomeGrid[idx] === Biome.WATER || waterMask[idx];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (isWater(idx)) continue;
        const h = heightGrid[idx];
        const x = c * tileSize;
        const y = r * tileSize;

        if (c > 0) {
          const ni = r * cols + (c - 1);
          if (!isWater(ni) && h - heightGrid[ni] > CLIFF_THRESHOLD) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + tileSize);
            ctx.stroke();
          }
        }
        if (c < cols - 1) {
          const ni = r * cols + (c + 1);
          if (!isWater(ni) && h - heightGrid[ni] > CLIFF_THRESHOLD) {
            ctx.beginPath();
            ctx.moveTo(x + tileSize, y);
            ctx.lineTo(x + tileSize, y + tileSize);
            ctx.stroke();
          }
        }
        if (r > 0) {
          const ni = (r - 1) * cols + c;
          if (!isWater(ni) && h - heightGrid[ni] > CLIFF_THRESHOLD) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + tileSize, y);
            ctx.stroke();
          }
        }
        if (r < rows - 1) {
          const ni = (r + 1) * cols + c;
          if (!isWater(ni) && h - heightGrid[ni] > CLIFF_THRESHOLD) {
            ctx.beginPath();
            ctx.moveTo(x, y + tileSize);
            ctx.lineTo(x + tileSize, y + tileSize);
            ctx.stroke();
          }
        }
      }
    }
  }

  createTerrainSprite(worldData: WorldData, container: Container): Sprite {
    if (this.terrainTexture) {
      this.terrainTexture.destroy();
    }

    this.terrainTexture = this.createTerrainTexture(worldData);
    this.terrainSprite = new Sprite(this.terrainTexture);
    container.addChild(this.terrainSprite);

    return this.terrainSprite;
  }

  getSprite(): Sprite | null {
    return this.terrainSprite;
  }

  destroy(): void {
    if (this.terrainSprite) {
      this.terrainSprite.destroy();
      this.terrainSprite = null;
    }
    if (this.terrainTexture) {
      this.terrainTexture.destroy();
      this.terrainTexture = null;
    }
  }
}
