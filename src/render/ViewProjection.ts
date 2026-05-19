/**
 * ViewProjection - Terrain height → world Z and entity placement helpers
 */

import { Camera3D } from './Camera3D';

/** World Z units for normalized land height 1.0 (peak mountain rise). */
export const TILE_Z_SCALE = 64;

/** Sea level — water surface and the lowest allowed land (normalized 0 → world Y 0). */
export const WATER_SURFACE_HEIGHT = 0;

/** World Z of the flat water plane. */
export const WATER_WORLD_Z = 0;

/**
 * Lowest land surface in world units (~1 Minecraft block above sea).
 * Land never generates below this; water stays at WATER_WORLD_Z.
 */
/** Visible step above flat water (sea level = 0). */
export const MIN_LAND_WORLD_Z = 24;

/** Normalized minimum land height (maps to MIN_LAND_WORLD_Z). */
export const MIN_LAND_SURFACE_HEIGHT = MIN_LAND_WORLD_Z / TILE_Z_SCALE;

/** Squibbles partially submerge in water (screen pixels, post-project). */
export const SQUIBBLE_WATER_SINK_PX = 0.42;

export function heightToWorldZ(height: number, isWater: boolean = false): number {
  if (isWater) return WATER_WORLD_Z;
  return landHeightToWorldZ(height);
}

export function landHeightToWorldZ(normalizedLandHeight: number): number {
  return Math.max(MIN_LAND_WORLD_Z, normalizedLandHeight * TILE_Z_SCALE);
}

export function projectWorldPoint(
  camera: Camera3D,
  wx: number,
  wy: number,
  wz: number
): { sx: number; sy: number; depth: number } {
  return camera.project(wx, wy, wz);
}

export function sortDepth(camera: Camera3D, wx: number, wy: number, wz: number, foot: number): number {
  const { depth } = camera.project(wx, wy, wz);
  return depth + foot * 0.02;
}
