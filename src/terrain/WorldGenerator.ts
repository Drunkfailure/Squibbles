/**
 * WorldGenerator - CPU-based terrain generation
 * Ported from Python with NumPy/CuPy logic converted to JavaScript
 */

import { Biome, BIOME_COLORS, WATER_COLOR } from './Biome';
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
 * Generate multi-octave noise using FFT-like approach
 * Simplified for JavaScript (no actual FFT, using smoothing instead)
 */
function generateNoise(
  width: number,
  height: number,
  octaves: number = 3,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
  seed?: number
): Float32Array {
  if (seed !== undefined) {
    // Simple seeded random (not cryptographically secure, but deterministic)
    Math.random();
  }
  
  // Start with white noise
  const noise = new Float32Array(width * height);
  for (let i = 0; i < noise.length; i++) {
    noise[i] = Math.random();
  }
  
  const result = new Float32Array(width * height);
  let amplitude = 1.0;
  let frequency = 1.0;
  let totalAmplitude = 0.0;
  
  // Simple smoothing approach (simulating FFT low-pass filter)
  for (let octave = 0; octave < octaves; octave++) {
    const smooth = smoothNoise(noise, width, height, frequency);
    
    for (let i = 0; i < result.length; i++) {
      result[i] += amplitude * smooth[i];
    }
    
    totalAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  
  // Normalize to [0, 1]
  if (totalAmplitude > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= totalAmplitude;
    }
  }
  
  // Normalize to [0, 1]
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
 * Simple box blur for smoothing (simulating FFT low-pass)
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
 * Majority filter for smoothing biome boundaries
 */
function majorityFilter(grid: Uint8Array, width: number, height: number, iterations: number = 1): Uint8Array {
  if (iterations <= 0) {
    return grid;
  }
  
  let out = new Uint8Array(grid);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newGrid = new Uint8Array(out);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const counts = [0, 0, 0, 0]; // For biomes 1-4
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const biome = out[ny * width + nx];
            if (biome >= 1 && biome <= 4) {
              counts[biome - 1]++;
            }
          }
        }
        
        // Find biome with max count
        let maxCount = counts[0];
        let maxBiome = 1;
        for (let i = 1; i < 4; i++) {
          if (counts[i] > maxCount) {
            maxCount = counts[i];
            maxBiome = i + 1;
          }
        }
        
        newGrid[y * width + x] = maxBiome;
      }
    }
    
    out = newGrid;
  }
  
  return out;
}

export function generateWorld(
  width: number,
  height: number,
  settings?: TerrainSettings,
  seed?: number
): WorldData {
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
  
  const biomeScale = Math.max(1, Math.min(10, Math.floor(s.biome_scale)));
  const totalWeight = Math.max(1, s.biome_weights.plains + s.biome_weights.forest + 
    s.biome_weights.desert + s.biome_weights.tundra);
  
  const plainsW = Math.max(0, s.biome_weights.plains) / totalWeight;
  const forestW = Math.max(0, s.biome_weights.forest) / totalWeight;
  const desertW = Math.max(0, s.biome_weights.desert) / totalWeight;
  const tundraW = Math.max(0, s.biome_weights.tundra) / totalWeight;
  
  const cdf = [plainsW, plainsW + forestW, plainsW + forestW + desertW, 1.01];
  
  const pondChance = s.pond_chance / 100.0;
  const riverChance = s.river_chance / 100.0;
  const riverWidthTiles = s.river_width > 0 ? s.river_width : Math.max(1, Math.floor((height / 32) / 120));
  
  // Generate temperature (north-south gradient + noise)
  const oct = 2 + Math.floor(biomeScale / 4);
  const lac = 1.3 + (10 - biomeScale) * 0.05;
  
  const tempNoise = generateNoise(cols, rows, oct, 0.5, lac, seed ? seed + 1 : undefined);
  const temperature = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const y = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      temperature[idx] = Math.max(0, Math.min(1, 0.85 * (1.0 - y) + 0.15 * tempNoise[idx]));
    }
  }
  
  // Generate moisture noise
  const moisture = generateNoise(cols, rows, oct + 1, 0.55, lac, seed ? seed + 2 : undefined);
  
  // Generate elevation
  const elevation = generateNoise(cols, rows, oct + 2, 0.55, lac + 0.1, seed);
  
  // Generate base biome field
  const baseNoise = generateNoise(cols, rows, oct, 0.5, lac, seed ? seed + 5 : undefined);
  let biomeGrid = new Uint8Array(rows * cols);
  
  // Map noise to biomes via CDF
  for (let i = 0; i < biomeGrid.length; i++) {
    const n = baseNoise[i];
    if (n < cdf[0]) {
      biomeGrid[i] = Biome.PLAINS;
    } else if (n < cdf[1]) {
      biomeGrid[i] = Biome.FOREST;
    } else if (n < cdf[2]) {
      biomeGrid[i] = Biome.DESERT;
    } else {
      biomeGrid[i] = Biome.TUNDRA;
    }
  }
  
  // Bias by temperature and moisture
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const temp = temperature[idx];
      const moist = moisture[idx];
      
      if (temp > 0.7 && moist < 0.35) {
        biomeGrid[idx] = Biome.DESERT;
      } else if (temp < 0.25) {
        biomeGrid[idx] = Biome.TUNDRA;
      } else if (moist > 0.7 && temp > 0.3) {
        biomeGrid[idx] = Biome.FOREST;
      }
    }
  }
  
  // Smooth biomes
  biomeGrid = majorityFilter(biomeGrid, cols, rows, 2);
  
  // Generate water
  const waterMask = new Array(rows * cols).fill(false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const waterPotential = (1.0 - elevation[idx]) * 0.6 + moisture[idx] * 0.4;
      if (waterPotential > (1.0 - pondChance)) {
        waterMask[idx] = true;
      }
    }
  }
  
  // Add river
  if (riverChance > 0.0) {
    const riverNoise = generateNoise(cols, 1, 2, 0.7, 1.0, seed ? seed + 3 : undefined);
    const halfWidth = Math.max(1, riverWidthTiles);
    
    for (let c = 0; c < cols; c++) {
      const t = c / (cols - 1);
      let riverCenter = 0.5 + 0.10 * Math.sin(2.0 * Math.PI * (t * 1.0 + (seed || 0) * 0.01));
      riverCenter += 0.05 * (riverNoise[c] - 0.5);
      const centerRow = Math.floor(riverCenter * (rows - 1));
      
      const r0 = Math.max(0, centerRow - halfWidth);
      const r1 = Math.min(rows - 1, centerRow + halfWidth);
      
      for (let r = r0; r <= r1; r++) {
        waterMask[r * cols + c] = true;
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
