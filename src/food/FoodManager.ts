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
  /** Target sum of maxSlots across all food plants after spawning (world "eatable capacity"). */
  private targetMaxEatableSlots: number;

  private foods: Food[] = [];
  private decorativeTrees: DecorativeTree[] = []; // Non-food decorative trees
  private mapWidth: number;
  private mapHeight: number;
  private currentTime: number = 0.0;
  
  // Spatial index (uniform grid)
  private cellSize: number = 64;
  private grid: Map<string, Food[]> = new Map();
  
  constructor(mapWidth: number, mapHeight: number, targetMaxEatableSlots: number = 200) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.targetMaxEatableSlots = Math.max(0, Math.floor(targetMaxEatableSlots));
  }
  
  /**
   * Manhattan steps from each land tile to the nearest water tile (water tiles get 0).
   * Unused / unreachable land stays at INF (e.g. no water on map).
   */
  static tileStepsToNearestWater(biomeGrid: Uint8Array, cols: number, rows: number): Int16Array {
    const WATER = 5;
    const INF = 30000;
    const dist = new Int16Array(rows * cols).fill(INF);
    const q: number[] = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (biomeGrid[i] === WATER) {
          dist[i] = 0;
          q.push(i);
        }
      }
    }
    
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const d = dist[i];
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const ni = nr * cols + nc;
        if (biomeGrid[ni] === WATER) continue;
        const nd = d + 1;
        if (dist[ni] <= nd) continue;
        dist[ni] = nd;
        q.push(ni);
      }
    }
    
    return dist;
  }
  
  /**
   * Multiplier for food spawn on land far from drinking water (plains/forest/tundra mainly).
   */
  static foodScarcityFromWaterSteps(steps: number): number {
    if (steps >= 30000) return 0.4;
    if (steps >= 15) return 0.38;
    if (steps >= 9) return 0.55;
    if (steps >= 4) return 0.78;
    return 1.0;
  }
  
  /** Sum of maxSlots for all food plants (total eatable capacity when full). */
  totalMaxEatableSlots(): number {
    return this.foods.reduce((s, f) => s + f.maxSlots, 0);
  }

  private shuffleFoodsInPlace(): void {
    const a = this.foods;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  private trimFoodsToTargetMaxSlots(target: number): void {
    if (this.foods.length === 0) return;
    this.shuffleFoodsInPlace();
    while (this.totalMaxEatableSlots() > target && this.foods.length > 0) {
      this.foods.pop();
    }
  }

  private growFoodsToTargetMaxSlots(
    landIndices: number[],
    biomeGrid: Uint8Array,
    tilesToWater: Int16Array,
    tileSize: number,
    cols: number,
    target: number
  ): void {
    if (landIndices.length === 0) return;
    const maxAttempts = Math.min(80000, Math.max(5000, landIndices.length * 30));
    for (let attempt = 0; attempt < maxAttempts && this.totalMaxEatableSlots() < target; attempt++) {
      const idx = landIndices[Math.floor(Math.random() * landIndices.length)];
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      this.rollFoodSpawnsForLandTile(r, c, cols, tileSize, tilesToWater, biomeGrid);
    }
  }

  private normalizeFoodToTarget(
    landIndices: number[],
    biomeGrid: Uint8Array,
    tilesToWater: Int16Array,
    tileSize: number,
    cols: number
  ): void {
    const target = this.targetMaxEatableSlots;
    if (target <= 0) {
      this.foods = [];
      return;
    }
    this.trimFoodsToTargetMaxSlots(target);
    this.growFoodsToTargetMaxSlots(landIndices, biomeGrid, tilesToWater, tileSize, cols, target);
    this.trimFoodsToTargetMaxSlots(target);
  }

  /**
   * One tile's biome rolls (same rules as initial world pass). Land tile only.
   */
  private rollFoodSpawnsForLandTile(
    r: number,
    c: number,
    cols: number,
    tileSize: number,
    tilesToWater: Int16Array,
    biomeGrid: Uint8Array
  ): void {
    const PLAINS = 1;
    const FOREST = 2;
    const DESERT = 3;
    const TUNDRA = 4;

    const idx = r * cols + c;
    const biome = biomeGrid[idx];
    const scarcity = FoodManager.foodScarcityFromWaterSteps(tilesToWater[idx]);

    const jitter = () => (Math.random() - 0.5) * tileSize * 0.35;
    const x = (c + 0.5) * tileSize + jitter();
    const y = (r + 0.5) * tileSize + jitter();
    const scale = 0.75 + Math.random() * 0.5;

    if (biome === FOREST) {
      const pAnyTree = 0.50 * scarcity;
      const pFoodTree = 0.09 * scarcity;
      const treeRoll = Math.random();
      if (treeRoll < pFoodTree) {
        this.foods.push(new Food(x, y, 'foresttree', scale, Math.random() < 0.5));
      } else if (treeRoll < pAnyTree) {
        this.decorativeTrees.push({ x, y, species: 'foresttree', scale, flipH: Math.random() < 0.5 });
      }
    } else if (biome === PLAINS) {
      if (Math.random() < 0.10 * scarcity) {
        this.foods.push(new Food(x, y, 'plainsshrub', scale, Math.random() < 0.5));
      }
    } else if (biome === TUNDRA) {
      const st = 0.06 * scarcity;
      if (Math.random() < st) {
        this.foods.push(new Food(x, y, 'tundratree', scale, Math.random() < 0.5));
      }
      if (Math.random() < st) {
        this.foods.push(new Food(x, y, 'foresttree', scale, Math.random() < 0.5));
      }
    } else if (biome === DESERT) {
      const desertScarcity = 0.72 + 0.28 * scarcity;
      if (Math.random() < 0.10 * desertScarcity) {
        this.foods.push(new Food(x, y, 'cactus', scale, Math.random() < 0.5));
      }
    }
  }

  private spawnFoodFallbackNoBiome(): void {
    this.foods = [];
    const target = this.targetMaxEatableSlots;
    if (target <= 0) {
      this.rebuildGrid();
      return;
    }
    while (this.totalMaxEatableSlots() < target) {
      const x = 50 + Math.random() * (this.mapWidth - 100);
      const y = 50 + Math.random() * (this.mapHeight - 100);
      this.foods.push(new Food(x, y));
    }
    this.trimFoodsToTargetMaxSlots(target);
    this.rebuildGrid();
  }

  spawnFood(biomeGrid?: Uint8Array, tileSize: number = 32, cols?: number, rows?: number): void {
    this.foods = [];
    this.decorativeTrees = [];
    this.grid.clear();
    
    if (!biomeGrid || !cols || !rows) {
      this.spawnFoodFallbackNoBiome();
      return;
    }
    
    const tilesToWater = FoodManager.tileStepsToNearestWater(biomeGrid, cols, rows);
    const landIndices: number[] = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const biome = biomeGrid[idx];
        if (biome === 5) continue; // WATER
        landIndices.push(idx);
        this.rollFoodSpawnsForLandTile(r, c, cols, tileSize, tilesToWater, biomeGrid);
      }
    }
    
    this.normalizeFoodToTarget(landIndices, biomeGrid, tilesToWater, tileSize, cols);
    
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
  eatFoodAtPosition(x: number, y: number, radius: number = 10, intelligence: number = 0.5, metabolism: number = 0.5): { hungerGain: number; thirstGain: number; healthDamage?: number; species?: FoodSpecies } | null {
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
    
    const result: { hungerGain: number; thirstGain: number; healthDamage?: number; species?: FoodSpecies } = { hungerGain, thirstGain, species: food.species };
    
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
