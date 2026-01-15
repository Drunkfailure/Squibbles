/**
 * Renderer - Wrapper around PixiJS for easier drawing operations
 */

import { Graphics, Container, ColorSource } from 'pixi.js';
import { Point, RGB } from '../utils/types';

export class Renderer {
  private container: Container;
  
  constructor(container: Container) {
    this.container = container;
  }
  
  /**
   * Draw a circle
   */
  drawCircle(x: number, y: number, radius: number, color: RGB | ColorSource, alpha: number = 1.0): void {
    const graphics = new Graphics();
    const colorValue = this.rgbToColor(color);
    graphics
      .beginFill(colorValue, alpha)
      .drawCircle(x, y, radius)
      .endFill();
    this.container.addChild(graphics);
  }
  
  /**
   * Draw a line
   */
  drawLine(x1: number, y1: number, x2: number, y2: number, color: RGB | ColorSource, width: number = 1, alpha: number = 1.0): void {
    const graphics = new Graphics();
    const colorValue = this.rgbToColor(color);
    graphics
      .lineStyle(width, colorValue, alpha)
      .moveTo(x1, y1)
      .lineTo(x2, y2);
    this.container.addChild(graphics);
  }
  
  /**
   * Draw a rectangle
   */
  drawRect(x: number, y: number, width: number, height: number, color: RGB | ColorSource, alpha: number = 1.0): void {
    const graphics = new Graphics();
    const colorValue = this.rgbToColor(color);
    graphics
      .beginFill(colorValue, alpha)
      .drawRect(x, y, width, height)
      .endFill();
    this.container.addChild(graphics);
  }
  
  /**
   * Clear all graphics
   */
  clear(): void {
    this.container.removeChildren();
  }
  
  /**
   * Convert RGB tuple to PixiJS color
   */
  private rgbToColor(color: RGB | ColorSource): ColorSource {
    if (Array.isArray(color)) {
      return (color[0] << 16) | (color[1] << 8) | color[2];
    }
    return color;
  }
  
  /**
   * Get the container for advanced operations
   */
  getContainer(): Container {
    return this.container;
  }
}
