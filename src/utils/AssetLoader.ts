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
      // File numbering: 1 = empty (no food), N = full (all slots available)
      // Forest Tree: 1-5 (5 = full with 4 slots, 1 = empty)
      // Cactus: 1-4 (4 = full with 3 slots, 1 = empty)
      // Plains Shrub: 1-4 (4 = full with 3 slots, 1 = empty)
      // Tundra Tree: 1-3 (3 = full with 2 slots, 1 = empty)
      const foodSpecies: Array<{ name: string; folder: string; subfolder: string; stages: string[] }> = [
        {
          name: 'cactus',
          folder: 'Desert',
          subfolder: 'DesertCactus',
          stages: ['desertcactus1.PNG', 'desertcactus2.PNG', 'desertcactus3.PNG', 'desertcactus4.PNG'], // 1=empty, 2=1slot, 3=2slots, 4=full(3slots)
        },
        {
          name: 'foresttree',
          folder: 'Forest',
          subfolder: 'ForestTree',
          stages: ['foresttree1.PNG', 'foresttree2.PNG', 'foresttree3.PNG', 'foresttree4.PNG', 'foresttree5.PNG'], // 1=empty, 2=1slot, 3=2slots, 4=3slots, 5=full(4slots)
        },
        {
          name: 'plainsshrub',
          folder: 'Plains',
          subfolder: 'PlainsShrub',
          stages: ['plainsshrub1.PNG', 'plainsshrub2.PNG', 'plainsshrub3.PNG', 'plainsshrubs4.PNG'], // 1=empty, 2=1slot, 3=2slots, 4=full(3slots)
        },
        {
          name: 'tundratree',
          folder: 'Tundra',
          subfolder: 'TundraTree',
          stages: ['tundratree1.PNG', 'tundratree2.PNG', 'tundratree3.PNG'], // 1=empty, 2=1slot, 3=full(2slots)
        },
      ];
      
      for (const species of foodSpecies) {
        const textures: Texture[] = [];
        for (const stageFile of species.stages) {
          try {
            const path = `Assets/Tilesets for Terrain/${species.folder}/${species.subfolder}/${stageFile}`;
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
   * Get food texture for a species based on remaining slots
   * PNG files are numbered 1-N where:
   *   - File 1 = empty (0 slots)
   *   - File 2 = 1 slot remaining
   *   - File 3 = 2 slots remaining
   *   - ...
   *   - File N = full (maxSlots remaining)
   * 
   * Textures are stored in order: [file 1, file 2, ..., file N]
   * So: textureIndex = remainingSlots (0 = file 1, 1 = file 2, etc.)
   * Special case: Forest Tree has 5 files for 4 slots, so file 5 = 4 slots
   */
  static getFoodTexture(species: string, remainingSlots: number): Texture | null {
    const textures = this.foodTextures.get(species);
    if (!textures || textures.length === 0) {
      return null;
    }
    
    // File number = remainingSlots + 1
    // For forest tree: 4 slots = file 5, so we need to handle that
    let fileNumber: number;
    if (species === 'foresttree') {
      // Forest tree: 0 slots = file 1, 1 slot = file 2, 2 slots = file 3, 3 slots = file 4, 4 slots = file 5
      fileNumber = Math.min(remainingSlots + 1, 5);
    } else {
      // Other species: file number = remainingSlots + 1, capped at max file number
      const maxFileNumber = textures.length;
      fileNumber = Math.min(remainingSlots + 1, maxFileNumber);
    }
    
    // Textures stored as [file 1, file 2, ..., file N]
    // So index = fileNumber - 1
    const textureIndex = fileNumber - 1;
    
    return textures[textureIndex] || textures[0];
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
