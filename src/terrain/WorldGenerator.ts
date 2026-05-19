/**
 * WorldGenerator - Wave Function Collapse (WFC) based terrain generation
 * Uses constraint propagation to generate coherent biome patterns
 */

import { Biome } from './Biome';
import { WaterMap } from './WaterMap';
import {
  MIN_LAND_SURFACE_HEIGHT,
  WATER_SURFACE_HEIGHT,
} from '../render/ViewProjection';

export interface TerrainSettings {
  biome_scale: number;
  biome_weights: {
    plains: number;
    forest: number;
    desert: number;
    tundra: number;
  };
  pond_chance: number;
  river_chance: number;
  river_width: number;
  /** Tile size in world units. Larger = fewer, bigger tiles. Trees/food render at their own size. Default 64. */
  tile_size?: number;
}

export interface WorldData {
  biomeGrid: Uint8Array;
  waterMask: boolean[];
  /** Per-tile elevation 0–1 (rivers/valleys low, peaks high). */
  heightGrid: Float32Array;
  tileSize: number;
  rows: number;
  cols: number;
  width: number;
  height: number;
}

/** Unit-float PRNG stream in [0, 1). */
export type Rng = () => number;

/** Mulberry32 — deterministic from a 32-bit seed. */
export function createMulberry32(seed: number): Rng {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix32(seed: number, salt: number): number {
  return (Math.imul(seed ^ salt, 0x9e3779b1) >>> 0) || 1;
}

/** Normalize caller seed; if undefined, caller should use resolveWorldSeed first. */
export function resolveWorldSeed(seed?: number): number {
  if (seed !== undefined && Number.isFinite(seed)) {
    const n = Math.trunc(Number(seed));
    return (n >>> 0) || 1;
  }
  return (Math.floor(Math.random() * 0xffffffff) ^ (Date.now() & 0xffffffff)) >>> 0 || 1;
}

/**
 * Biome adjacency rules for WFC
 * Each biome has a list of biomes that can be adjacent to it
 * Rules are symmetric (if A can be next to B, then B can be next to A)
 * Stricter rules yield larger readable biomes (forest/desert never share an edge, etc.).
 */
const BIOME_ADJACENCY_RULES: Record<Biome, Biome[]> = {
  // Stricter edges so regions read as “places”: harsh biomes need plains or water as buffer, not each other.
  [Biome.PLAINS]: [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER],
  [Biome.FOREST]: [Biome.PLAINS, Biome.FOREST, Biome.TUNDRA, Biome.WATER],
  [Biome.DESERT]: [Biome.PLAINS, Biome.DESERT, Biome.WATER],
  [Biome.TUNDRA]: [Biome.PLAINS, Biome.FOREST, Biome.TUNDRA, Biome.WATER],
  [Biome.WATER]: [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER],
};

/**
 * Check if two biomes can be adjacent
 */
function canBeAdjacent(biome1: Biome, biome2: Biome): boolean {
  return BIOME_ADJACENCY_RULES[biome1].includes(biome2);
}

/**
 * Get all possible neighbors for a given biome
 */
function getPossibleNeighbors(biome: Biome): Set<Biome> {
  return new Set(BIOME_ADJACENCY_RULES[biome]);
}

/**
 * WFC Cell - represents a cell in superposition
 */
class WFCCell {
  public possibleBiomes: Set<Biome>;
  public collapsed: boolean = false;
  public collapsedBiome: Biome | null = null;
  public entropy: number = 0;
  public neighborBiomeWeights: Map<Biome, number> = new Map(); // Track weights from neighboring biomes
  
  constructor(initialBiomes: Biome[], private readonly rng: Rng) {
    this.possibleBiomes = new Set(initialBiomes);
    this.updateEntropy();
  }
  
  /**
   * Calculate entropy (uncertainty) of this cell
   * Lower entropy = fewer possibilities = more constrained
   */
  updateEntropy(): void {
    if (this.collapsed) {
      this.entropy = 0;
      return;
    }
    
    const count = this.possibleBiomes.size;
    if (count === 0) {
      this.entropy = Infinity; // Contradiction
    } else if (count === 1) {
      this.entropy = 0; // Already determined
    } else {
      // Entropy = -sum(p * log(p)) where p = 1/count
      // Simplified: log(count) with small random noise to break ties
      this.entropy = Math.log(count) + this.rng() * 0.0001;
    }
  }
  
  /**
   * Add weight from a neighboring biome (persistence mechanism)
   */
  addNeighborWeight(biome: Biome, weight: number): void {
    const current = this.neighborBiomeWeights.get(biome) || 0;
    this.neighborBiomeWeights.set(biome, current + weight);
  }
  
  /**
   * Collapse this cell to a single biome
   * @param biomeWeights Base weights for each biome
   * @param persistenceMultiplier How much to weight same-biome neighbors (default 2.0 = double weight)
   */
  collapse(biomeWeights: Map<Biome, number>, persistenceMultiplier: number = 2.0): void {
    if (this.collapsed || this.possibleBiomes.size === 0) {
      return;
    }
    
    // Weighted random selection based on biome weights + neighbor persistence
    const biomes = Array.from(this.possibleBiomes);
    const weights = biomes.map(b => {
      const baseWeight = biomeWeights.get(b) || 1.0;
      // If this biome has neighbors of the same type, boost its weight
      const neighborWeight = this.neighborBiomeWeights.get(b) || 0;
      return baseWeight * (1.0 + neighborWeight * persistenceMultiplier);
    });
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    if (totalWeight === 0) {
      // Fallback to first available biome
      this.collapsedBiome = biomes[0];
    } else {
      let random = this.rng() * totalWeight;
      let selectedBiome = biomes[0];
      
      for (let i = 0; i < biomes.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          selectedBiome = biomes[i];
          break;
        }
      }
      
      this.collapsedBiome = selectedBiome;
    }
    
    this.possibleBiomes = new Set([this.collapsedBiome]);
    this.collapsed = true;
    this.entropy = 0;
  }
  
  /**
   * Constrain this cell based on neighbor's biome
   * Returns true if cell was modified
   */
  constrainByNeighbor(neighborBiome: Biome): boolean {
    if (this.collapsed) {
      return false;
    }
    
    const beforeSize = this.possibleBiomes.size;
    
    // Keep only biomes that can be adjacent to the neighbor
    const allowedNeighbors = getPossibleNeighbors(neighborBiome);
    this.possibleBiomes = new Set(
      Array.from(this.possibleBiomes).filter(b => allowedNeighbors.has(b))
    );
    
    this.updateEntropy();
    return this.possibleBiomes.size < beforeSize;
  }
}

