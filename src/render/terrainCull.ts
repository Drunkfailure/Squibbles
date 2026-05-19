/**
 * terrainCull - Screen-space back-face culling for terrain polygons (Pixi Y-down)
 */

import { Graphics } from 'pixi.js';

export interface ScreenPoint {
  sx: number;
  sy: number;
}

export function signedScreenArea(pts: ScreenPoint[]): number {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += pts[i].sx * pts[j].sy - pts[j].sx * pts[i].sy;
  }
  return a * 0.5;
}

/** True if polygon faces the camera (CCW in screen space, Y-down). */
export function isFrontFacing(pts: ScreenPoint[]): boolean {
  return signedScreenArea(pts) < 0;
}

export function drawTriIfVisible(
  g: Graphics,
  fill: number,
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint
): void {
  if (!isFrontFacing([a, b, c])) return;
  g.beginFill(fill);
  g.drawPolygon([a.sx, a.sy, b.sx, b.sy, c.sx, c.sy]);
  g.endFill();
}

/** Always draw (vertical walls — avoids holes when back-face culling rejects a face). */
export function drawTriAlways(
  g: Graphics,
  fill: number,
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint
): void {
  g.beginFill(fill);
  g.drawPolygon([a.sx, a.sy, b.sx, b.sy, c.sx, c.sy]);
  g.endFill();
}

export function drawQuadAlways(
  g: Graphics,
  fill: number,
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint,
  d: ScreenPoint
): void {
  if (distSq(a, c) <= distSq(b, d)) {
    drawTriAlways(g, fill, a, b, c);
    drawTriAlways(g, fill, a, c, d);
  } else {
    drawTriAlways(g, fill, a, b, d);
    drawTriAlways(g, fill, b, c, d);
  }
}

function distSq(a: ScreenPoint, b: ScreenPoint): number {
  const dx = a.sx - b.sx;
  const dy = a.sy - b.sy;
  return dx * dx + dy * dy;
}

/** Split a quad using the shorter screen diagonal (avoids bow-tie gaps on slopes). */
export function drawQuadAsTris(
  g: Graphics,
  fill: number,
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint,
  d: ScreenPoint
): void {
  if (distSq(a, c) <= distSq(b, d)) {
    drawTriIfVisible(g, fill, a, b, c);
    drawTriIfVisible(g, fill, a, c, d);
  } else {
    drawTriIfVisible(g, fill, a, b, d);
    drawTriIfVisible(g, fill, b, c, d);
  }
}
