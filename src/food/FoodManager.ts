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

export class FoodManager {
  private foods: Food[] = [];
  private mapWidth: number;
  private mapHeight: number;
  private maxFoodUnits: number;
  private currentTime: number = 0.0;
  
  // Spatial index (uniform grid)
  private cellSize: number = 64;
  private grid: Map<string, Food[]> = new Map();
  
  constructor(mapWidth: number, mapHeight: number, foodCount: number = 100) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.maxFoodUnits = Math.max(0, foodCount);
  }
  
  spawnFood(biomeGrid?: Uint8Array, tileSize: number = 32, biomeWidth?: number): void {
    // Clear existing food
    this.foods = [];
    this.grid.clear();
    
    // Number of sprites = ceil(units / 3)
    const numSprites = Math.ceil(this.maxFoodUnits / 3);
    
    const speciesForBiome: Record<number, FoodSpecies> = {
      1: 'plainsshrub',  // Plains
      2: 'foresttree',   // Forest
      3: 'cactus',        // Desert
      4: 'tundrabush',    // Tundra
    };
    
    for (let i = 0; i < numSprites; i++) {
      const x = 50 + Math.random() * (this.mapWidth - 100);
      const y = 50 + Math.random() * (this.mapHeight - 100);
      
      let species: FoodSpecies | undefined;
      if (biomeGrid && biomeWidth) {
        // Sample biome at this position
        const cx = Math.max(0, Math.min(biomeWidth - 1, Math.floor(x / tileSize)));
        const cy = Math.max(0, Math.min(Math.floor(biomeGrid.length / biomeWidth) - 1, Math.floor(y / tileSize)));
        const biomeId = biomeGrid[cy * biomeWidth + cx];
        species = speciesForBiome[biomeId];
      }
      
      this.foods.push(new Food(x, y, species));
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
  
  eatFoodAtPosition(x: number, y: number, radius: number = 10): [number, number] | null {
    const food = this.getFoodAtPosition(x, y, radius);
    if (food) {
      return food.eat(this.currentTime);
    }
    return null;
  }
  
  getAvailableFood(): Food[] {
    return this.foods.filter(f => f.isAvailable());
  }
  
  getAllFood(): Food[] {
    return this.foods;
  }
  
  getFoodCount(): number {
    return this.foods.reduce((sum, f) => sum + (f.isAvailable() ? f.remainingSlots : 0), 0);
  }
  
  getTotalFoodCount(): number {
    return this.foods.length * 3;
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