function forceWaterCell(
  grid: WFCCell[][],
  r: number,
  c: number,
  minDesertDistGrid: Float32Array,
  cols: number,
  coreRadius: number
): void {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0]!.length) return;
  if (minDesertDistGrid[r * cols + c] < coreRadius * 0.78) return;
  const cell = grid[r][c];
  cell.possibleBiomes = new Set([Biome.WATER]);
  cell.collapsedBiome = Biome.WATER;
  cell.collapsed = true;
  cell.entropy = 0;
}

/**
 * River runs along columns (mostly E–W); each slice picks a low-elevation band + gentle meander.
 */
function carveValleyRiverAcrossColumns(
  grid: WFCCell[][],
  elevation: Float32Array,
  rows: number,
  cols: number,
  worldSeed: number,
  halfWidth: number,
  rngRiver: Rng,
  minDesertDistGrid: Float32Array,
  coreRadius: number
): void {
  const colNoise = generateNoise(cols, 1, 2, 0.65, 1.2, rngRiver);
  const s = worldSeed % 997;
  let prevRow = Math.floor(rows * (0.48 + 0.12 * Math.sin(s * 0.07)));
  prevRow = Math.max(halfWidth, Math.min(rows - 1 - halfWidth, prevRow));
  const searchRadius = 2 + halfWidth * 2;

  for (let c = 0; c < cols; c++) {
    const t = cols <= 1 ? 0.5 : c / (cols - 1);
    const meander =
      rows *
      (0.06 * Math.sin(2 * Math.PI * t * 1.5 + (worldSeed % 501) * 0.03) +
        0.025 * (colNoise[c] - 0.5));
    let target = Math.round(prevRow + meander);
    target = Math.max(halfWidth, Math.min(rows - 1 - halfWidth, target));

    let bestRow = target;
    let bestCost = Infinity;
    const lo = Math.max(halfWidth, target - searchRadius);
    const hi = Math.min(rows - 1 - halfWidth, target + searchRadius);
    for (let r = lo; r <= hi; r++) {
      let cost = 0;
      for (let dc = -halfWidth; dc <= halfWidth; dc++) {
        const cc = Math.max(0, Math.min(cols - 1, c + dc));
        cost += elevation[r * cols + cc];
      }
      cost /= halfWidth * 2 + 1;
      if (cost < bestCost) {
        bestCost = cost;
        bestRow = r;
      }
    }
    prevRow = bestRow;

    for (let dr = -halfWidth; dr <= halfWidth; dr++) {
      for (let dc = -halfWidth; dc <= halfWidth; dc++) {
        forceWaterCell(grid, bestRow + dr, c + dc, minDesertDistGrid, cols, coreRadius);
      }
    }
  }
}

/**
 * River runs along rows (mostly N–S); same valley bias, perpendicular carve direction.
 */
function carveValleyRiverAcrossRows(
  grid: WFCCell[][],
  elevation: Float32Array,
  rows: number,
  cols: number,
  worldSeed: number,
  halfWidth: number,
  rngRiver: Rng,
  minDesertDistGrid: Float32Array,
  coreRadius: number
): void {
  const rowNoise = generateNoise(rows, 1, 2, 0.65, 1.2, rngRiver);
  const s = worldSeed % 997;
  let prevCol = Math.floor(cols * (0.48 + 0.12 * Math.sin(s * 0.05)));
  prevCol = Math.max(halfWidth, Math.min(cols - 1 - halfWidth, prevCol));
  const searchRadius = 2 + halfWidth * 2;

  for (let r = 0; r < rows; r++) {
    const t = rows <= 1 ? 0.5 : r / (rows - 1);
    const meander =
      cols *
      (0.06 * Math.sin(2 * Math.PI * t * 1.5 + (worldSeed % 501) * 0.03) +
        0.025 * (rowNoise[r] - 0.5));
    let target = Math.round(prevCol + meander);
    target = Math.max(halfWidth, Math.min(cols - 1 - halfWidth, target));

    let bestCol = target;
    let bestCost = Infinity;
    const lo = Math.max(halfWidth, target - searchRadius);
    const hi = Math.min(cols - 1 - halfWidth, target + searchRadius);
    for (let c = lo; c <= hi; c++) {
      let cost = 0;
      for (let dr = -halfWidth; dr <= halfWidth; dr++) {
        const rr = Math.max(0, Math.min(rows - 1, r + dr));
        cost += elevation[rr * cols + c];
      }
      cost /= halfWidth * 2 + 1;
      if (cost < bestCost) {
        bestCost = cost;
        bestCol = c;
      }
    }
    prevCol = bestCol;

    for (let dr = -halfWidth; dr <= halfWidth; dr++) {
      for (let dc = -halfWidth; dc <= halfWidth; dc++) {
        forceWaterCell(grid, r + dr, bestCol + dc, minDesertDistGrid, cols, coreRadius);
      }
    }
  }
}

/**
 * Turn wet, low-elevation land bowls into contiguous lakes (mutates grid in place).
 */
