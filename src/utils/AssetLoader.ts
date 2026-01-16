/**
 * AssetLoader - Loads and caches game assets (images, fonts, etc.)
 */

import { Texture, BaseTexture, Assets } from 'pixi.js';

export class AssetLoader {
  private static foodTextures: Map<string, Texture[]> = new Map();
  private static terrainTextures: Map<string, Texture> = new Map();
  private static iconTextures: Map<string, Texture> = new Map();
  private static loaded: boolean = false;
  
  /**
   * Load all game assets
   */
  static async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    
    try {
      // Load food sprites by species and stage
      const foodSpecies: Array<{ name: string; folder: string; stages: string[] }> = [
        {
          name: 'cactus',
          folder: 'Desert',
          stages: ['Desertcactus4.png', 'Desertcactus3.png', 'desertcactus2.png', 'desertcactus1.png'],
        },
        {
          name: 'foresttree',
          folder: 'Forest',
          stages: ['ForestTree4.png', 'ForestTree3.png', 'Foresttree2.png', 'ForestTree1.png'],
        },
        {
          name: 'plainsshrub',
          folder: 'Plains',
          stages: ['PlainsShrub4.png', 'PlainsShrub3.png', 'PlainsShrub2.png', 'PlainsShrub1.png'],
        },
        {
          name: 'tundrabush',
          folder: 'Tundra',
          stages: ['TundraBush4.png', 'TundraBush3.png', 'TundraBush2.png', 'TundraBush1.png'],
        },
      ];
      
      for (const species of foodSpecies) {
        const textures: Texture[] = [];
        for (const stageFile of species.stages) {
          try {
            const path = `Assets/Tilesets for Terrain/${species.folder}/${stageFile}`;
            const texture = await Assets.load(path);
            textures.push(texture);
          } catch (e) {
            console.warn(`Failed to load food sprite: ${stageFile}`, e);
            // Create a placeholder texture
            textures.push(this.createPlaceholderTexture(32, 32, [0, 255, 0]));
          }
        }
        this.foodTextures.set(species.name, textures);
      }
      
      // Terrain floor textures don't exist in the assets folder
      // We'll use color fallbacks instead, so skip loading these
      
      // Load status icons
      try {
        const hungerIcon = await Assets.load('Assets/hunger.png');
        this.iconTextures.set('hunger', hungerIcon);
      } catch (e) {
        console.debug('Hunger icon not found, will skip');
      }
      
      // Load thirst icon
      try {
        const thirstIcon = await Assets.load('Assets/thirst.png');
        this.iconTextures.set('thirst', thirstIcon);
      } catch (e) {
        console.warn('Thirst icon not found, will skip');
      }
      
      // Load love icon for breeding
      try {
        const loveIcon = await Assets.load('Assets/love.png');
        this.iconTextures.set('love', loveIcon);
      } catch (e) {
        console.warn('Love icon not found, will skip');
      }
      
      // Load fetus icon for pregnancy
      try {
        const fetusIcon = await Assets.load('Assets/fetus.png');
        this.iconTextures.set('fetus', fetusIcon);
      } catch (e) {
        console.warn('Fetus icon not found, will skip');
      }
      
      // health.png doesn't exist, so we'll skip it
      // If you add it later, uncomment this:
      /*
      try {
        const healthIcon = await Assets.load('Assets/health.png');
        this.iconTextures.set('health', healthIcon);
      } catch (e) {
        console.debug('Health icon not found, will skip');
      }
      */
      
      this.loaded = true;
      console.log('Assets loaded successfully');
    } catch (error) {
      console.error('Error loading assets:', error);
      // Continue anyway with placeholders
      this.loaded = true;
    }
  }
  
  /**
   * Get food texture for a species and stage (1-4, where 4 is full)
   */
  static getFoodTexture(species: string, stage: number): Texture | null {
    const textures = this.foodTextures.get(species);
    if (!textures || textures.length === 0) {
      return null;
    }
    
    // Stage is remainingSlots + 1 (3->4, 2->3, 1->2, 0->1)
    const index = Math.max(0, Math.min(textures.length - 1, stage - 1));
    return textures[index] || textures[0];
  }
  
  /**
   * Get terrain floor texture for a biome
   */
  static getTerrainTexture(biome: string): Texture | null {
    return this.terrainTextures.get(biome) || null;
  }
  
  /**
   * Get status icon texture
   */
  static getIconTexture(name: string): Texture | null {
    return this.iconTextures.get(name) || null;
  }
  
  /**
   * Create a placeholder texture
   */
  private static createPlaceholderTexture(width: number, height: number, color: [number, number, number]): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.fillRect(0, 0, width, height);
    return Texture.from(canvas);
  }
}
