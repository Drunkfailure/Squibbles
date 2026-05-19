/**
 * WorldDrawQueue - Depth-sorted terrain + entities (painter's algorithm)
 */

import { Container, Graphics } from 'pixi.js';

export interface DepthDrawJob {
  depth: number;
  draw: (g: Graphics) => void;
}

export interface DepthSpriteJob {
  depth: number;
  add: (container: Container, zIndex: number) => void;
}

const DEPTH_SCALE = 220;

export function depthToZIndex(depth: number): number {
  return Math.floor(depth * DEPTH_SCALE);
}

/**
 * Flush terrain and sprite jobs back-to-front into one sortable container.
 */
export function flushWorldDrawQueue(
  container: Container,
  terrainJobs: DepthDrawJob[],
  spriteJobs: DepthSpriteJob[]
): void {
  container.removeChildren();
  container.sortableChildren = true;

  type Merged =
    | { kind: 'terrain'; depth: number; draw: (g: Graphics) => void }
    | { kind: 'sprite'; depth: number; add: (c: Container, z: number) => void };

  const merged: Merged[] = [
    ...terrainJobs.map((j) => ({ kind: 'terrain' as const, depth: j.depth, draw: j.draw })),
    ...spriteJobs.map((j) => ({ kind: 'sprite' as const, depth: j.depth, add: j.add })),
  ];
  merged.sort((a, b) => a.depth - b.depth);

  const bucketGfx = new Map<number, Graphics>();

  for (const job of merged) {
    const z = depthToZIndex(job.depth);
    if (job.kind === 'terrain') {
      let g = bucketGfx.get(z);
      if (!g) {
        g = new Graphics();
        bucketGfx.set(z, g);
      }
      job.draw(g);
    } else {
      job.add(container, z);
    }
  }

  for (const [z, g] of bucketGfx) {
    g.zIndex = z;
    container.addChild(g);
  }

  container.sortChildren();
}