function growNaturalLakes(
  grid: Uint8Array,
  elevation: Float32Array,
  moisture: Float32Array,
  rows: number,
  cols: number,
  pondChance: number
): void {
  const wet = (i: number) => (1.0 - elevation[i]) * 0.6 + moisture[i] * 0.4;
  const minLake = Math.max(6, Math.floor(Math.min(rows, cols) * 0.045));
  const maxLake = Math.min(
    85,
    Math.max(12, Math.floor(rows * cols * (0.0028 + pondChance * 0.00032)))
  );
  const claimed = new Array(rows * cols).fill(false);

  const seeds: { i: number; p: number }[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (grid[i] === Biome.WATER || grid[i] === Biome.DESERT) continue;
      const e = elevation[i];
      const eN = elevation[(r - 1) * cols + c];
      const eS = elevation[(r + 1) * cols + c];
      const eW = elevation[r * cols + c - 1];
      const eE = elevation[r * cols + c + 1];
      const lowestNeighbor = Math.min(eN, eS, eW, eE);
      if (e > lowestNeighbor + 0.012) continue;
      const p = wet(i);
      if (p < 0.58) continue;
      seeds.push({ i, p });
    }
  }
  seeds.sort((a, b) => b.p - a.p);

  for (const { i: seedIdx } of seeds) {
    if (claimed[seedIdx] || grid[seedIdx] === Biome.WATER) continue;
    const seedElev = elevation[seedIdx];
    const seedP = wet(seedIdx);
    const floorP = seedP - 0.2;
    const rimElev = seedElev + 0.11 + (1.0 - pondChance) * 0.06;

    const body: number[] = [];
    const stack: number[] = [seedIdx];
    const visited = new Set<number>();

    while (stack.length > 0 && body.length < maxLake) {
      const i = stack.pop()!;
      if (visited.has(i)) continue;
      visited.add(i);
      if (claimed[i]) continue;
      if (grid[i] === Biome.WATER) continue;
      if (grid[i] === Biome.DESERT) continue;
      if (elevation[i] > rimElev) continue;
      if (wet(i) < floorP) continue;

      body.push(i);
      const r = Math.floor(i / cols);
      const cc = i % cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr;
        const nc = cc + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        stack.push(nr * cols + nc);
      }
    }

    if (body.length < minLake) continue;
    for (const i of body) {
      grid[i] = Biome.WATER;
      claimed[i] = true;
    }
  }
}

/**
 * Remove isolated water in desert (keeps rivers: ≥2 cardinal water neighbors).
 */
function pruneDesertAndExcessWater(grid: Uint8Array, rows: number, cols: number): void {
  const idx = (r: number, c: number) => r * cols + c;
  const toDesert: number[] = [];
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(r, c);
      if (grid[i] !== Biome.WATER) continue;
      
      let desert8 = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nr = r + dy;
          const nc = c + dx;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (grid[idx(nr, nc)] === Biome.DESERT) desert8++;
        }
      }
      
      let waterCardinal = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (grid[idx(nr, nc)] === Biome.WATER) waterCardinal++;
      }
      
      if (desert8 >= 5 && waterCardinal <= 1) {
        toDesert.push(i);
      }
    }
  }
  
  for (const i of toDesert) {
    grid[i] = Biome.DESERT;
  }
}

/**
 * Wave Function Collapse algorithm for terrain generation
 */
interface WFCResult {
  biomeGrid: Uint8Array;
  heightGrid: Float32Array;
}

