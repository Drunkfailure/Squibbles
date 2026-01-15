/**
 * Common type definitions
 */

export type RGB = [number, number, number];

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Stats {
  count: number;
  alive: number;
  avg_hunger?: number;
  avg_thirst?: number;
  avg_health?: number;
  avg_speed?: number;
  seeking_food_count?: number;
  seeking_mate_count?: number;
}
