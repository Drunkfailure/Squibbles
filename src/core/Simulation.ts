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
    
    // Create containers
    this.terrainContainer = new Container();
    this.entityContainer = new Container();
    this.uiContainer = new Container();
    
    // Calculate camera offset to center the map
    this.cameraX = (settings.screenWidth - settings.mapWidth) / 2;
    this.cameraY = (settings.screenHeight - settings.mapHeight) / 2;
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    const app = this.getApp();
    
    // Add containers to stage
    app.stage.addChild(this.terrainContainer);
    app.stage.addChild(this.entityContainer);
    app.stage.addChild(this.uiContainer);
    app.stage.addChild(this.ui.getContainer());
    
    this.renderer = new Renderer(this.entityContainer);
    
    // Load assets first
    const { AssetLoader } = await import('../utils/AssetLoader');
    await AssetLoader.loadAll();
    
    // Initialize terrain
    await this.initTerrain();
    
    // Spawn initial squibbles
    this.spawnInitialSquibbles();
  }
  
  private async initTerrain(): Promise<void> {
    console.log('Generating terrain...');
    
    // Generate world
    this.worldData = generateWorld(
      this.settings.mapWidth,
      this.settings.mapHeight,
      this.settings.terrain
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
    }
    
    // Render
    this.draw();
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
        
        // Draw mating indicator (heart outline) if seeking mate
        if (squibble.seekingMate && !squibble.isBreeding) {
          const heartSize = radius * 1.5 * this.zoomLevel;
          this.drawHeart(sx, sy - radius - heartSize * 0.3, heartSize, [255, 100, 150]);
        }
        
        // Draw health bar
        this.drawHealthBar(sx, sy, radius, squibble.health, this.zoomLevel);
        
        // Draw status icons
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
    } else if (this.selectedSquibble && !this.selectedSquibble.alive) {
      // Selected squibble died, deselect
      this.selectedSquibble = null;
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
        this.spawnInitialSquibbles();
      } else if (e.code === 'KeyA') {
        // Add a new squibble
        const x = 50 + Math.random() * (this.settings.mapWidth - 100);
        const y = 50 + Math.random() * (this.settings.mapHeight - 100);
        this.squibbleManager.addSquibble(x, y);
      } else if (e.code === 'KeyI') {
        // Toggle controls
        this.ui.toggleControls();
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
    let iconY = y - radius - 25 * zoom;
    
    // Draw hunger icon if hungry
    if (squibble.hunger < 70.0) {
      const hungerIcon = AssetLoader.getIconTexture('hunger');
      if (hungerIcon) {
        const sprite = new Sprite(hungerIcon);
        sprite.width = iconSize;
        sprite.height = iconSize;
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = iconY;
        this.entityContainer.addChild(sprite);
      }
    }
    
    // Draw health icon if health is low
    if (squibble.health < 50) {
      const healthIcon = AssetLoader.getIconTexture('health');
      if (healthIcon) {
        const sprite = new Sprite(healthIcon);
        sprite.width = iconSize;
        sprite.height = iconSize;
        sprite.anchor.set(0.5);
        sprite.x = x;
        sprite.y = iconY - iconSize - 2 * zoom;
        this.entityContainer.addChild(sprite);
      }
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
