/**
 * Core Game class - manages the main game loop and application lifecycle
 */

import { Application } from 'pixi.js';
import { EventManager } from './EventManager';

export interface GameSettings {
  mapWidth: number;
  mapHeight: number;
  screenWidth: number;
  screenHeight: number;
  creatureCount: number;
  terrain?: {
    biome_scale: number;
    biome_weights: {
      plains: number;
      forest: number;
      desert: number;
      tundra: number;
    };
    pond_chance: number;
    river_chance: number;
    river_width: number;
    /** Tile size in world units. Default 64. */
    tile_size?: number;
  };
}

export class Game {
  private app: Application;
  private running: boolean = false;
  private paused: boolean = false;
  private lastTime: number = 0;
  private eventManager: EventManager;
  
  public readonly settings: GameSettings;
  
  constructor(settings: GameSettings) {
    this.settings = settings;
    this.eventManager = new EventManager();
  }
  
  async initialize(): Promise<void> {
    // Initialize PixiJS with canvas
    // For PixiJS v7.4+, use Application constructor with options
    this.app = new Application({
      width: this.settings.screenWidth,
      height: this.settings.screenHeight,
      backgroundColor: 0x141e28, // (20, 30, 40) in RGB
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    
    // Append canvas to DOM
    const appElement = document.getElementById('app');
    if (appElement) {
      // In PixiJS v7, canvas might be 'view' or 'canvas'
      const canvas = (this.app as any).canvas || (this.app as any).view;
      if (canvas) {
        appElement.appendChild(canvas);
      }
    }
    
    // Set up ticker for game loop
    this.app.ticker.add(() => this.update());
    
    // Set up input handling
    this.setupInputHandling();
    
    console.log('Game initialized:', {
      screen: `${this.settings.screenWidth}x${this.settings.screenHeight}`,
      map: `${this.settings.mapWidth}x${this.settings.mapHeight}`,
      creatures: this.settings.creatureCount,
    });
  }
  
  private update(): void {
    if (!this.running || this.paused) {
      return;
    }
    
    const currentTime = performance.now();
    const dt = this.lastTime > 0 ? (currentTime - this.lastTime) / 1000.0 : 0.016; // Convert to seconds
    this.lastTime = currentTime;
    
    // Clamp delta time to prevent large jumps
    const clampedDt = Math.min(dt, 0.1);
    
    // Update game systems here (will be added in later phases)
    this.onUpdate(clampedDt);
  }
  
  protected onUpdate(dt: number): void {
    // Override in subclasses or attach update handlers
  }
  
  protected setupInputHandling(): void {
    // Handle ESC to quit
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.stop();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      }
    });
  }
  
  public getEventManager(): EventManager {
    return this.eventManager;
  }
  
  public start(): void {
    this.running = true;
    this.lastTime = performance.now();
    console.log('Game started');
  }
  
  public stop(): void {
    this.running = false;
    console.log('Game stopped');
  }
  
  public pause(): void {
    this.paused = true;
  }
  
  public resume(): void {
    this.paused = false;
  }
  
  public togglePause(): void {
    this.paused = !this.paused;
  }
  
  public isPaused(): boolean {
    return this.paused;
  }
  
  public getApp(): Application {
    return this.app;
  }
  
  public cleanup(): void {
    this.stop();
    this.app.destroy(true, { children: true, texture: true });
  }
}
