/**
 * TerrainMovement - Step vs climb height checks for creatures on the height map
 */

import { HeightMap } from './HeightMap';
import { WaterMap } from './WaterMap';

export interface ClimbState {
  isClimbing: boolean;
  progress: number;
  fromZ: number;
  toZ: number;
  anchorX: number;
  anchorY: number;
  targetX: number;
  targetY: number;
}

export function createClimbState(): ClimbState {
  return {
    isClimbing: false,
    progress: 0,
    fromZ: 0,
    toZ: 0,
    anchorX: 0,
    anchorY: 0,
    targetX: 0,
    targetY: 0,
  };
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function getClimbDurationSec(creatureSize: number, dz: number, horizDist: number): number {
  const base = 1.6 + creatureSize * 0.08;
  const vertical = Math.abs(dz) * 0.06;
  const horizontal = horizDist * 0.01;
  return Math.min(6, Math.max(2, base + vertical + horizontal));
}

/** Max height change (world Z) the creature can walk onto without climbing. */
export function getStepWorldZ(creatureSize: number): number {
  return creatureSize * 2.5 + 10;
}

/** Max height change the creature can scale by climbing. */
export function getMaxClimbWorldZ(creatureSize: number): number {
  return creatureSize * 14;
}

/**
 * Foot on the wall face: vertical motion first, small step onto the ledge at the end.
 */
export function getClimbWorldPosition(
  climb: ClimbState,
  tileSize: number
): { x: number; y: number; z: number } {
  const t = smoothstep(climb.progress);
  const z = climb.fromZ + (climb.toZ - climb.fromZ) * t;

  const dx = climb.targetX - climb.anchorX;
  const dy = climb.targetY - climb.anchorY;
  const len = Math.hypot(dx, dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;

  // Stay at wall base for most of the climb; step onto tile in the last 12%
  const xyPhase = t < 0.88 ? 0 : (t - 0.88) / 0.12;
  let x = climb.anchorX + dx * xyPhase;
  let y = climb.anchorY + dy * xyPhase;

  // Pull back toward the low tile so the sprite sits on the wall, not inside the block
  const wallStandoff = tileSize * 0.38 * (1 - xyPhase);
  x -= dirX * wallStandoff;
  y -= dirY * wallStandoff;

  return { x, y, z };
}

export interface TerrainMoveContext {
  x: number;
  y: number;
  direction: number;
  stepDistance: number;
  creatureSize: number;
  climb: ClimbState;
  heightMap: HeightMap;
  waterMap?: WaterMap;
}

export interface TerrainMoveResult {
  x: number;
  y: number;
  direction: number;
  moved: boolean;
  blocked: boolean;
}

export function updateTerrainMovement(
  dt: number,
  ctx: TerrainMoveContext
): TerrainMoveResult {
  let { x, y, direction, stepDistance, creatureSize, climb, heightMap, waterMap } = ctx;
  const tileSize = heightMap.getTileSize();

  if (climb.isClimbing) {
    const horiz = Math.hypot(climb.targetX - climb.anchorX, climb.targetY - climb.anchorY);
    const duration = getClimbDurationSec(creatureSize, climb.toZ - climb.fromZ, horiz);
    climb.progress = Math.min(1, climb.progress + dt / duration);

    const faceDir = Math.atan2(climb.targetY - climb.anchorY, climb.targetX - climb.anchorX);
    direction = faceDir;

    const pos = getClimbWorldPosition(climb, tileSize);

    if (climb.progress >= 1) {
      climb.isClimbing = false;
      climb.progress = 0;
      return {
        x: climb.targetX,
        y: climb.targetY,
        direction: faceDir,
        moved: true,
        blocked: false,
      };
    }

    return {
      x: pos.x,
      y: pos.y,
      direction: faceDir,
      moved: false,
      blocked: false,
    };
  }

  const nextX = x + Math.cos(direction) * stepDistance;
  const nextY = y + Math.sin(direction) * stepDistance;

  const inWater = waterMap?.isWaterAt(x, y) ?? false;
  const nextInWater = waterMap?.isWaterAt(nextX, nextY) ?? false;
  if (inWater || nextInWater) {
    return { x: nextX, y: nextY, direction, moved: true, blocked: false };
  }

  const z0 = heightMap.getSurfaceWorldZ(x, y);
  const z1 = heightMap.getSurfaceWorldZ(nextX, nextY);
  const dz = z1 - z0;
  const stepLimit = getStepWorldZ(creatureSize);
  const maxClimb = getMaxClimbWorldZ(creatureSize);

  if (Math.abs(dz) <= stepLimit) {
    return { x: nextX, y: nextY, direction, moved: true, blocked: false };
  }

  if (Math.abs(dz) > maxClimb) {
    direction += Math.PI + (Math.random() - 0.5) * 0.6;
    return { x, y, direction, moved: false, blocked: true };
  }

  climb.isClimbing = true;
  climb.progress = 0;
  climb.fromZ = z0;
  climb.toZ = z1;
  climb.anchorX = x;
  climb.anchorY = y;
  climb.targetX = nextX;
  climb.targetY = nextY;

  return { x, y, direction, moved: false, blocked: false };
}
