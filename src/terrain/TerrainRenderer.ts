/**
 * TerrainRenderer - Renders terrain to a canvas/texture
 */

import { Texture, BaseTexture, Sprite, Container } from 'pixi.js';
import { Biome, BIOME_COLORS, WATER_COLOR } from './Biome';
import { WorldData } from './WorldGenerator';
import { AssetLoader } from '../utils/AssetLoader';

export class TerrainRenderer {
  private terrainTexture: Texture | null = null;
  private terrainSprite: Sprite | null = null;
  
  createTerrainTexture(worldData: WorldData): Texture {
    const { biomeGrid, waterMask, tileSize, cols, rows } = worldData;
    
    // Create canvas for terrain
    const canvas = document.createElement('canvas');
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d')!;
    
    // Draw terrain tiles
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = c * tileSize;
        const y = r * tileSize;
        
        const biome = biomeGrid[idx] as Biome;
        
        // Check if water (either from biome or legacy waterMask)
        if (biome === Biome.WATER || waterMask[idx]) {
          // Draw water
          ctx.fillStyle = `rgb(${WATER_COLOR[0]}, ${WATER_COLOR[1]}, ${WATER_COLOR[2]})`;
          ctx.fillRect(x, y, tileSize, tileSize);
        } else {
          // Draw biome - try to use texture, fallback to color
          const biomeNames: Record<Biome, string> = {
            [Biome.PLAINS]: 'plains',
            [Biome.FOREST]: 'forest',
            [Biome.DESERT]: 'desert',
            [Biome.TUNDRA]: 'tundra',
          };
          const biomeName = biomeNames[biome];
          const texture = biomeName ? AssetLoader.getTerrainTexture(biomeName) : null;
          
          if (texture) {
            // Draw texture
            const img = texture.baseTexture.resource.source as HTMLImageElement;
            if (img && img.complete) {
              ctx.drawImage(img, x, y, tileSize, tileSize);
            } else {
              // Fallback to color while loading
              const color = BIOME_COLORS[biome];
              ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          } else {
            // Fallback to color
            const color = BIOME_COLORS[biome];
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, tileSize, tileSize);
          }
        }
      }
    }
    
    // Create texture from canvas
    const baseTexture = BaseTexture.from(canvas);
    return Texture.from(baseTexture);
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