async function generateWithWFC(
  rows: number,
  cols: number,
  biomeWeights: Map<Biome, number>,
  worldSeed: number,
  settings?: TerrainSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<WFCResult> {
  /** Split streams so rivers / smoothing do not reshuffle unrelated noise. */
  const rngElev = createMulberry32(mix32(worldSeed, 0xa11));
  const rngMoist = createMulberry32(mix32(worldSeed, 0xa22));
  const rngWfc = createMulberry32(mix32(worldSeed, 0xa33));
  const rngRiver = createMulberry32(mix32(worldSeed, 0xa44));
  const rngRiver2 = createMulberry32(mix32(worldSeed, 0xa55));
  const rngSmooth = createMulberry32(mix32(worldSeed, 0xa66));

  /** Higher = fewer, larger extreme-biome cores and heavier post-smoothing (more cohesive continents). */
  const biomeScale = Math.max(1, Math.min(12, settings?.biome_scale ?? 4));
  const dim = Math.min(rows, cols);
  const maxRadius = dim * (0.34 + 0.02 * Math.min(biomeScale, 10));
  const coreRadius = dim * (0.09 + 0.01 * Math.min(biomeScale, 10));
  const smoothPasses = 1 + Math.min(2, Math.floor(biomeScale / 4));
  const islandMinTiles = Math.max(5, Math.floor(dim * (0.055 + 0.012 * biomeScale)));
  const collapsePersistence = 1.35 + biomeScale * 0.045;
  const entropyBand = 1.0 + 0.12 * (12 / biomeScale);
  
  // Initialize all cells with all possible biomes (superposition)
  // Water will be added later based on water potential
  const allBiomes = [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER];
  const grid: WFCCell[][] = [];
  
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = new WFCCell(allBiomes, rngWfc);
    }
  }
  
  // Seed tundra and desert at multiple points for more organic distribution
  const tundraSeeds: Array<{ r: number; c: number }> = [];
  const desertSeeds: Array<{ r: number; c: number }> = [];
  
  // Fewer seeds at higher biome_scale → larger, clearer regions instead of scattered patches
  const numExtremeSeeds = Math.max(1, 5 - Math.floor(biomeScale / 3));
  const numTundraSeeds = numExtremeSeeds;
  const numDesertSeeds = numExtremeSeeds;
  
  for (let i = 0; i < numTundraSeeds; i++) {
    tundraSeeds.push({
      r: Math.floor(rows * (0.1 + rngWfc() * 0.4)), // Upper portion, more spread
      c: Math.floor(cols * (0.2 + rngWfc() * 0.6)),
    });
  }
  
  for (let i = 0; i < numDesertSeeds; i++) {
    desertSeeds.push({
      r: Math.floor(rows * (0.4 + rngWfc() * 0.4)), // Lower portion, more spread
      c: Math.floor(cols * (0.2 + rngWfc() * 0.6)),
    });
  }
  
  // Calculate distance-based weights for seeded biomes
  const tundraDistanceWeights: number[][] = [];
  const desertDistanceWeights: number[][] = [];
  const minDesertDistGrid = new Float32Array(rows * cols);
  
  for (let r = 0; r < rows; r++) {
    tundraDistanceWeights[r] = [];
    desertDistanceWeights[r] = [];
    for (let c = 0; c < cols; c++) {
      // Find minimum distance to any tundra seed
      let minTundraDist = Infinity;
      for (const pos of tundraSeeds) {
        const dist = Math.sqrt((r - pos.r) ** 2 + (c - pos.c) ** 2);
        minTundraDist = Math.min(minTundraDist, dist);
      }
      
      // Find minimum distance to any desert seed
      let minDesertDist = Infinity;
      for (const pos of desertSeeds) {
        const dist = Math.sqrt((r - pos.r) ** 2 + (c - pos.c) ** 2);
        minDesertDist = Math.min(minDesertDist, dist);
      }
      
      // Weight decreases with distance; maxRadius/coreRadius scale with biome_scale (outer scope)
      const tundraWeight = minTundraDist < maxRadius 
        ? Math.pow(1.0 - minTundraDist / maxRadius, 1.5) 
        : 0;
      const desertWeight = minDesertDist < maxRadius 
        ? Math.pow(1.0 - minDesertDist / maxRadius, 1.5) 
        : 0;
      
      tundraDistanceWeights[r][c] = tundraWeight;
      desertDistanceWeights[r][c] = desertWeight;
      minDesertDistGrid[r * cols + c] = minDesertDist;
      
      // Add initial weights to cells based on distance
      if (tundraWeight > 0.1) {
        grid[r][c].addNeighborWeight(Biome.TUNDRA, tundraWeight * 0.5);
      }
      if (desertWeight > 0.1) {
        grid[r][c].addNeighborWeight(Biome.DESERT, desertWeight * 0.5);
      }
      
      // Protect desert/tundra centers - remove other biomes from core areas
      
      // Protect tundra core
      if (minTundraDist < coreRadius) {
        // In core: only allow tundra
        grid[r][c].possibleBiomes = new Set([Biome.TUNDRA]);
        grid[r][c].updateEntropy();
      } else if (minTundraDist < maxRadius) {
        // At edges: allow forest/plains to compete (remove desert from possibilities)
        const current = Array.from(grid[r][c].possibleBiomes);
        grid[r][c].possibleBiomes = new Set(
          current.filter(b => b !== Biome.DESERT)
        );
        grid[r][c].updateEntropy();
      }
      
      // Protect desert core
      if (minDesertDist < coreRadius) {
        // In core: only allow desert
        grid[r][c].possibleBiomes = new Set([Biome.DESERT]);
        grid[r][c].updateEntropy();
      } else if (minDesertDist < maxRadius) {
        // At edges: allow forest/plains to compete (remove tundra from possibilities)
        const current = Array.from(grid[r][c].possibleBiomes);
        grid[r][c].possibleBiomes = new Set(
          current.filter(b => b !== Biome.TUNDRA)
        );
        grid[r][c].updateEntropy();
      }
    }
  }
  
  if (onProgress) {
    onProgress(2, 'Generating elevation and moisture maps...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Generate elevation and moisture for water placement
  const elevation = generateNoise(cols, rows, 3, 0.55, 1.8, rngElev);
  const moisture = generateNoise(cols, rows, 3, 0.55, 1.8, rngMoist);
  
  // Add water potential to cells (water can spawn in low elevation + high moisture areas)
  // Create larger, more organic water bodies
  const pondChance = settings?.pond_chance ? settings.pond_chance / 100.0 : 0.20;
  
  // First pass: identify high water potential areas
  const waterPotentialMap: number[][] = [];
  const waterSeeds: Array<{ r: number; c: number; potential: number }> = [];
  
  for (let r = 0; r < rows; r++) {
    waterPotentialMap[r] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const waterPotential = (1.0 - elevation[idx]) * 0.6 + moisture[idx] * 0.4;
      waterPotentialMap[r][c] = waterPotential;
      
      const dDesert = minDesertDistGrid[idx];
      if (
        waterPotential > 0.87 &&
        dDesert >= coreRadius * 1.35
      ) {
        waterSeeds.push({ r, c, potential: waterPotential });
      }
    }
  }
  
  // Sort seeds by potential and take top candidates (fewer seeds)
  waterSeeds.sort((a, b) => b.potential - a.potential);
  const numWaterSeeds = Math.min(waterSeeds.length, Math.floor((rows * cols) * pondChance * 0.012));
  
  // Seed some water cells directly (like desert/tundra) - only very high potential ones
  for (let i = 0; i < numWaterSeeds; i++) {
    const seed = waterSeeds[i];
    // Only seed if potential is very high (>0.85)
    if (seed.potential > 0.91 && minDesertDistGrid[seed.r * cols + seed.c] >= coreRadius * 1.2) {
      const cell = grid[seed.r][seed.c];
      if (!cell.collapsed) {
        cell.collapsedBiome = Biome.WATER;
        cell.possibleBiomes = new Set([Biome.WATER]);
        cell.collapsed = true;
        cell.entropy = 0;
      }
    }
  }
  
  // Second pass: add water weights to high potential areas
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const waterPotential = waterPotentialMap[r][c];
      const cell = grid[r][c];
      const dDesert = minDesertDistGrid[idx];
      
      // Dry bands: suppress WATER option under strong desert influence (non-collapsed cells only)
      if (!cell.collapsed && dDesert < coreRadius * 1.55) {
        const cur0 = Array.from(cell.possibleBiomes);
        if (cur0.includes(Biome.WATER) && cur0.length > 1) {
          cell.possibleBiomes = new Set(cur0.filter(b => b !== Biome.WATER));
          cell.updateEntropy();
        }
      }
      
      if (cell.collapsed) continue;
      
      // Check neighbors to see if we're in a water cluster
      let neighborWaterCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = r + dy;
          const nx = c + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            const neighborCell = grid[ny][nx];
            if (neighborCell.collapsed && neighborCell.collapsedBiome === Biome.WATER) {
              neighborWaterCount++;
            } else if (waterPotentialMap[ny][nx] > 0.72) {
              neighborWaterCount++;
            }
          }
        }
      }
      
      // If high water potential OR in a cluster of water, boost water weight (reduced)
      if (waterPotential > 0.82 || neighborWaterCount >= 4) {
        const clusterBoost = neighborWaterCount >= 4 ? 1.65 : 1.0;
        const potentialBoost = waterPotential > 0.9 ? 1.35 : 1.0;
        cell.addNeighborWeight(Biome.WATER, waterPotential * 2.0 * clusterBoost * potentialBoost);
      } else if (waterPotential < 0.55) {
        // Remove water from very low potential areas (but keep it if in protected core areas)
        const current = Array.from(cell.possibleBiomes);
        if (current.includes(Biome.WATER) && current.length > 1) {
          cell.possibleBiomes = new Set(
            current.filter(b => b !== Biome.WATER)
          );
          cell.updateEntropy();
        }
      }
    }
  }
  
  // Propagate initial constraints from water seeds
  const waterSeedCoords = waterSeeds.slice(0, numWaterSeeds).map(s => ({ r: s.r, c: s.c }));
  const waterQueue: Array<{ r: number; c: number }> = [...waterSeedCoords];
  const waterVisited = new Set<string>();
  
  while (waterQueue.length > 0) {
    const current = waterQueue.shift()!;
    const key = `${current.r},${current.c}`;
    if (waterVisited.has(key)) continue;
    waterVisited.add(key);
    
    const currentCell = grid[current.r][current.c];
    if (!currentCell.collapsed || currentCell.collapsedBiome !== Biome.WATER) continue;
    
    const neighbors = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];
    
    for (const neighbor of neighbors) {
      if (neighbor.r < 0 || neighbor.r >= rows || neighbor.c < 0 || neighbor.c >= cols) {
        continue;
      }
      
      const neighborCell = grid[neighbor.r][neighbor.c];
      if (neighborCell.collapsed) continue;
      
      neighborCell.addNeighborWeight(Biome.WATER, 1.0); // Reduced propagation weight
      neighborCell.constrainByNeighbor(Biome.WATER);
      waterQueue.push(neighbor);
    }
  }
  
  // Meandering river locked to elevation valleys (reads natural against cohesive biomes)
  const riverChance = settings?.river_chance ? settings.river_chance / 100.0 : 0.6;
  if (rngRiver() < riverChance) {
    const dimAxis = Math.min(rows, cols);
    const riverWidthTiles =
      settings?.river_width && settings.river_width > 0
        ? settings.river_width
        : Math.max(1, Math.floor(dimAxis * 0.014));
    const halfWidth = Math.max(1, riverWidthTiles);
    const flowNorthSouth = rngRiver() < 0.5;
    if (flowNorthSouth) {
      carveValleyRiverAcrossColumns(
        grid,
        elevation,
        rows,
        cols,
        worldSeed,
        halfWidth,
        rngRiver,
        minDesertDistGrid,
        coreRadius
      );
    } else {
      carveValleyRiverAcrossRows(
        grid,
        elevation,
        rows,
        cols,
        worldSeed,
        halfWidth,
        rngRiver,
        minDesertDistGrid,
        coreRadius
      );
    }
    // Second, thinner channel (often perpendicular) — tributary / braided feel, scales with river_chance
    if (rngRiver() < riverChance * 0.22) {
      const halfTrib = Math.max(1, Math.floor(halfWidth * 0.58));
      const altSeed = (worldSeed ^ 0x5eef5eed) >>> 0;
      if (flowNorthSouth) {
        carveValleyRiverAcrossRows(
          grid,
          elevation,
          rows,
          cols,
          altSeed,
          halfTrib,
          rngRiver2,
          minDesertDistGrid,
          coreRadius
        );
      } else {
        carveValleyRiverAcrossColumns(
          grid,
          elevation,
          rows,
          cols,
          altSeed,
          halfTrib,
          rngRiver2,
          minDesertDistGrid,
          coreRadius
        );
      }
    }
  }
  
  // Seed initial tundra and desert cells
  for (const pos of tundraSeeds) {
    const cell = grid[pos.r][pos.c];
    if (!cell.collapsed) {
      cell.collapsedBiome = Biome.TUNDRA;
      cell.possibleBiomes = new Set([Biome.TUNDRA]);
      cell.collapsed = true;
      cell.entropy = 0;
    }
  }
  
  for (const pos of desertSeeds) {
    const cell = grid[pos.r][pos.c];
    if (!cell.collapsed) {
      cell.collapsedBiome = Biome.DESERT;
      cell.possibleBiomes = new Set([Biome.DESERT]);
      cell.collapsed = true;
      cell.entropy = 0;
    }
  }
  
  // Propagate initial constraints from seeds
  const initialQueue: Array<{ r: number; c: number }> = [...tundraSeeds, ...desertSeeds];
  const initialVisited = new Set<string>();
  
  while (initialQueue.length > 0) {
    const current = initialQueue.shift()!;
    const key = `${current.r},${current.c}`;
    if (initialVisited.has(key)) continue;
    initialVisited.add(key);
    
    const currentCell = grid[current.r][current.c];
    if (!currentCell.collapsed || !currentCell.collapsedBiome) continue;
    
    const neighbors = [
      { r: current.r - 1, c: current.c },
      { r: current.r + 1, c: current.c },
      { r: current.r, c: current.c - 1 },
      { r: current.r, c: current.c + 1 },
    ];
    
    for (const neighbor of neighbors) {
      if (neighbor.r < 0 || neighbor.r >= rows || neighbor.c < 0 || neighbor.c >= cols) {
        continue;
      }
      
      const neighborCell = grid[neighbor.r][neighbor.c];
      if (neighborCell.collapsed) continue;
      
      neighborCell.addNeighborWeight(currentCell.collapsedBiome!, 1.0);
      neighborCell.constrainByNeighbor(currentCell.collapsedBiome!);
      initialQueue.push(neighbor);
    }
  }
  
  // Collapse cells one by one
  let collapsedCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].collapsed) collapsedCount++;
    }
  }
  
  const totalCells = rows * cols;
  const maxIterations = totalCells * 2; // Safety limit
  let iterations = 0;
  const progressUpdateInterval = Math.max(1, Math.floor(totalCells / 50)); // Update ~50 times for smoother progress
  const yieldInterval = 100; // Yield to event loop every 100 iterations
  
  if (onProgress) {
    onProgress(5, 'Initializing terrain cells...');
    // Force initial render
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  while (collapsedCount < totalCells && iterations < maxIterations) {
    iterations++;
    
    // Report progress periodically
    if (onProgress && iterations % progressUpdateInterval === 0) {
      const progress = 5 + Math.floor((collapsedCount / totalCells) * 85); // 5-90% for WFC
      onProgress(progress, `Generating terrain... ${Math.floor((collapsedCount / totalCells) * 100)}%`);
    }
    
    // Yield to event loop periodically to allow rendering
    if (iterations % yieldInterval === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Find cell with lowest entropy (most constrained)
    // Add some randomness to break up rigid patterns
    let minEntropy = Infinity;
    const candidates: Array<{ r: number; c: number; entropy: number }> = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (!cell.collapsed) {
          if (cell.entropy < minEntropy) {
            minEntropy = cell.entropy;
          }
          candidates.push({ r, c, entropy: cell.entropy });
        }
      }
    }
    
    // Select from cells with entropy within 10% of minimum (adds variation)
    const threshold = minEntropy * entropyBand;
    const validCandidates = candidates.filter(c => c.entropy <= threshold);
    const minCell = validCandidates.length > 0 
      ? validCandidates[Math.floor(rngWfc() * validCandidates.length)]
      : null;
    
    // If no cell found, break (shouldn't happen)
    if (!minCell) {
      break;
    }
    
    // Collapse the selected cell
    const cell = grid[minCell.r][minCell.c];
    // Use slightly lower persistence (1.5x) for more organic variation
    cell.collapse(biomeWeights, collapsePersistence);
    collapsedCount++;
    
    // Propagate constraints to neighbors
    const queue: Array<{ r: number; c: number }> = [minCell];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.r},${current.c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      
      const currentCell = grid[current.r][current.c];
      if (!currentCell.collapsed || !currentCell.collapsedBiome) continue;
      
      // Check all 4 neighbors
      const neighbors = [
        { r: current.r - 1, c: current.c },     // North
        { r: current.r + 1, c: current.c },     // South
        { r: current.r, c: current.c - 1 },     // West
        { r: current.r, c: current.c + 1 },     // East
      ];
      
      for (const neighbor of neighbors) {
        if (neighbor.r < 0 || neighbor.r >= rows || neighbor.c < 0 || neighbor.c >= cols) {
          continue;
        }
        
        const neighborCell = grid[neighbor.r][neighbor.c];
        if (neighborCell.collapsed) continue;
        
        // Add persistence weight: if neighbor becomes same biome, it gets boosted
        neighborCell.addNeighborWeight(currentCell.collapsedBiome!, 1.0);
        
        // Constrain neighbor based on current cell's biome
        const wasModified = neighborCell.constrainByNeighbor(currentCell.collapsedBiome!);
        
        if (wasModified) {
          // If neighbor collapsed (only one possibility left), add to queue
          if (neighborCell.possibleBiomes.size === 1) {
            neighborCell.collapse(biomeWeights, collapsePersistence);
            collapsedCount++;
          }
          
          // Add to propagation queue
          queue.push(neighbor);
        }
      }
    }
  }
  
  // Convert to output format
  const raw = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const idx = r * cols + c;
      if (cell.collapsed && cell.collapsedBiome) {
        raw[idx] = cell.collapsedBiome;
      } else {
        const biomes = Array.from(cell.possibleBiomes);
        raw[idx] = biomes.length > 0 ? biomes[0] : Biome.PLAINS;
      }
    }
  }
  
  if (onProgress) {
    onProgress(90, 'Smoothing biome edges...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Post-processing: merge land clumps, fill plausible lake basins, then final smooth
  let work = new Uint8Array(smoothBiomeEdges(raw, rows, cols, smoothPasses, rngSmooth));
  work = new Uint8Array(mergeSmallLandRegions(work, rows, cols, islandMinTiles));
  growNaturalLakes(work, elevation, moisture, rows, cols, pondChance);
  work = new Uint8Array(smoothBiomeEdges(work, rows, cols, 1, rngSmooth));
  pruneDesertAndExcessWater(work, rows, cols);
  
  if (onProgress) {
    onProgress(95, 'Finalizing terrain...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  const heightGrid = finalizeHeightGrid(elevation, work, rows, cols, worldSeed);
  return { biomeGrid: work, heightGrid };
}

/**
 * Minecraft-style height: multi-scale noise → land surface strictly above sea level (Y=0).
 * Water tiles are always flat at WATER_SURFACE_HEIGHT (world Z 0).
 */
function finalizeHeightGrid(
  elevation: Float32Array,
  biomeGrid: Uint8Array,
  rows: number,
  cols: number,
  worldSeed: number
): Float32Array {
  const rngRidge = createMulberry32(mix32(worldSeed, 0xa77));
  const rngPeak = createMulberry32(mix32(worldSeed, 0xa88));
  const rngDetail = createMulberry32(mix32(worldSeed, 0xa99));

  const ridge = generateNoise(cols, rows, 2, 0.5, 2.2, rngRidge);
  const peaks = generateNoise(cols, rows, 2, 0.45, 2.5, rngPeak);
  const detail = generateNoise(cols, rows, 4, 0.52, 2.8, rngDetail);

  const height = new Float32Array(rows * cols);
  const landSamples: number[] = [];

  const isWater = (idx: number) => biomeGrid[idx] === Biome.WATER;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (isWater(idx)) {
        height[idx] = WATER_SURFACE_HEIGHT;
        continue;
      }

      const continental = elevation[idx];
      const erosion = ridge[idx];
      const mountain = peaks[idx];
      const fine = detail[idx];

      let h =
        continental * 0.48 +
        erosion * 0.26 +
        mountain * 0.16 +
        fine * 0.1;

      h = (h - 0.38) * 1.55;
      h = h * h * (3 - 2 * h);

      if (h > 0.55) h += (h - 0.55) * 0.35;
      if (h > 0.75) h += (h - 0.75) * 0.5;

      landSamples.push(h);
      height[idx] = h;
    }
  }

  if (landSamples.length > 0) {
    let minL = landSamples[0];
    let maxL = landSamples[0];
    for (const v of landSamples) {
      minL = Math.min(minL, v);
      maxL = Math.max(maxL, v);
    }
    const span = Math.max(0.001, maxL - minL);
    let si = 0;
    const landTop = 1.0;
    const landFloor = MIN_LAND_SURFACE_HEIGHT;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (isWater(idx)) continue;

        const t = (landSamples[si++] - minL) / span;
        const shaped = Math.pow(t, 0.68);
        height[idx] = landFloor + shaped * (landTop - landFloor);

        if (height[idx] > 0.65) {
          height[idx] += (height[idx] - 0.65) * 0.22;
        }
        height[idx] = Math.max(landFloor, Math.min(landTop, height[idx]));
      }
    }
  }

  enforceShorelinesAboveSea(height, biomeGrid, rows, cols);
  return height;
}

