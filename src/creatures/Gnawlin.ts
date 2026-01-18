/**
 * Gnawlin - Predator creature that hunts Squibbles
 */

import { RGB, Point } from '../utils/types';

export class Gnawlin {
  // Static counter for unique IDs
  private static nextId: number = 1;
  
  public id: number; // Unique identifier for this gnawlin
  public x: number;
  public y: number;
  public color: RGB;
  public size: number = 20; // Size of the square (larger than squibbles which are radius 8-12)
  public alive: boolean = true;
  
  // Stats
  public health: number = 100.0;
  public maxHealth: number = 100.0;
  public speed: number = 2.5; // Faster than squibbles
  public vision: number = 150; // Good vision for hunting
  
  constructor(x: number, y: number, color?: RGB) {
    // Assign unique ID
    this.id = Gnawlin.nextId++;
    
    this.x = x;
    this.y = y;
    this.color = color || [200, 50, 50]; // Default red/orange color for predators
    
    // Initialize health
    this.health = this.maxHealth;
  }
  
  /**
   * Update gnawlin behavior (hunting, movement, etc.)
   */
  update(
    dt: number,
    screenWidth: number,
    screenHeight: number,
    squibbleManager?: any // For finding prey
  ): void {
    if (!this.alive) return;
    
    // TODO: Add hunting behavior, movement, etc.
    // This will be implemented based on user's requirements
  }
  
  /**
   * Get stats for display
   */
  getStats() {
    return {
      id: this.id,
      health: this.health,
      max_health: this.maxHealth,
      health_percentage: (this.health / this.maxHealth) * 100,
      speed: this.speed,
      vision: this.vision,
      alive: this.alive,
    };
  }
}
