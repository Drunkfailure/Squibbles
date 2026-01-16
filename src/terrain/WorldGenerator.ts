/**
 * WorldGenerator - Wave Function Collapse (WFC) based terrain generation
 * Uses constraint propagation to generate coherent biome patterns
 */

import { Biome } from './Biome';
import { WaterMap } from './WaterMap';

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
}

export interface WorldData {
  biomeGrid: Uint8Array;
  waterMask: boolean[];
  tileSize: number;
  rows: number;
  cols: number;
  width: number;
  height: number;
}

/**
 * Biome adjacency rules for WFC
 * Each biome has a list of biomes that can be adjacent to it
 * Rules are symmetric (if A can be next to B, then B can be next to A)
 * More permissive rules for more organic transitions
 */
const BIOME_ADJACENCY_RULES: Record<Biome, Biome[]> = {
  [Biome.PLAINS]: [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER], // Plains can transition to most biomes
  [Biome.FOREST]: [Biome.PLAINS, Biome.FOREST, Biome.TUNDRA, Biome.WATER],  // Forest can be next to plains, forest, tundra, water
  [Biome.DESERT]: [Biome.PLAINS, Biome.DESERT, Biome.WATER],                // Desert can be next to plains, desert, water
  [Biome.TUNDRA]: [Biome.PLAINS, Biome.FOREST, Biome.TUNDRA, Biome.WATER],  // Tundra can also connect to plains for smoother transitions
  [Biome.WATER]: [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER], // Water can be next to any biome
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
  public entropy: number;
  public neighborBiomeWeights: Map<Biome, number> = new Map(); // Track weights from neighboring biomes
  
  constructor(initialBiomes: Biome[]) {
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
      this.entropy = Math.log(count) + Math.random() * 0.0001;
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
      let random = Math.random() * totalWeight;
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

/**
 * Wave Function Collapse algorithm for terrain generation
 */
async function generateWithWFC(
  rows: number,
  cols: number,
  biomeWeights: Map<Biome, number>,
  seed?: number,
  settings?: TerrainSettings,
  onProgress?: (progress: number, message: string) => void
): Promise<Uint8Array> {
  // Initialize all cells with all possible biomes (superposition)
  // Water will be added later based on water potential
  const allBiomes = [Biome.PLAINS, Biome.FOREST, Biome.DESERT, Biome.TUNDRA, Biome.WATER];
  const grid: WFCCell[][] = [];
  
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = new WFCCell(allBiomes);
    }
  }
  
  // Seed tundra and desert at multiple points for more organic distribution
  const tundraSeeds: Array<{ r: number; c: number }> = [];
  const desertSeeds: Array<{ r: number; c: number }> = [];
  
  // Generate 2-4 seed points for each to create more varied regions
  const numTundraSeeds = 2 + Math.floor(Math.random() * 3); // 2-4 seeds
  const numDesertSeeds = 2 + Math.floor(Math.random() * 3); // 2-4 seeds
  
  for (let i = 0; i < numTundraSeeds; i++) {
    tundraSeeds.push({
      r: Math.floor(rows * (0.1 + Math.random() * 0.4)), // Upper portion, more spread
      c: Math.floor(cols * (0.2 + Math.random() * 0.6)),
    });
  }
  
  for (let i = 0; i < numDesertSeeds; i++) {
    desertSeeds.push({
      r: Math.floor(rows * (0.4 + Math.random() * 0.4)), // Lower portion, more spread
      c: Math.floor(cols * (0.2 + Math.random() * 0.6)),
    });
  }
  
  // Calculate distance-based weights for seeded biomes
  const tundraDistanceWeights: number[][] = [];
  const desertDistanceWeights: number[][] = [];
  
  for (let r = 0; r < rows; r++) {
    tundraDistanceWeights[r] = [];
    desertDistanceWeights[r] = [];
    for (let c = 0; c < cols; c++) {
      // Find minimum distance to any tundra seed
      let minTundraDist = Infinity;
      for (const seed of tundraSeeds) {
        const dist = Math.sqrt((r - seed.r) ** 2 + (c - seed.c) ** 2);
        minTundraDist = Math.min(minTundraDist, dist);
      }
      
      // Find minimum distance to any desert seed
      let minDesertDist = Infinity;
      for (const seed of desertSeeds) {
        const dist = Math.sqrt((r - seed.r) ** 2 + (c - seed.c) ** 2);
        minDesertDist = Math.min(minDesertDist, dist);
      }
      
      // Weight decreases with distance, but outer edges can be overtaken
      // Max influence radius: ~40% of map size (larger for more organic spread)
      const maxRadius = Math.min(rows, cols) * 0.4;
      // Use smoother falloff curve for more organic shapes
      const tundraWeight = minTundraDist < maxRadius 
        ? Math.pow(1.0 - minTundraDist / maxRadius, 1.5) 
        : 0;
      const desertWeight = minDesertDist < maxRadius 
        ? Math.pow(1.0 - minDesertDist / maxRadius, 1.5) 
        : 0;
      
      tundraDistanceWeights[r][c] = tundraWeight;
      desertDistanceWeights[r][c] = desertWeight;
      
      // Add initial weights to cells based on distance
      if (tundraWeight > 0.1) {
        grid[r][c].addNeighborWeight(Biome.TUNDRA, tundraWeight * 0.5);
      }
      if (desertWeight > 0.1) {
        grid[r][c].addNeighborWeight(Biome.DESERT, desertWeight * 0.5);
      }
      
      // Protect desert/tundra centers - remove other biomes from core areas
      // Core radius: ~12% of map size (smaller for more organic boundaries)
      const coreRadius = Math.min(rows, cols) * 0.12;
      
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
  const elevation = generateNoise(cols, rows, 3, 0.55, 1.8);
  const moisture = generateNoise(cols, rows, 3, 0.55, 1.8);
  
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
      
      // Collect high potential cells as water seeds (higher threshold)
      if (waterPotential > 0.8) { // Higher threshold for fewer seeds
        waterSeeds.push({ r, c, potential: waterPotential });
      }
    }
  }
  
  // Sort seeds by potential and take top candidates (fewer seeds)
  waterSeeds.sort((a, b) => b.potential - a.potential);
  const numWaterSeeds = Math.min(waterSeeds.length, Math.floor((rows * cols) * pondChance * 0.03)); // ~3% of target water as seeds (reduced)
  
  // Seed some water cells directly (like desert/tundra) - only very high potential ones
  for (let i = 0; i < numWaterSeeds; i++) {
    const seed = waterSeeds[i];
    // Only seed if potential is very high (>0.85)
    if (seed.potential > 0.85) {
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
      
      // Skip if already collapsed
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
            } else if (waterPotentialMap[ny][nx] > 0.65) {
              neighborWaterCount++;
            }
          }
        }
      }
      
      // If high water potential OR in a cluster of water, boost water weight (reduced)
      if (waterPotential > 0.75 || neighborWaterCount >= 3) {
        // Moderate weight boost for water
        const clusterBoost = neighborWaterCount >= 3 ? 2.0 : 1.0;
        const potentialBoost = waterPotential > 0.85 ? 1.5 : 1.0;
        cell.addNeighborWeight(Biome.WATER, waterPotential * 2.5 * clusterBoost * potentialBoost);
      } else if (waterPotential < 0.5) {
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
  
  // Generate river seeds
  const riverChance = settings?.river_chance ? settings.river_chance / 100.0 : 0.6;
  if (Math.random() < riverChance) {
    const riverNoise = generateNoise(cols, 1, 2, 0.7, 1.0);
    const riverWidthTiles = settings?.river_width && settings.river_width > 0 
      ? settings.river_width 
      : Math.max(1, Math.floor((rows / 32) / 120));
    const halfWidth = Math.max(1, riverWidthTiles);
    
    for (let c = 0; c < cols; c++) {
      const t = c / (cols - 1);
      let riverCenter = 0.5 + 0.10 * Math.sin(2.0 * Math.PI * (t * 1.0 + (seed || 0) * 0.01));
      riverCenter += 0.05 * (riverNoise[c] - 0.5);
      const centerRow = Math.floor(riverCenter * (rows - 1));
      
      const r0 = Math.max(0, centerRow - halfWidth);
      const r1 = Math.min(rows - 1, centerRow + halfWidth);
      
      for (let r = r0; r <= r1; r++) {
        // Force water in river path (overrides protected cores)
        const cell = grid[r][c];
        cell.possibleBiomes = new Set([Biome.WATER]);
        cell.collapsedBiome = Biome.WATER;
        cell.collapsed = true;
        cell.entropy = 0;
      }
    }
  }
  
  // Seed initial tundra and desert cells
  for (const seed of tundraSeeds) {
    const cell = grid[seed.r][seed.c];
    if (!cell.collapsed) {
      cell.collapsedBiome = Biome.TUNDRA;
      cell.possibleBiomes = new Set([Biome.TUNDRA]);
      cell.collapsed = true;
      cell.entropy = 0;
    }
  }
  
  for (const seed of desertSeeds) {
    const cell = grid[seed.r][seed.c];
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
    const threshold = minEntropy * 1.1;
    const validCandidates = candidates.filter(c => c.entropy <= threshold);
    const minCell = validCandidates.length > 0 
      ? validCandidates[Math.floor(Math.random() * validCandidates.length)]
      : null;
    
    // If no cell found, break (shouldn't happen)
    if (!minCell) {
      break;
    }
    
    // Collapse the selected cell
    const cell = grid[minCell.r][minCell.c];
    // Use slightly lower persistence (1.5x) for more organic variation
    cell.collapse(biomeWeights, 1.5); // 1.5 = same biome neighbors get 1.5x weight
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
            neighborCell.collapse(biomeWeights, 1.5);
            collapsedCount++;
          }
          
          // Add to propagation queue
          queue.push(neighbor);
        }
      }
    }
  }
  
  // Convert to output format
  let result = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.collapsed && cell.collapsedBiome) {
        result[r * cols + c] = cell.collapsedBiome;
      } else {
        // Fallback: pick first available biome
        const biomes = Array.from(cell.possibleBiomes);
        result[r * cols + c] = biomes.length > 0 ? biomes[0] : Biome.PLAINS;
      }
    }
  }
  
  if (onProgress) {
    onProgress(90, 'Smoothing biome edges...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Post-processing: Smooth edges for more organic look
  result = smoothBiomeEdges(result, rows, cols);
  
  if (onProgress) {
    onProgress(95, 'Finalizing terrain...');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return result;
}

/**
 * Smooth biome edges using majority filter with some randomness
 * Creates more organic boundaries
 */
function smoothBiomeEdges(grid: Uint8Array, rows: number, cols: number, iterations: number = 1): Uint8Array {
  let result = new Uint8Array(grid);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newGrid = new Uint8Array(result);
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const currentBiome = result[idx];
        
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
          if (dominantBiome !== currentBiome && maxCount >= 5 && Math.random() < 0.7) {
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
  lacunarity: number = 2.0
): Float32Array {
  const noise = new Float32Array(width * height);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = Math.random();
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
 * Main world generation function using Wave Function Collapse
 */
export async function generateWorld(
  width: number,
  height: number,
  settings?: TerrainSettings,
  seed?: number,
  onProgress?: (progress: number, message: string) => void
): Promise<WorldData> {
  const s = settings || {
    biome_scale: 4,
    biome_weights: { plains: 40, forest: 25, desert: 20, tundra: 15 },
    pond_chance: 20.0,
    river_chance: 60.0,
    river_width: 0,
  };
  
  const tileSize = 32;
  const rows = Math.max(1, Math.floor(height / tileSize));
  const cols = Math.max(1, Math.floor(width / tileSize));
  
  // Prepare biome weights (including water)
  // Water weight is derived from pond_chance
  const waterWeight = s.pond_chance / 100.0; // Use pond_chance directly, no boost
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
  const biomeGrid = await generateWithWFC(rows, cols, biomeWeights, seed, s, onProgress);
  
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
    tileSize,
    rows,
    cols,
    width: cols * tileSize,
    height: rows * tileSize,
  };
}