/** Beaches: land beside water sits at least one step above sea level (never below Y=0). */
function enforceShorelinesAboveSea(
  height: Float32Array,
  biomeGrid: Uint8Array,
  rows: number,
  cols: number
): void {
  const beachMin = MIN_LAND_SURFACE_HEIGHT * 1.08;
  const shoreMin = MIN_LAND_SURFACE_HEIGHT;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (biomeGrid[idx] === Biome.WATER) continue;

      let touchesWater = false;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (biomeGrid[nr * cols + nc] === Biome.WATER) {
          touchesWater = true;
          break;
        }
      }

      if (touchesWater) {
        height[idx] = Math.max(height[idx], beachMin);
      }
      height[idx] = Math.max(shoreMin, height[idx]);
    }
  }
}

/**
 * Remove tiny same-biome blobs (except water) by absorbing them into a neighboring biome
 * that is adjacency-legal with every surrounding tile—stops “checkerboard” scraps.
 */
function mergeSmallLandRegions(grid: Uint8Array, rows: number, cols: number, minSize: number): Uint8Array {
  const result = new Uint8Array(grid);
  const seen = new Array(rows * cols).fill(false);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const start = r * cols + c;
      if (seen[start] || result[start] === Biome.WATER) continue;

      const biome = result[start];
      const q: { r: number; c: number }[] = [{ r, c }];
      const cellIndices: number[] = [];
      const cellSet = new Set<number>();
      seen[start] = true;

      while (q.length > 0) {
        const cur = q.shift()!;
        const i = cur.r * cols + cur.c;
        cellIndices.push(i);
        cellSet.add(i);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cur.r + dr;
          const nc = cur.c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (seen[ni]) continue;
          if (result[ni] !== biome) continue;
          seen[ni] = true;
          q.push({ r: nr, c: nc });
        }
      }

      if (cellIndices.length >= minSize) continue;

      const extCounts = new Map<Biome, number>();
      for (const i of cellIndices) {
        const cr = Math.floor(i / cols);
        const cc = i % cols;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni = nr * cols + nc;
          if (cellSet.has(ni)) continue;
          const nb = result[ni];
          extCounts.set(nb, (extCounts.get(nb) || 0) + 1);
        }
      }

      const externalTypes = [...new Set(extCounts.keys())];
      const landCandidates: Biome[] = [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA];
      let best: Biome = Biome.PLAINS;
      let bestScore = -1;

      for (const cand of landCandidates) {
        if (!externalTypes.every(e => canBeAdjacent(cand, e))) continue;
        const score = externalTypes.reduce((s, e) => s + (extCounts.get(e) || 0), 0);
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }

      if (bestScore < 0) continue;

      for (const i of cellIndices) {
        result[i] = best;
      }
    }
  }

  return result;
}

