/**
 * CreatureSprites - Procedural creature textures for 2.5D top-down rendering
 * Bodies are drawn with feet on the bottom edge of the canvas (anchor 0.5, 1).
 */

import { Texture, BaseTexture } from 'pixi.js';
import { RGB } from '../utils/types';

const squibbleCache = new Map<string, Texture>();
const gnawlinCache = new Map<string, Texture>();

function colorKey(color: RGB, size: number, kind: string): string {
  return `${kind}:${color[0]},${color[1]},${color[2]}:${Math.round(size)}`;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D, number] {
  const px = Math.max(16, Math.round(size * 2));
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx, px];
}

export function getSquibbleTexture(color: RGB, radius: number): Texture {
  const key = colorKey(color, radius, 'sq');
  const cached = squibbleCache.get(key);
  if (cached) return cached;

  const [canvas, ctx, w] = makeCanvas(radius);
  const h = w;
  const cx = w / 2;
  const footY = h - 2;
  const rx = w * 0.38;
  const ry = h * 0.36;

  ctx.save();
  ctx.translate(cx, footY);
  ctx.scale(1, ry / rx);
  const grad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.55, rx * 0.1, 0, -ry * 0.15, rx);
  grad.addColorStop(
    0,
    `rgba(${Math.min(255, color[0] + 55)}, ${Math.min(255, color[1] + 55)}, ${Math.min(255, color[2] + 55)}, 1)`
  );
  grad.addColorStop(0.55, `rgb(${color[0]}, ${color[1]}, ${color[2]})`);
  grad.addColorStop(
    1,
    `rgb(${Math.max(0, color[0] - 40)}, ${Math.max(0, color[1] - 40)}, ${Math.max(0, color[2] - 40)})`
  );
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, -ry * 0.2, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.15, footY - ry * 0.75, rx * 0.2, ry * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = Texture.from(BaseTexture.from(canvas));
  squibbleCache.set(key, tex);
  return tex;
}

export function getGnawlinTexture(color: RGB, size: number): Texture {
  const key = colorKey(color, size, 'gn');
  const cached = gnawlinCache.get(key);
  if (cached) return cached;

  const [canvas, ctx, w] = makeCanvas(size);
  const padX = w * 0.12;
  const padBottom = 2;
  const padTop = w * 0.14;
  const bodyW = w - padX * 2;
  const bodyH = w - padTop - padBottom;

  const grad = ctx.createLinearGradient(padX, padTop, padX + bodyW, padTop + bodyH);
  grad.addColorStop(
    0,
    `rgb(${Math.min(255, color[0] + 30)}, ${Math.min(255, color[1] + 30)}, ${Math.min(255, color[2] + 30)})`
  );
  grad.addColorStop(
    1,
    `rgb(${Math.max(0, color[0] - 50)}, ${Math.max(0, color[1] - 50)}, ${Math.max(0, color[2] - 50)})`
  );
  ctx.fillStyle = grad;
  ctx.fillRect(padX, padTop, bodyW, bodyH);

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.strokeRect(padX, padTop, bodyW, bodyH);

  const tex = Texture.from(BaseTexture.from(canvas));
  gnawlinCache.set(key, tex);
  return tex;
}
