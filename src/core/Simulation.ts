/**
 * Simulation - Main simulation class that ties all systems together
 */

import { Game, GameSettings } from './Game';
import { Container, Graphics, Sprite } from 'pixi.js';
import { AssetLoader } from '../utils/AssetLoader';
import { SquibbleManager } from '../creatures/SquibbleManager';
import { Squibble } from '../creatures/Squibble';
import { FoodManager } from '../food/FoodManager';
import { generateWorld, WorldData } from '../terrain/WorldGenerator';
import { WaterMap } from '../terrain/WaterMap';
import { TerrainRenderer } from '../terrain/TerrainRenderer';
import { Renderer } from './Renderer';
import { EventManager } from './EventManager';
import { SimulationUI } from '../ui/SimulationUI';
import { StatsRecorder } from '../stats/StatsRecorder';
import { StatsGraphRenderer } from '../stats/StatsGraphRenderer';

export class Simulation extends Game {
  private squibbleManager: SquibbleManager;
  private foodManager: FoodManager;
  private waterMap: WaterMap | null = null;
  private worldData: WorldData | null = null;
  private terrainRenderer: TerrainRenderer;
  
  // Camera
  private cameraX: number = 0;
  private cameraY: number = 0;
  private zoomLevel: number = 1.0;
  private minZoom: number = 0.5;
  private maxZoom: number = 2.0;
  private zoomSpeed: number = 0.1;
  private cameraMoveSpeed: number = 10;
  private selectedSquibble: Squibble | null = null;
  
  // Rendering containers
  private terrainContainer: Container;
  private entityContainer: Container;
  private uiContainer: Container;
  private renderer: Renderer;
  private ui: SimulationUI;
  
  // Stats tracking
  private statsRecorder: StatsRecorder;
  private statsGraphRenderer: StatsGraphRenderer;
  private totalBirths: number = 0;
  private totalDeaths: number = 0;
  private lastAliveCount: number = 0;
  
  constructor(settings: GameSettings) {
    super(settings);
    
    this.squibbleManager = new SquibbleManager();
    this.foodManager = new FoodManager(
      settings.mapWidth,
      settings.mapHeight,
      settings.foodCount
    );
    this.terrainRenderer = new TerrainRenderer();
    this.ui = new SimulationUI(settings.screenWidth, settings.screenHeight);
    
    // Stats tracking
    this.statsRecorder = new StatsRecorder(1.0); // Record every 1 second
    this.statsGraphRenderer = new StatsGraphRenderer(this.statsRecorder);
    
    // Create containers
    this.terrainContainer = new Container();
    this.entityContainer = new Container();
    this.uiContainer = new Container();
    
    // Calculate camera offset to center the map
    this.cameraX = (settings.screenWidth - settings.mapWidth) / 2;
    this.cameraY = (settings.screenHeight - settings.mapHeight) / 2;
  }
  
  async initialize(onProgress?: (progress: number, message: string) => void): Promise<void> {
    await super.initialize();
    
    const app = this.getApp();
    
    // Add containers to stage
    app.stage.addChild(this.terrainContainer);
    app.stage.addChild(this.entityContainer);
    app.stage.addChild(this.uiContainer);
    app.stage.addChild(this.ui.getContainer());
    
    this.renderer = new Renderer(this.entityContainer);
    
    // Load assets first
    if (onProgress) {
      onProgress(10, 'Loading assets...');
    }
    const { AssetLoader } = await import('../utils/AssetLoader');
    await AssetLoader.loadAll();
    
    // Initialize terrain
    await this.initTerrain(onProgress);
    
    // Spawn initial squibbles
    if (onProgress) {
      onProgress(98, 'Spawning creatures...');
    }
    this.spawnInitialSquibbles();
    
    if (onProgress) {
      onProgress(100, 'Complete!');
    }
  }
  
  private async initTerrain(onProgress?: (progress: number, message: string) => void): Promise<void> {
    console.log('Generating terrain...');
    
    // Generate world
    this.worldData = await generateWorld(
      this.settings.mapWidth,
      this.settings.mapHeight,
      this.settings.terrain,
      undefined,
      onProgress
    );
    
    // Create water map
    this.waterMap = new WaterMap(
      this.worldData.waterMask,
      this.worldData.tileSize,
      this.worldData.rows,
      this.worldData.cols
    );
    
    // Render terrain
    this.terrainRenderer.createTerrainSprite(this.worldData, this.terrainContainer);
    
    // Respawn foods with biome awareness
    this.foodManager.spawnFood(
      this.worldData.biomeGrid,
      this.worldData.tileSize,
      this.worldData.cols
    );
    
    console.log('Terrain generation complete');
  }
  