/**
 * Smooth biome edges using majority filter with some randomness
 * Creates more organic boundaries
 */
function smoothBiomeEdges(
  grid: Uint8Array,
  rows: number,
  cols: number,
  iterations: number = 1,
  rng: Rng
): Uint8Array {
  let result = new Uint8Array(grid);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newGrid = new Uint8Array(result);
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const currentBiome = result[idx];
        
        // Never erase water with land majority — keeps lakes/rivers from dissolving in land smoothing
        if (currentBiome === Biome.WATER) {
          newGrid[idx] = Biome.WATER;
          continue;
        }
        
        // Count neighbors of each biome
        const counts = new Map<Biome, number>();
        let totalNeighbors = 0;
        
        // Check 8 neighbors (including diagonals for smoother transitions)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const ny = r + dy;
            const nx = c + dx;
            
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
              const neighborBiome = result[ny * cols + nx];
              counts.set(neighborBiome, (counts.get(neighborBiome) || 0) + 1);
              totalNeighbors++;
            }
          }
        }
        
        // If most neighbors are a different biome, consider changing
        // But add some randomness to avoid perfect patterns
        if (totalNeighbors > 0) {
          let maxCount = 0;
          let dominantBiome = currentBiome;
          
          for (const [biome, count] of counts.entries()) {
            if (count > maxCount) {
              maxCount = count;
              dominantBiome = biome;
            }
          }
          
          // Change if dominant biome has at least 5 neighbors (out of 8)
          // And add some randomness (70% chance) to avoid rigid patterns
          if (dominantBiome !== currentBiome && maxCount >= 5 && rng() < 0.7) {
            // Check if the change is allowed by adjacency rules
            if (canBeAdjacent(currentBiome, dominantBiome)) {
              newGrid[idx] = dominantBiome;
            }
          }
        }
      }
    }
    
    result = newGrid;
  }
  
  return result;
}

