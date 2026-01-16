/**
 * Biome types
 */

export enum Biome {
  PLAINS = 1,
  FOREST = 2,
  DESERT = 3,
  TUNDRA = 4,
  WATER = 5,
}

export const BIOME_COLORS: Record<Biome, [number, number, number]> = {
  [Biome.PLAINS]: [120, 180, 110],   // light green
  [Biome.FOREST]: [70, 110, 70],     // forest green
  [Biome.DESERT]: [220, 200, 140],   // sand
  [Biome.TUNDRA]: [200, 210, 220],   // icy/gray
  [Biome.WATER]: [40, 80, 130],      // water blue
};

export const WATER_COLOR: [number, number, number] = [40, 80, 130];