  private spawnInitialSquibbles(): void {
    const count = this.settings.creatureCount;
    console.log(`Spawning ${count} squibbles...`);
    
    for (let i = 0; i < count; i++) {
      const x = 50 + Math.random() * (this.settings.mapWidth - 100);
      const y = 50 + Math.random() * (this.settings.mapHeight - 100);
      this.squibbleManager.addSquibble(x, y);
      
      if (i % 100 === 0 && i > 0) {
        console.log(`Spawned ${i}/${count} squibbles...`);
      }
    }
    
    console.log(`Finished spawning ${count} squibbles`);
  }
  
  protected onUpdate(dt: number): void {
    // Handle camera movement
    this.handleCameraMovement();
    
    if (!this.isPaused()) {
      // Update simulation systems
      this.squibbleManager.updateAll(
        dt,
        this.settings.mapWidth,
        this.settings.mapHeight,
        this.foodManager,
        this.waterMap || undefined
      );
      this.foodManager.update(dt);
      
      // Track stats
      this.updateStatsTracking(dt);
    }
    
    // Render
    this.draw();
  }
  
  private updateStatsTracking(dt: number): void {
    const squibbles = this.squibbleManager.getAlive();
    const currentAlive = squibbles.length;
    
    // Track births and deaths
    if (currentAlive > this.lastAliveCount) {
      this.totalBirths += currentAlive - this.lastAliveCount;
    } else if (currentAlive < this.lastAliveCount) {
      this.totalDeaths += this.lastAliveCount - currentAlive;
    }
    this.lastAliveCount = currentAlive;
    
    // Calculate detailed stats
    const stats: Record<string, number> = {
      population: currentAlive,
      births: this.totalBirths,
      deaths: this.totalDeaths,
    };
    
    if (currentAlive > 0) {
      let totalHunger = 0, totalThirst = 0, totalHealth = 0;
      let totalSpeed = 0, totalVision = 0;
      let totalAttractiveness = 0, totalVirility = 0, totalMaxAge = 0;
      let seekingFood = 0, seekingMate = 0, pregnant = 0, breeding = 0;
      let males = 0, females = 0;
      
      for (const s of squibbles) {
        totalHunger += s.hunger;
        totalThirst += s.thirst;
        totalHealth += s.health;
        totalSpeed += s.speed;
        totalVision += s.vision;
        totalAttractiveness += s.attractiveness;
        totalVirility += s.virility;
        totalMaxAge += s.maxAge / 60; // Convert to seconds
        
        if (s.hunger < 70) seekingFood++;
        if (s.seekingMate) seekingMate++;
        if (s.isPregnant) pregnant++;
        if (s.isBreeding) breeding++;
        if (s.gender === 'male') males++;
        else females++;
      }
      
      stats.avg_hunger = totalHunger / currentAlive;
      stats.avg_thirst = totalThirst / currentAlive;
      stats.avg_health = totalHealth / currentAlive;
      stats.avg_speed = totalSpeed / currentAlive;
      stats.avg_vision = totalVision / currentAlive;
      stats.avg_attractiveness = totalAttractiveness / currentAlive;
      stats.avg_virility = totalVirility / currentAlive;
      stats.avg_max_age = totalMaxAge / currentAlive;
      stats.seeking_food_count = seekingFood;
      stats.seeking_mate_count = seekingMate;
      stats.pregnant_count = pregnant;
      stats.breeding_count = breeding;
      stats.male_count = males;
      stats.female_count = females;
    }
    
    stats.available_food = this.foodManager.getFoodCount();
    
    this.statsRecorder.update(dt, stats);
  }
  
