/**
 * WorldRenderer - Entities on extruded 3D terrain (Camera3D projection)
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Squibble } from '../creatures/Squibble';
import { Gnawlin } from '../creatures/Gnawlin';
import { HeightMap } from '../terrain/HeightMap';
import { WaterMap } from '../terrain/WaterMap';
import { Renderer } from '../core/Renderer';
import { AssetLoader } from '../utils/AssetLoader';
import { getSquibbleTexture, getGnawlinTexture } from './CreatureSprites';
import { Camera3D } from './Camera3D';
import { SQUIBBLE_WATER_SINK_PX, projectWorldPoint, sortDepth } from './ViewProjection';

export interface EntityScreenPos {
  sx: number;
  sy: number;
  footSy: number;
  sortY: number;
}

export class WorldRenderer {
  constructor(
    private entityContainer: Container,
    private renderer: Renderer,
    private camera: Camera3D,
    private heightMap: HeightMap | null,
    private waterMap: WaterMap | null
  ) {}

  getEntityScreen(
    worldX: number,
    worldY: number,
    footExtent: number,
    opts?: { squibbleRadius?: number; worldZ?: number }
  ): EntityScreenPos {
    const onWater = this.waterMap?.isWaterAt(worldX, worldY) ?? false;
    const wz = opts?.worldZ ?? this.heightMap?.getSurfaceWorldZ(worldX, worldY) ?? 0;
    const { sx, sy } = projectWorldPoint(this.camera, worldX, worldY, wz);
    let footSy = sy;

    if (onWater && opts?.squibbleRadius != null) {
      footSy += opts.squibbleRadius * this.camera.zoom * SQUIBBLE_WATER_SINK_PX;
    }

    const sortY = sortDepth(this.camera, worldX, worldY, wz, footExtent);
    return { sx, sy, footSy, sortY };
  }

  drawBlobShadow(
    parent: Container,
    sx: number,
    footSy: number,
    radiusPx: number,
    alpha: number = 0.28
  ): void {
    const g = new Graphics();
    g.beginFill(0x000000, alpha);
    g.drawEllipse(sx, footSy + 1, radiusPx * 0.9, radiusPx * 0.22);
    g.endFill();
    parent.addChild(g);
  }

  drawPropSprite(
    parent: Container,
    texture: Texture,
    sx: number,
    footSy: number,
    sizePx: number,
    flipH: boolean
  ): void {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.width = sizePx;
    sprite.height = sizePx;
    if (flipH) sprite.scale.x = -Math.abs(sprite.scale.x);
    sprite.x = sx;
    sprite.y = footSy;
    parent.addChild(sprite);
  }

  drawSquibble(
    parent: Container,
    squibble: Squibble,
    sx: number,
    footSy: number,
    zoom: number,
    drawOverlays: (footX: number, headY: number, radiusPx: number) => void
  ): void {
    const radiusPx = Math.max(1, squibble.radius * zoom);
    const footX = sx;

    this.drawBlobShadow(parent, footX, footSy, radiusPx * 0.85);

    const texture = getSquibbleTexture(squibble.color, squibble.radius);
    const sprite = new Sprite(texture);
    const px = radiusPx * 2.15;
    sprite.anchor.set(0.5, 1);
    sprite.width = px;
    sprite.height = px;
    sprite.x = footX;
    sprite.y = footSy;
    parent.addChild(sprite);

    const bodyCenterY = footSy - radiusPx * 0.88;
    const endX = footX + Math.cos(squibble.direction) * (radiusPx + 4);
    const endY = bodyCenterY + Math.sin(squibble.direction) * (radiusPx + 4) * 0.45;
    const lineG = new Graphics();
    lineG
      .lineStyle(Math.max(1, 2 * zoom), 0xffffff, 1)
      .moveTo(footX, bodyCenterY)
      .lineTo(endX, endY);
    parent.addChild(lineG);

    if (squibble.isBreeding) {
      const loveTexture = AssetLoader.getIconTexture('love');
      if (loveTexture) {
        const loveSize = radiusPx * 1.8;
        const loveSprite = new Sprite(loveTexture);
        loveSprite.width = loveSize;
        loveSprite.height = loveSize;
        loveSprite.anchor.set(0.5, 1);
        loveSprite.x = footX;
        loveSprite.y = footSy - radiusPx * 1.9;
        parent.addChild(loveSprite);
      }
    }

    drawOverlays(footX, footSy - radiusPx * 1.75, radiusPx);
  }

  drawGnawlin(
    parent: Container,
    gnawlin: Gnawlin,
    sx: number,
    footSy: number,
    zoom: number,
    drawOverlays: (footX: number, headY: number, halfSizePx: number) => void
  ): void {
    const sizePx = Math.max(1, gnawlin.currentSize * zoom);
    const halfSize = sizePx / 2;
    const footX = sx;

    this.drawBlobShadow(parent, footX, footSy, halfSize * 1.1);

    const texture = getGnawlinTexture(gnawlin.color, gnawlin.currentSize);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.width = sizePx * 1.12;
    sprite.height = sizePx * 1.12;
    sprite.x = footX;
    sprite.y = footSy;
    parent.addChild(sprite);

    const bodyCenterY = footSy - halfSize * 0.95;
    const endX = footX + Math.cos(gnawlin.direction) * (halfSize + 4);
    const endY = bodyCenterY + Math.sin(gnawlin.direction) * (halfSize + 4) * 0.45;
    const lineG = new Graphics();
    lineG
      .lineStyle(Math.max(1, 2 * zoom), 0xffffff, 1)
      .moveTo(footX, bodyCenterY)
      .lineTo(endX, endY);
    parent.addChild(lineG);

    if (gnawlin.isBreeding) {
      const loveTexture = AssetLoader.getIconTexture('love');
      if (loveTexture) {
        const loveSize = sizePx * 1.1;
        const loveSprite = new Sprite(loveTexture);
        loveSprite.width = loveSize;
        loveSprite.height = loveSize;
        loveSprite.anchor.set(0.5, 1);
        loveSprite.x = footX;
        loveSprite.y = footSy - halfSize * 1.5;
        parent.addChild(loveSprite);
      }
    }

    drawOverlays(footX, footSy - halfSize * 1.85, halfSize);
  }

  drawHealthBar(
    parent: Container,
    x: number,
    y: number,
    radius: number,
    health: number,
    maxHealth: number,
    zoom: number
  ): void {
    const layerRenderer = new Renderer(parent);
    const barWidth = 20 * zoom;
    const barHeight = 3 * zoom;
    const barX = x - barWidth / 2;
    const barY = y - 6 * zoom;

    layerRenderer.drawRect(barX, barY, barWidth, barHeight, [100, 100, 100], 1.0);

    const healthPercentage = health / maxHealth;
    const healthWidth = healthPercentage * barWidth;
    if (healthWidth > 0) {
      let color: [number, number, number];
      const healthPercent = healthPercentage * 100;
      if (healthPercent > 50) {
        const green = 255;
        const red = Math.floor(255 * (1 - (healthPercent - 50) / 50));
        color = [red, green, 0];
      } else {
        const red = 255;
        const green = Math.floor(255 * (healthPercent / 50));
        color = [red, green, 0];
      }
      layerRenderer.drawRect(barX, barY, healthWidth, barHeight, color, 1.0);
    }
  }

  drawStatusIcons(
    parent: Container,
    x: number,
    y: number,
    radius: number,
    creature: Squibble | Gnawlin,
    zoom: number
  ): void {
    const iconSize = 12 * zoom;
    const iconSpacing = 2 * zoom;
    const iconY = y - 12 * zoom;

    const icons: string[] = [];
    if (creature.seekingMate && !creature.isBreeding) icons.push('love');
    if (creature.hunger < 70.0 || creature.isEating) icons.push('hunger');
    if (creature.thirst < 70.0) icons.push('thirst');
    if (creature.isPregnant) icons.push('fetus');
    if (creature.isInCombat) icons.push('sword');

    const totalWidth = icons.length * iconSize + (icons.length - 1) * iconSpacing;
    let iconX = x - totalWidth / 2 + iconSize / 2;

    for (const iconName of icons) {
      const texture = AssetLoader.getIconTexture(iconName);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.width = iconSize;
        sprite.height = iconSize;
        sprite.anchor.set(0.5);
        sprite.x = iconX;
        sprite.y = iconY;
        parent.addChild(sprite);
      }
      iconX += iconSize + iconSpacing;
    }
  }
}
