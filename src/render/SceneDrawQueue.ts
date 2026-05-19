/**
 * SceneDrawQueue - Depth-sorted interleaved terrain + entity drawing
 */

import { Container, Graphics } from 'pixi.js';

export interface SceneDrawable {
  depth: number;
  kind: 'terrain' | 'entity';
  drawTerrain?: (g: Graphics) => void;
  drawEntity?: (parent: Container) => void;
}

/** Draw terrain faces into a single Graphics (depth order, back to front). */
export function renderTerrainToGraphics(g: Graphics, drawables: SceneDrawable[]): void {
  const terrain = drawables.filter((d) => d.kind === 'terrain' && d.drawTerrain);
  terrain.sort((a, b) => a.depth - b.depth);
  for (const d of terrain) {
    d.drawTerrain!(g);
  }
}

/** Draw entity layers into container; returns next zIndex for further layers. */
export function renderEntityDrawables(
  container: Container,
  drawables: SceneDrawable[],
  startZ = 0
): number {
  const entities = drawables.filter((d) => d.kind === 'entity' && d.drawEntity);
  entities.sort((a, b) => a.depth - b.depth);

  let z = startZ;
  for (const d of entities) {
    const layer = new Container();
    layer.zIndex = z++;
    d.drawEntity!(layer);
    container.addChild(layer);
  }

  container.sortChildren();
  return z;
}

/** @deprecated Prefer renderTerrainToGraphics + renderEntityDrawables */
export function renderSceneDrawables(container: Container, drawables: SceneDrawable[]): void {
  const terrainBatch = new Graphics();
  renderTerrainToGraphics(terrainBatch, drawables);
  terrainBatch.zIndex = 0;
  container.addChild(terrainBatch);
  renderEntityDrawables(container, drawables, 1);
}