  private handleCameraMovement(): void {
    // If a squibble is selected, automatically follow it
    if (this.selectedSquibble && this.selectedSquibble.alive) {
      // Center camera on the selected squibble (works with any zoom level)
      this.cameraX = this.settings.screenWidth / 2 - this.selectedSquibble.x * this.zoomLevel;
      this.cameraY = this.settings.screenHeight / 2 - this.selectedSquibble.y * this.zoomLevel;
    } else {
      // Manual camera movement (only when nothing is selected)
      const events = this.getEventManager();
      
      if (events.isKeyPressed('ArrowLeft')) {
        this.cameraX += this.cameraMoveSpeed;
      }
      if (events.isKeyPressed('ArrowRight')) {
        this.cameraX -= this.cameraMoveSpeed;
      }
      if (events.isKeyPressed('ArrowUp')) {
        this.cameraY += this.cameraMoveSpeed;
      }
      if (events.isKeyPressed('ArrowDown')) {
        this.cameraY -= this.cameraMoveSpeed;
      }
    }
    
    // Handle zoom with [ and ]
    // Note: Key handling for brackets will be done in setupInputHandling override
  }
  
  private draw(): void {
    // Clear entity container
    this.entityContainer.removeChildren();
    
    // Update camera/zoom transforms
    const screenW = this.settings.screenWidth;
    const screenH = this.settings.screenHeight;
    const viewW = screenW / this.zoomLevel;
    const viewH = screenH / this.zoomLevel;
    let viewX = -this.cameraX / this.zoomLevel;
    let viewY = -this.cameraY / this.zoomLevel;
    
    // Clamp view
    viewX = Math.max(0, Math.min(this.settings.mapWidth - viewW, viewX));
    viewY = Math.max(0, Math.min(this.settings.mapHeight - viewH, viewY));
    
    // Update terrain position
    if (this.terrainContainer.children.length > 0) {
      const terrainSprite = this.terrainContainer.children[0] as Sprite;
      terrainSprite.x = -viewX * this.zoomLevel;
      terrainSprite.y = -viewY * this.zoomLevel;
      terrainSprite.scale.set(this.zoomLevel);
    }
    
    // Draw foods (culled to view)
    const foods = this.foodManager.getAllFood();
    for (const food of foods) {
      if (food.x >= viewX && food.x < viewX + viewW &&
          food.y >= viewY && food.y < viewY + viewH) {
        const sx = (food.x - viewX) * this.zoomLevel;
        const sy = (food.y - viewY) * this.zoomLevel;
        
        // Try to use sprite texture, fallback to circle
        const stage = food.remainingSlots + 1;
        const texture = AssetLoader.getFoodTexture(food.species, stage);
        
        if (texture) {
          const sprite = new Sprite(texture);
          const size = Math.max(1, 32 * this.zoomLevel);
          sprite.width = size;
          sprite.height = size;
          sprite.anchor.set(0.5);
          sprite.x = sx;
          sprite.y = sy;
          this.entityContainer.addChild(sprite);
        } else {
          // Fallback to circle
          const radius = food.radius * this.zoomLevel;
          this.renderer.drawCircle(sx, sy, radius, [0, 255, 0], 0.8);
        }
      }
    }
    
    // Draw squibbles (culled to view)
    const squibbles = this.squibbleManager.getAlive();
    for (const squibble of squibbles) {
      if (squibble.x >= viewX && squibble.x < viewX + viewW &&
          squibble.y >= viewY && squibble.y < viewY + viewH) {
        const sx = (squibble.x - viewX) * this.zoomLevel;
        const sy = (squibble.y - viewY) * this.zoomLevel;
        const radius = Math.max(1, squibble.radius * this.zoomLevel);
        
        // Draw squibble body
        this.renderer.drawCircle(sx, sy, radius, squibble.color, 1.0);
        
        // Draw love icon if breeding
        if (squibble.isBreeding) {
          const loveTexture = AssetLoader.getIconTexture('love');
          if (loveTexture) {
            const loveSize = radius * 2 * this.zoomLevel;
            const loveSprite = new Sprite(loveTexture);
            loveSprite.width = loveSize;
            loveSprite.height = loveSize;
            loveSprite.x = sx;
            loveSprite.y = sy - radius - loveSize * 0.8;
            loveSprite.anchor.set(0.5, 0.5);
            this.entityContainer.addChild(loveSprite);
          }
        }
        
        // Draw health bar
        this.drawHealthBar(sx, sy, radius, squibble.health, this.zoomLevel);
        
        // Draw status icons (includes love, hunger, thirst, fetus)
        this.drawStatusIcons(sx, sy, radius, squibble, this.zoomLevel);
        
        // Draw direction indicator
        const endX = sx + Math.cos(squibble.direction) * (radius + 5) * this.zoomLevel;
        const endY = sy + Math.sin(squibble.direction) * (radius + 5) * this.zoomLevel;
        this.renderer.drawLine(sx, sy, endX, endY, [255, 255, 255], Math.max(1, 2 * this.zoomLevel));
      }
    }
    
    // Draw UI
    const stats = this.squibbleManager.getStats();
    const foodStats = this.foodManager.getStats();
    this.ui.drawStatsPanel(stats, foodStats, this.zoomLevel);
    this.ui.drawPauseIndicator(this.isPaused());
    
    // Draw selected squibble details
    if (this.selectedSquibble && this.selectedSquibble.alive) {
      this.ui.drawSquibbleDetails(this.selectedSquibble);
      
      // Draw selection indicator (highlight circle)
      if (this.selectedSquibble.x >= viewX && this.selectedSquibble.x < viewX + viewW &&
          this.selectedSquibble.y >= viewY && this.selectedSquibble.y < viewY + viewH) {
        const sx = (this.selectedSquibble.x - viewX) * this.zoomLevel;
        const sy = (this.selectedSquibble.y - viewY) * this.zoomLevel;
        const radius = Math.max(1, this.selectedSquibble.radius * this.zoomLevel);
        
        // Draw selection ring
        const selectionRing = new Graphics();
        selectionRing.lineStyle(3, 0x00ffff, 1.0); // Cyan ring
        selectionRing.drawCircle(sx, sy, radius + 3);
        this.entityContainer.addChild(selectionRing);
      }
    } else {
      // No selection or squibble died - clear the details panel
      if (this.selectedSquibble && !this.selectedSquibble.alive) {
        // Selected squibble died, deselect
        this.selectedSquibble = null;
      }
      // Clear the details panel by passing null
      this.ui.drawSquibbleDetails(null);
    }
  }
  