/**
 * Generate noise for water placement
 */
function generateNoise(
  width: number,
  height: number,
  octaves: number = 3,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
  rng: Rng
): Float32Array {
  const noise = new Float32Array(width * height);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = rng();
  }
  
  const result = new Float32Array(width * height);
  let amplitude = 1.0;
  let frequency = 1.0;
  let totalAmplitude = 0.0;
  
  for (let octave = 0; octave < octaves; octave++) {
    const smooth = smoothNoise(noise, width, height, frequency);
    
    for (let i = 0; i < result.length; i++) {
      result[i] += amplitude * smooth[i];
    }
    
    totalAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  if (totalAmplitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= totalAmplitude;
    }
  }
  
  // Normalize
  let min = result[0];
  let max = result[0];
  for (let i = 1; i < result.length; i++) {
    min = Math.min(min, result[i]);
    max = Math.max(max, result[i]);
  }
  const range = max - min;
  if (range > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] = (result[i] - min) / range;
    }
  }
  
  return result;
}

/**
 * Simple box blur for smoothing
 */
function smoothNoise(noise: Float32Array, width: number, height: number, frequency: number): Float32Array {
  const smooth = new Float32Array(noise.length);
  const kernelSize = Math.max(1, Math.floor(3 / frequency));
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const ny = Math.max(0, Math.min(height - 1, y + ky));
          const nx = Math.max(0, Math.min(width - 1, x + kx));
          sum += noise[ny * width + nx];
          count++;
        }
      }
      
      smooth[y * width + x] = sum / count;
    }
  }
  
  return smooth;
}

