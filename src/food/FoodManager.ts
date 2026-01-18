/**
 * FoodManager - Manages all food items with spatial indexing
 */

import { Food, FoodSpecies } from './Food';

export interface FoodStats {
  available_food: number;
  total_food: number;
  eaten_food: number;
  respawning_soon: number;
}

export interface DecorativeTree {
  x: number;
  y: number;
  species: 'foresttree';
  /** Visual scale (0.75–1.25) for size variation. */
  scale: number;
  /** Flip horizontally for variation. */
  flipH: boolean;
}

export class FoodManager {
  private foods: Food[] = [];
  private decorativeTrees: DecorativeTree[] = []; // Non-food decorative trees
  private mapWidth: number;
  private mapHeight: number;
  private maxFoodUnits: number;
  private currentTime: number = 0.0;
  
  // Spatial index (uniform grid)
  private cellSize: number = 64;
  private grid: Map<string, Food[]> = new Map();
  
  constructor(mapWidth: number, mapHeight: number, foodCount: number = 0) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    // foodCount is no longer used - food spawns based on biome tiles
    this.maxFoodUnits = 0;
  }
  
  spawnFood(biomeGrid?: Uint8Array, tileSize: number = 32, cols?: number, rows?: number): void {
    // Clear existing food and decorative trees
    this.foods = [];
    this.decorativeTrees = [];
    this.grid.clear();
    
    if (!biomeGrid || !cols || !rows) {
      // Fallback: spawn food randomly if no biome data
      const numSprites = Math.ceil(this.maxFoodUnits / 3);
      for (let i = 0; i < numSprites; i++) {
        const x = 50 + Math.random() * (this.mapWidth - 100);
        const y = 50 + Math.random() * (this.mapHeight - 100);
        this.foods.push(new Food(x, y));
      }
      this.rebuildGrid();
      return;
    }
    
    // Biome enum values
    const PLAINS = 1;
    const FOREST = 2;
    const DESERT = 3;
    const TUNDRA = 4;
    const WATER = 5;
    
    // Iterate through each tile and spawn food based on biome probabilities
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const biome = biomeGrid[idx];
        
        // Skip water tiles
        if (biome === WATER) {
          continue;
        }
        
        // Tile center + small random offset so vegetation isn’t perfectly gridded
        const jitter = () => (Math.random() - 0.5) * tileSize * 0.35;
        const x = (c + 0.5) * tileSize + jitter();
        const y = (r + 0.5) * tileSize + jitter();
        const scale = 0.75 + Math.random() * 0.5; // 0.75–1.25
        
        // Biome-specific spawn rates (reduced so food/plants aren’t on almost every tile)
        if (biome === FOREST) {
          // Forest: 50% chance of any tree; ~18% of those are food (9% food, 41% decorative)
          const treeRoll = Math.random();
          if (treeRoll < 0.50) {
            if (treeRoll < 0.09) {
              this.foods.push(new Food(x, y, 'foresttree', scale, Math.random() < 0.5));
            } else {
              this.decorativeTrees.push({ x, y, species: 'foresttree', scale, flipH: Math.random() < 0.5 });
            }
          }
        } else if (biome === PLAINS) {
          if (Math.random() < 0.10) {
            this.foods.push(new Food(x, y, 'plainsshrub', scale, Math.random() < 0.5));
          }
        } else if (biome === TUNDRA) {
          if (Math.random() < 0.06) {
            this.foods.push(new Food(x, y, 'tundratree', scale, Math.random() < 0.5));
          }
          if (Math.random() < 0.06) {
            this.foods.push(new Food(x, y, 'foresttree', scale, Math.random() < 0.5));
          }
        } else if (biome === DESERT) {
          if (Math.random() < 0.10) {
            this.foods.push(new Food(x, y, 'cactus', scale, Math.random() < 0.5));
          }
        }
      }
    }
    
    this.rebuildGrid();
  }
  
  private rebuildGrid(): void {
    this.grid.clear();
    for (const food of this.foods) {
      const cx = Math.floor(food.x / this.cellSize);
      const cy = Math.floor(food.y / this.cellSize);
      const key = `${cx},${cy}`;
      
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push(food);
    }
  }
  
  private *iterCellsInRadius(x: number, y: number, radius: number): Generator<string> {
    const minCx = Math.floor(Math.max(0, x - radius) / this.cellSize);
    const maxCx = Math.floor(Math.min(this.mapWidth - 1, x + radius) / this.cellSize);
    const minCy = Math.floor(Math.max(0, y - radius) / this.cellSize);
    const maxCy = Math.floor(Math.min(this.mapHeight - 1, y + radius) / this.cellSize);
    
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        yield `${cx},${cy}`;
      }
    }
  }
  
  update(dt: number): void {
    this.currentTime += dt;
    
    // Regenerate slots over time per-species
    for (const food of this.foods) {
      if (food.shouldRegen(this.currentTime)) {
        food.respawn(this.currentTime);
        food.lastRegenTime = this.currentTime;
      }
    }
  }
  
  getFoodAtPosition(x: number, y: number, radius: number = 10): Food | null {
    for (const cellKey of this.iterCellsInRadius(x, y, radius)) {
      const foods = this.grid.get(cellKey) || [];
      for (const food of foods) {
        if (food.isAvailable()) {
          const effectiveRadius = Math.max(radius, food.radius);
          const distance = Math.sqrt((food.x - x) ** 2 + (food.y - y) ** 2);
          if (distance <= effectiveRadius) {
            return food;
          }
        }
      }
    }
    return null;
  }
  
  getNearestFood(x: number, y: number, visionRadius: number): Food | null {
    let nearestFood: Food | null = null;
    let nearestDistance = Infinity;
    
    for (const cellKey of this.iterCellsInRadius(x, y, visionRadius)) {
      const foods = this.grid.get(cellKey) || [];
      for (const food of foods) {
        if (!food.isAvailable()) {
          continue;
        }
        
        const dx = food.x - x;
        const dy = food.y - y;
        const d2 = dx * dx + dy * dy;
        
        if (d2 <= visionRadius * visionRadius && d2 < nearestDistance) {
          nearestDistance = d2;
          nearestFood = food;
        }
      }
    }
    
    return nearestFood;
  }
  
  /**
   * Find the nearest cactus (for thirst in desert)
   */
  getNearestCactus(x: number, y: number, visionRadius: number): Food | null {
    let nearestCactus: Food | null = null;
    let nearestDistance = Infinity;
    
    for (const cellKey of this.iterCellsInRadius(x, y, visionRadius)) {
      const foods = this.grid.get(cellKey) || [];
      for (const food of foods) {
        if (!food.isAvailable() || food.species !== 'cactus') {
          continue;
        }
        
        const dx = food.x - x;
        const dy = food.y - y;
        const d2 = dx * dx + dy * dy;
        
        if (d2 <= visionRadius * visionRadius && d2 < nearestDistance) {
          nearestDistance = d2;
          nearestCactus = food;
        }
      }
    }
    
    return nearestCactus;
  }
  
  /** Returns { hungerGain, thirstGain, healthDamage? } or null. Cactus: healthDamage, intelligence reduces prick. Tundratree (lichen): hungerGain scaled by metabolism (slow=more, fast=less). */
  eatFoodAtPosition(x: number, y: number, radius: number = 10, intelligence: number = 0.5, metabolism: number = 0.5): { hungerGain: number; thirstGain: number; healthDamage?: number } | null {
    const food = this.getFoodAtPosition(x, y, radius);
    if (!food) return null;
    
    const nutrition = food.eat(this.currentTime);
    if (!nutrition) return null;
    
    let [hungerGain, thirstGain] = nutrition;
    
    // Tundratree (lichen): more hunger for slow metabolism, less for fast. (1.8 - 0.8*metabolism): 0->1.8x, 1->1x
    if (food.species === 'tundratree') {
      const lichenMultiplier = Math.max(0.5, 1.8 - 0.8 * metabolism);
      hungerGain *= lichenMultiplier;
    }
    
    const result: { hungerGain: number; thirstGain: number; healthDamage?: number } = { hungerGain, thirstGain };
    
    // Cactus: spines can prick. Higher intelligence = lower chance. Cactus never restores health.
    if (food.species === 'cactus') {
      const harmChance = Math.max(0, 1 - intelligence); // 0 intel = 100% harm, 1 intel = 0% harm
      if (Math.random() < harmChance) {
        result.healthDamage = 15; // Fixed prick damage
      }
    }
    
    return result;
  }
  
  getAvailableFood(): Food[] {
    return this.foods.filter(f => f.isAvailable());
  }
  
  getAllFood(): Food[] {
    return this.foods;
  }
  
  getDecorativeTrees(): DecorativeTree[] {
    return this.decorativeTrees;
  }
  
  getFoodCount(): number {
    return this.foods.reduce((sum, f) => sum + (f.isAvailable() ? f.remainingSlots : 0), 0);
  }
  
  getTotalFoodCount(): number {
    return this.foods.reduce((sum, f) => sum + (f.maxSlots || 3), 0);
  }
  
  getStats(): FoodStats {
    const availableUnits = this.getFoodCount();
    const totalUnits = this.getTotalFoodCount();
    
    const respawningSoon = this.foods.filter(
      f => f.eaten && (this.currentTime - f.eatenTime) >= 10.0
    ).length;
    
    return {
      available_food: availableUnits,
      total_food: totalUnits,
      eaten_food: totalUnits - availableUnits,
      respawning_soon: respawningSoon,
    };
  }
}