  protected setupInputHandling(): void {
    super.setupInputHandling();
    
    // Handle zoom
    window.addEventListener('keydown', (e) => {
      if (e.code === 'BracketLeft') { // [
        this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomSpeed);
      } else if (e.code === 'BracketRight') { // ]
        this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomSpeed);
      } else if (e.code === 'KeyR') {
        // Reset simulation
        this.squibbleManager.clear();
        this.foodManager = new FoodManager(
          this.settings.mapWidth,
          this.settings.mapHeight,
          this.settings.foodCount
        );
        this.foodManager.spawnFood(
          this.worldData?.biomeGrid,
          this.worldData?.tileSize || 32,
          this.worldData?.cols
        );
        this.selectedSquibble = null;
        this.statsRecorder.clear();
        this.totalBirths = 0;
        this.totalDeaths = 0;
        this.lastAliveCount = 0;
        this.spawnInitialSquibbles();
      } else if (e.code === 'KeyA') {
        // Add a new squibble
        const x = 50 + Math.random() * (this.settings.mapWidth - 100);
        const y = 50 + Math.random() * (this.settings.mapHeight - 100);
        this.squibbleManager.addSquibble(x, y);
      } else if (e.code === 'KeyI') {
        // Toggle controls
        this.ui.toggleControls();
      } else if (e.code === 'KeyG') {
        // Show stats graphs
        this.statsGraphRenderer.show();
      } else if (e.code === 'Escape') {
        // Deselect squibble (handled in parent class, but also clear selection)
        this.selectedSquibble = null;
      }
    });
    
    // Handle mouse clicks
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        const events = this.getEventManager();
        const mousePos = events.getMousePosition();
        
        // Convert screen coords to world coords
        const viewW = this.settings.screenWidth / this.zoomLevel;
        const viewH = this.settings.screenHeight / this.zoomLevel;
        let viewX = -this.cameraX / this.zoomLevel;
        let viewY = -this.cameraY / this.zoomLevel;
        viewX = Math.max(0, Math.min(this.settings.mapWidth - viewW, viewX));
        viewY = Math.max(0, Math.min(this.settings.mapHeight - viewH, viewY));
        
        const worldX = viewX + (mousePos.x / this.zoomLevel);
        const worldY = viewY + (mousePos.y / this.zoomLevel);
        
        if (e.shiftKey) {
          // Shift+Click: Add new squibble
          this.squibbleManager.addSquibble(worldX, worldY);
        } else {
          // Regular click: Select squibble (camera will auto-follow)
          const clickedSquibble = this.findSquibbleAtPosition(worldX, worldY);
          if (clickedSquibble) {
            this.selectedSquibble = clickedSquibble;
          } else {
            // Clicked empty space - deselect
            this.selectedSquibble = null;
          }
        }
      }
    });
  }
  
  /**
   * Find a squibble at the given world coordinates
   */
  private findSquibbleAtPosition(worldX: number, worldY: number): Squibble | null {
    const clickRadius = 15; // Click detection radius
    
    for (const squibble of this.squibbleManager.getAlive()) {
      const dx = squibble.x - worldX;
      const dy = squibble.y - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= squibble.radius + clickRadius) {
        return squibble;
      }
    }
    
    return null;
  }
  
  public getSquibbleManager(): SquibbleManager {
    return this.squibbleManager;
  }
  
  public getFoodManager(): FoodManager {
    return this.foodManager;
  }
  
  public getZoomLevel(): number {
    return this.zoomLevel;
  }
  
  private drawHealthBar(x: number, y: number, radius: number, health: number, zoom: number): void {
    const barWidth = 20 * zoom;
    const barHeight = 3 * zoom;
    const barX = x - barWidth / 2;
    const barY = y - radius - 15 * zoom;
    
    // Background
    this.renderer.drawRect(barX, barY, barWidth, barHeight, [100, 100, 100], 1.0);
    
    // Health fill
    const healthWidth = (health / 100.0) * barWidth;
    if (healthWidth > 0) {
      let color: [number, number, number];
      if (health > 50) {
        // Green to yellow
        const green = 255;
        const red = Math.floor(255 * (1 - (health - 50) / 50));
        color = [red, green, 0];
      } else {
        // Yellow to red
        const red = 255;
        const green = Math.floor(255 * (health / 50));
        color = [red, green, 0];
      }
      this.renderer.drawRect(barX, barY, healthWidth, barHeight, color, 1.0);
    }
  }
  
  private drawStatusIcons(
    x: number,
    y: number,
    radius: number,
    squibble: any,
    zoom: number
  ): void {
    const iconSize = 12 * zoom;
    const iconSpacing = 2 * zoom;
    // Position icons above health bar (health bar is at y - radius - 15 * zoom, so icons go above that)
    const iconY = y - radius - 30 * zoom;
    
    // Collect all icons to display (order: love, hunger, thirst, fetus)
    const icons: string[] = [];
    
    // Love icon (seeking mate or breeding)
    if (squibble.seekingMate || squibble.isBreeding) {
      icons.push('love');
    }
    
    // Hunger icon (show when below 50)
    if (squibble.hunger < 50.0) {
      icons.push('hunger');
    }
    
    // Thirst icon (show when below 50)
    if (squibble.thirst < 50.0) {
      icons.push('thirst');
    }
    
    // Pregnant icon
    if (squibble.isPregnant) {
      icons.push('fetus');
    }
    
    // Health icon (show when below 50) - commented out since health.png doesn't exist
    // if (squibble.health < 50) {
    //   icons.push('health');
    // }
    
    // Calculate total width to center icons
    const totalWidth = icons.length * iconSize + (icons.length - 1) * iconSpacing;
    let iconX = x - totalWidth / 2 + iconSize / 2;
    
    // Draw each icon
    for (const iconName of icons) {
      const texture = AssetLoader.getIconTexture(iconName);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.width = iconSize;
        sprite.height = iconSize;
        sprite.anchor.set(0.5);
        sprite.x = iconX;
        sprite.y = iconY;
        this.entityContainer.addChild(sprite);
      }
      iconX += iconSize + iconSpacing;
    }
  }
  
  private drawHeart(x: number, y: number, size: number, color: [number, number, number]): void {
    // Simple heart indicator - just a small filled circle with pink color
    const graphics = new Graphics();
    graphics.beginFill((color[0] << 16) | (color[1] << 8) | color[2], 0.8);
    graphics.drawCircle(x, y, size * 0.4);
    graphics.endFill();
    this.entityContainer.addChild(graphics);
  }
}