/**
 * Generate lakes using flood fill from high water potential areas
 */
function generateLakes(
  rows: number,
  cols: number,
  elevation: Float32Array,
  moisture: Float32Array,
  pondChance: number,
  minLakeSize: number = 3,
  maxLakeSize: number = 15
): boolean[] {
  const waterMask = new Array(rows * cols).fill(false);
  const visited = new Array(rows * cols).fill(false);
  
  // Find high water potential cells
  const candidates: Array<{ r: number; c: number; potential: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const waterPotential = (1.0 - elevation[idx]) * 0.6 + moisture[idx] * 0.4;
      if (waterPotential > (1.0 - pondChance / 100.0)) {
        candidates.push({ r, c, potential: waterPotential });
      }
    }
  }
  
  // Sort by potential (highest first)
  candidates.sort((a, b) => b.potential - a.potential);
  
  // Generate lakes from top candidates
  for (const candidate of candidates) {
    const idx = candidate.r * cols + candidate.c;
    if (visited[idx] || waterMask[idx]) continue;
    
    // Flood fill to create lake
    const lakeCells: Array<{ r: number; c: number }> = [];
    const stack: Array<{ r: number; c: number }> = [{ r: candidate.r, c: candidate.c }];
    
    while (stack.length > 0 && lakeCells.length < maxLakeSize) {
      const cell = stack.pop()!;
      const cellIdx = cell.r * cols + cell.c;
      
      if (cell.r < 0 || cell.r >= rows || cell.c < 0 || cell.c >= cols) continue;
      if (visited[cellIdx] || waterMask[cellIdx]) continue;
      
      const cellPotential = (1.0 - elevation[cellIdx]) * 0.6 + moisture[cellIdx] * 0.4;
      if (cellPotential < (1.0 - pondChance / 100.0) - 0.1) continue; // Too low
      
      visited[cellIdx] = true;
      lakeCells.push(cell);
      
      // Add neighbors
      stack.push({ r: cell.r - 1, c: cell.c });
      stack.push({ r: cell.r + 1, c: cell.c });
      stack.push({ r: cell.r, c: cell.c - 1 });
      stack.push({ r: cell.r, c: cell.c + 1 });
    }
    
    // Only create lake if it meets minimum size
    if (lakeCells.length >= minLakeSize) {
      for (const cell of lakeCells) {
        waterMask[cell.r * cols + cell.c] = true;
      }
    }
  }
  
  return waterMask;
}

/**
 * Main world generation function using Wave Function Collapse.
 *
 * @param seed World terrain seed (same value + map settings ⇒ same rivers/biomes). Omitted ⇒ random; check console for the chosen value.
 */
export async function generateWorld(
  width: number,
  height: number,
  settings?: TerrainSettings,
  seed?: number,
  onProgress?: (progress: number, message: string) => void
): Promise<WorldData> {
  const worldSeed = resolveWorldSeed(seed);
  console.log('World seed:', worldSeed, '(set this in the title screen to reproduce the same terrain)');

  const s = settings || {
    biome_scale: 6,
    biome_weights: { plains: 40, forest: 25, desert: 20, tundra: 15 },
    pond_chance: 20.0,
    river_chance: 60.0,
    river_width: 0,
    tile_size: 64,
  };
  
  const tileSize = Math.max(16, s.tile_size ?? 64);
  const rows = Math.max(1, Math.floor(height / tileSize));
  const cols = Math.max(1, Math.floor(width / tileSize));
  
  // Prepare biome weights (including water)
  // Cap and scale water vs pond_chance — raw pond_chance was producing excessive WATER tiles.
  const waterWeight = Math.min(0.11, (s.pond_chance / 100.0) * 0.42);
  const landWeight = 1.0 - waterWeight;
  const totalLandWeight = Math.max(1, s.biome_weights.plains + s.biome_weights.forest + 
    s.biome_weights.desert + s.biome_weights.tundra);
  
  const biomeWeights = new Map<Biome, number>([
    [Biome.PLAINS, (Math.max(0, s.biome_weights.plains) / totalLandWeight) * landWeight],
    [Biome.FOREST, (Math.max(0, s.biome_weights.forest) / totalLandWeight) * landWeight],
    [Biome.DESERT, (Math.max(0, s.biome_weights.desert) / totalLandWeight) * landWeight],
    [Biome.TUNDRA, (Math.max(0, s.biome_weights.tundra) / totalLandWeight) * landWeight],
    [Biome.WATER, waterWeight], // Water gets its own weight, not reduced by land weight
  ]);
  
  // Generate biomes using Wave Function Collapse (water is included)
  console.log('Generating terrain with Wave Function Collapse...');
  if (onProgress) {
    onProgress(0, 'Preparing world generation...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const { biomeGrid, heightGrid } = await generateWithWFC(rows, cols, biomeWeights, worldSeed, s, onProgress);
  
  // Generate water mask from biome grid (water is now part of biomes)
  const waterMask = new Array(rows * cols).fill(false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (biomeGrid[idx] === Biome.WATER) {
        waterMask[idx] = true;
      }
    }
  }
  
  return {
    biomeGrid,
    waterMask,
    heightGrid,
    tileSize,
    rows,
    cols,
    width: cols * tileSize,
    height: rows * tileSize,
  };
}
