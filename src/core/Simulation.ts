/**
 * Simulation - Main simulation class that ties all systems together
 */

import { Game, GameSettings } from './Game';
import { Container, Graphics, Sprite } from 'pixi.js';
import { AssetLoader } from '../utils/AssetLoader';
import { SquibbleManager } from '../creatures/SquibbleManager';
import { Squibble } from '../creatures/Squibble';
import { GnawlinManager } from '../creatures/GnawlinManager';
import { Gnawlin } from '../creatures/Gnawlin';
import { FoodManager } from '../food/FoodManager';
import { generateWorld, WorldData } from '../terrain/WorldGenerator';
import { WaterMap } from '../terrain/WaterMap';
import { TerrainRenderer } from '../terrain/TerrainRenderer';
import { Renderer } from './Renderer';
import { EventManager } from './EventManager';
import { SimulationUI } from '../ui/SimulationUI';
import { StatsRecorder } from '../stats/StatsRecorder';
import { StatsGraphRenderer } from '../stats/StatsGraphRenderer';
import { EscMenu } from '../ui/EscMenu';
import { FamilyTree } from '../ui/FamilyTree';

export class Simulation extends Game {
  private squibbleManager: SquibbleManager;
  private gnawlinManager: GnawlinManager;
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
  private selectedCreature: Squibble | Gnawlin | null = null;
  
  // Rendering containers
  private terrainContainer: Container;
  private entityContainer: Container;
  private uiContainer: Container;
  private renderer!: Renderer; // Initialized in initialize()
  private ui: SimulationUI;
  
  // Stats tracking
  private statsRecorder: StatsRecorder;
  private statsGraphRenderer: StatsGraphRenderer;
  private totalBirths: number = 0;
  private totalDeaths: number = 0;
  private lastAliveCount: number = 0;
  
  // ESC menu
  private escMenu: EscMenu;
  private onReturnToTitle: (() => void) | null = null;
  
  // Family tree
  private familyTree: FamilyTree;
  
  /** Base size for tree/food sprites in world units. Smaller than tile so they feel placed in the world, not filling it. */
  private static readonly TREE_FOOD_SPRITE_WORLD_SIZE = 44;
  
  constructor(settings: GameSettings) {
    super(settings);
    
    this.squibbleManager = new SquibbleManager();
    this.gnawlinManager = new GnawlinManager();
    this.foodManager = new FoodManager(
      settings.mapWidth,
      settings.mapHeight
    );
    this.terrainRenderer = new TerrainRenderer();
    this.ui = new SimulationUI(settings.screenWidth, settings.screenHeight);
    
    // Stats tracking
    this.statsRecorder = new StatsRecorder(1.0); // Record every 1 second
    this.statsGraphRenderer = new StatsGraphRenderer(this.statsRecorder);
    
    // ESC menu
    this.escMenu = new EscMenu();
    
    // Family tree
    this.familyTree = new FamilyTree();
    
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
    
    // Set up family tree callback
    this.ui.setFamilyTreeCallback(() => {
      if (this.selectedCreature) {
        const allSquibbles = this.squibbleManager.getAll();
        const allGnawlins = this.gnawlinManager.getAll();
        this.familyTree.show(
          this.selectedCreature,
          allSquibbles,
          allGnawlins,
          (creature: Squibble | Gnawlin) => {
            // When a creature is clicked in the family tree, select it
            this.selectedCreature = creature;
            this.ui.drawSquibbleDetails(creature);
          }
        );
      }
    });
    
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
    this.spawnInitialGnawlins();
    
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
    
    // Spawn foods with biome awareness
    this.foodManager.spawnFood(
      this.worldData.biomeGrid,
      this.worldData.tileSize,
      this.worldData.cols,
      this.worldData.rows
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
  
  private spawnInitialGnawlins(): void {
    const count = this.settings.gnawlinCount;
    if (count === 0) return; // No gnawlins to spawn
    
    console.log(`Spawning ${count} gnawlins...`);
    
    for (let i = 0; i < count; i++) {
      const x = 50 + Math.random() * (this.settings.mapWidth - 100);
      const y = 50 + Math.random() * (this.settings.mapHeight - 100);
      this.gnawlinManager.addGnawlin(x, y);
      
      if (i % 50 === 0 && i > 0) {
        console.log(`Spawned ${i}/${count} gnawlins...`);
      }
    }
    
    console.log(`Finished spawning ${count} gnawlins`);
  }
  
  protected onUpdate(dt: number): void {
    // Handle camera movement
    this.handleCameraMovement();
    
    if (!this.isPaused()) {
      // Update simulation systems
      const getBiomeAt = this.worldData
        ? (x: number, y: number) => {
            const w = this.worldData!;
            const cx = Math.max(0, Math.min(w.cols - 1, Math.floor(x / w.tileSize)));
            const cy = Math.max(0, Math.min(w.rows - 1, Math.floor(y / w.tileSize)));
            return w.biomeGrid[cy * w.cols + cx];
          }
        : undefined;
      this.squibbleManager.updateAll(
        dt,
        this.settings.mapWidth,
        this.settings.mapHeight,
        this.foodManager,
        this.waterMap || undefined,
        getBiomeAt,
        this.gnawlinManager // Pass gnawlinManager for predator detection
      );
      this.gnawlinManager.updateAll(
        dt,
        this.settings.mapWidth,
        this.settings.mapHeight,
        this.squibbleManager,
        this.waterMap || undefined,
        getBiomeAt
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
      let totalAttractiveness = 0, totalVirility = 0, totalMaxAge = 0, totalIntelligence = 0, totalSwim = 0, totalMetabolism = 0;
      let totalDamageResistance = 0, totalAggressiveness = 0, totalDamage = 0;
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
        totalIntelligence += s.intelligence;
        totalSwim += s.swim;
        totalMetabolism += s.metabolism;
        totalDamageResistance += s.damageResistance;
        totalAggressiveness += s.aggressiveness;
        totalDamage += s.damage;
        
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
      stats.avg_intelligence = totalIntelligence / currentAlive;
      stats.avg_swim = totalSwim / currentAlive;
      stats.avg_metabolism = totalMetabolism / currentAlive;
      stats.avg_damage_resistance = totalDamageResistance / currentAlive;
      stats.avg_aggressiveness = totalAggressiveness / currentAlive;
      stats.avg_damage = totalDamage / currentAlive;
      stats.seeking_food_count = seekingFood;
      stats.seeking_mate_count = seekingMate;
      stats.pregnant_count = pregnant;
      stats.breeding_count = breeding;
      stats.male_count = males;
      stats.female_count = females;
    }
    
    stats.available_food = this.foodManager.getFoodCount();
    
    // Record Gnawlin stats with prefix
    const gnawlins = this.gnawlinManager.getAlive();
    const gnawlinAlive = gnawlins.length;
    
    if (gnawlinAlive > 0) {
      let gnawlinTotalHunger = 0, gnawlinTotalThirst = 0, gnawlinTotalHealth = 0;
      let gnawlinTotalSpeed = 0, gnawlinTotalVision = 0;
      let gnawlinTotalVirility = 0, gnawlinTotalMaxAge = 0, gnawlinTotalIntelligence = 0, gnawlinTotalSwim = 0, gnawlinTotalMetabolism = 0;
      let gnawlinTotalDamageResistance = 0, gnawlinTotalAggressiveness = 0, gnawlinTotalDamage = 0, gnawlinTotalAccuracy = 0;
      let gnawlinSeekingFood = 0, gnawlinSeekingMate = 0, gnawlinPregnant = 0, gnawlinBreeding = 0;
      let gnawlinMales = 0, gnawlinFemales = 0;
      
      for (const g of gnawlins) {
        const gStats = g.getStats();
        gnawlinTotalHunger += gStats.hunger;
        gnawlinTotalThirst += gStats.thirst;
        gnawlinTotalHealth += gStats.health;
        gnawlinTotalSpeed += gStats.speed;
        gnawlinTotalVision += gStats.vision;
        gnawlinTotalVirility += gStats.virility;
        gnawlinTotalMaxAge += gStats.max_age;
        gnawlinTotalIntelligence += gStats.intelligence;
        gnawlinTotalSwim += gStats.swim;
        gnawlinTotalMetabolism += gStats.metabolism;
        gnawlinTotalDamageResistance += gStats.damage_resistance;
        gnawlinTotalAggressiveness += gStats.aggressiveness;
        gnawlinTotalDamage += gStats.damage;
        gnawlinTotalAccuracy += gStats.accuracy;
        
        if (gStats.seeking_food) gnawlinSeekingFood++;
        if (gStats.seeking_mate) gnawlinSeekingMate++;
        if (gStats.is_pregnant) gnawlinPregnant++;
        if (g.isBreeding) gnawlinBreeding++;
        if (gStats.gender === 'male') gnawlinMales++;
        else gnawlinFemales++;
      }
      
      stats.gnawlin_population = gnawlinAlive;
      stats.gnawlin_avg_hunger = gnawlinTotalHunger / gnawlinAlive;
      stats.gnawlin_avg_thirst = gnawlinTotalThirst / gnawlinAlive;
      stats.gnawlin_avg_health = gnawlinTotalHealth / gnawlinAlive;
      stats.gnawlin_avg_speed = gnawlinTotalSpeed / gnawlinAlive;
      stats.gnawlin_avg_vision = gnawlinTotalVision / gnawlinAlive;
      stats.gnawlin_avg_virility = gnawlinTotalVirility / gnawlinAlive;
      stats.gnawlin_avg_max_age = gnawlinTotalMaxAge / gnawlinAlive;
      stats.gnawlin_avg_intelligence = gnawlinTotalIntelligence / gnawlinAlive;
      stats.gnawlin_avg_swim = gnawlinTotalSwim / gnawlinAlive;
      stats.gnawlin_avg_metabolism = gnawlinTotalMetabolism / gnawlinAlive;
      stats.gnawlin_avg_damage_resistance = gnawlinTotalDamageResistance / gnawlinAlive;
      stats.gnawlin_avg_aggressiveness = gnawlinTotalAggressiveness / gnawlinAlive;
      stats.gnawlin_avg_damage = gnawlinTotalDamage / gnawlinAlive;
      stats.gnawlin_avg_accuracy = gnawlinTotalAccuracy / gnawlinAlive;
      stats.gnawlin_seeking_food_count = gnawlinSeekingFood;
      stats.gnawlin_seeking_mate_count = gnawlinSeekingMate;
      stats.gnawlin_pregnant_count = gnawlinPregnant;
      stats.gnawlin_breeding_count = gnawlinBreeding;
      stats.gnawlin_male_count = gnawlinMales;
      stats.gnawlin_female_count = gnawlinFemales;
    } else {
      stats.gnawlin_population = 0;
    }
    
    this.statsRecorder.update(dt, stats);
  }
  
  private handleCameraMovement(): void {
    // If a squibble is selected, automatically follow it
    if (this.selectedCreature && this.selectedCreature.alive) {
      // Center camera on the selected creature (works with any zoom level)
      this.cameraX = this.settings.screenWidth / 2 - this.selectedCreature.x * this.zoomLevel;
      this.cameraY = this.settings.screenHeight / 2 - this.selectedCreature.y * this.zoomLevel;
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
    
    // Y-sort: collect trees, food, and squibbles; sort by bottom Y (higher Y = in front)
    const drawables: Array<{ sortY: number; draw: () => void }> = [];
    const baseSize = Simulation.TREE_FOOD_SPRITE_WORLD_SIZE;
    
    // Decorative trees (smaller than tile, varied scale, jittered position)
    const decorativeTrees = this.foodManager.getDecorativeTrees();
    for (const tree of decorativeTrees) {
      if (tree.x >= viewX && tree.x < viewX + viewW &&
          tree.y >= viewY && tree.y < viewY + viewH) {
        const sx = (tree.x - viewX) * this.zoomLevel;
        const sy = (tree.y - viewY) * this.zoomLevel;
        const texture = AssetLoader.getFoodTexture('foresttree', 0);
        const scale = tree.scale ?? 1;
        const size = baseSize * scale;
        const flipH = tree.flipH ?? false;
        drawables.push({
          sortY: tree.y + size / 2,
          draw: () => {
            if (texture) {
              const sprite = new Sprite(texture);
              const px = Math.max(1, size * this.zoomLevel);
              sprite.width = px;
              sprite.height = px;
              sprite.anchor.set(0.5);
              if (flipH) sprite.scale.x = -Math.abs(sprite.scale.x);
              sprite.x = sx;
              sprite.y = sy;
              this.entityContainer.addChild(sprite);
            }
          },
        });
      }
    }
    
    // Foods (same: smaller than tile, varied scale, jittered position)
    const foods = this.foodManager.getAllFood();
    for (const food of foods) {
      if (food.x >= viewX && food.x < viewX + viewW &&
          food.y >= viewY && food.y < viewY + viewH) {
        const sx = (food.x - viewX) * this.zoomLevel;
        const sy = (food.y - viewY) * this.zoomLevel;
        const texture = AssetLoader.getFoodTexture(food.species, food.remainingSlots);
        const scale = food.scale ?? 1;
        const size = baseSize * scale;
        const flipH = food.flipH ?? false;
        drawables.push({
          sortY: food.y + size / 2,
          draw: () => {
            if (texture) {
              const sprite = new Sprite(texture);
              const px = Math.max(1, size * this.zoomLevel);
              sprite.width = px;
              sprite.height = px;
              sprite.anchor.set(0.5);
              if (flipH) sprite.scale.x = -Math.abs(sprite.scale.x);
              sprite.x = sx;
              sprite.y = sy;
              this.entityContainer.addChild(sprite);
            } else {
              const radius = food.radius * this.zoomLevel;
              this.renderer.drawCircle(sx, sy, radius, [0, 255, 0], 0.8);
            }
          },
        });
      }
    }
    
    // Squibbles
    const squibbles = this.squibbleManager.getAlive();
    for (const squibble of squibbles) {
      if (squibble.x >= viewX && squibble.x < viewX + viewW &&
          squibble.y >= viewY && squibble.y < viewY + viewH) {
        const sx = (squibble.x - viewX) * this.zoomLevel;
        const sy = (squibble.y - viewY) * this.zoomLevel;
        const radius = Math.max(1, squibble.radius * this.zoomLevel);
        drawables.push({
          sortY: squibble.y + squibble.radius,
          draw: () => {
            this.renderer.drawCircle(sx, sy, radius, squibble.color, 1.0);
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
            this.drawHealthBar(sx, sy, radius, squibble.health, squibble.maxHealth, this.zoomLevel);
            this.drawStatusIcons(sx, sy, radius, squibble, this.zoomLevel);
            const endX = sx + Math.cos(squibble.direction) * (radius + 5) * this.zoomLevel;
            const endY = sy + Math.sin(squibble.direction) * (radius + 5) * this.zoomLevel;
            this.renderer.drawLine(sx, sy, endX, endY, [255, 255, 255], Math.max(1, 2 * this.zoomLevel));
          },
        });
      }
    }
    
    // Gnawlins (render as squares)
    const gnawlins = this.gnawlinManager.getAlive();
    for (const gnawlin of gnawlins) {
      if (gnawlin.x >= viewX && gnawlin.x < viewX + viewW &&
          gnawlin.y >= viewY && gnawlin.y < viewY + viewH) {
        const sx = (gnawlin.x - viewX) * this.zoomLevel;
        const sy = (gnawlin.y - viewY) * this.zoomLevel;
        const size = Math.max(1, gnawlin.currentSize * this.zoomLevel);
        drawables.push({
          sortY: gnawlin.y + gnawlin.currentSize,
          draw: () => {
            // Draw square for gnawlin
            const halfSize = size / 2;
            this.renderer.drawRect(
              sx - halfSize,
              sy - halfSize,
              size,
              size,
              gnawlin.color,
              1.0
            );
            if (gnawlin.isBreeding) {
              const loveTexture = AssetLoader.getIconTexture('love');
              if (loveTexture) {
                const loveSize = size * 1.5 * this.zoomLevel;
                const loveSprite = new Sprite(loveTexture);
                loveSprite.width = loveSize;
                loveSprite.height = loveSize;
                loveSprite.x = sx;
                loveSprite.y = sy - size / 2 - loveSize * 0.4;
                loveSprite.anchor.set(0.5, 0.5);
                this.entityContainer.addChild(loveSprite);
              }
            }
            this.drawHealthBar(sx, sy, size / 2, gnawlin.health, gnawlin.maxHealth, this.zoomLevel);
            this.drawStatusIcons(sx, sy, size / 2, gnawlin, this.zoomLevel);
            const endX = sx + Math.cos(gnawlin.direction) * (size / 2 + 5) * this.zoomLevel;
            const endY = sy + Math.sin(gnawlin.direction) * (size / 2 + 5) * this.zoomLevel;
            this.renderer.drawLine(sx, sy, endX, endY, [255, 255, 255], Math.max(1, 2 * this.zoomLevel));
          },
        });
      }
    }
    
    // Sort by Y ascending (lower Y = behind, higher Y = in front) and draw
    drawables.sort((a, b) => a.sortY - b.sortY);
    for (const d of drawables) {
      d.draw();
    }
    
    // Draw UI
    const stats = this.squibbleManager.getStats();
    const gnawlinStats = this.gnawlinManager.getStats();
    const foodStats = this.foodManager.getStats();
    this.ui.drawStatsPanel(stats, foodStats, this.zoomLevel, gnawlinStats);
    this.ui.drawPauseIndicator(this.isPaused());
    
    // Draw selected creature details
    if (this.selectedCreature && this.selectedCreature.alive) {
      this.ui.drawSquibbleDetails(this.selectedCreature);
      
      // Draw selection indicator
      if (this.selectedCreature.x >= viewX && this.selectedCreature.x < viewX + viewW &&
          this.selectedCreature.y >= viewY && this.selectedCreature.y < viewY + viewH) {
        const sx = (this.selectedCreature.x - viewX) * this.zoomLevel;
        const sy = (this.selectedCreature.y - viewY) * this.zoomLevel;
        
        const selectionRing = new Graphics();
        selectionRing.lineStyle(3, 0x00ffff, 1.0); // Cyan selection
        
        if (this.selectedCreature instanceof Squibble) {
          // Draw circle for Squibbles
          const radius = Math.max(1, this.selectedCreature.radius * this.zoomLevel);
          selectionRing.drawCircle(sx, sy, radius + 3);
        } else if (this.selectedCreature instanceof Gnawlin) {
          // Draw square outline for Gnawlins
          const size = Math.max(1, this.selectedCreature.currentSize * this.zoomLevel);
          const halfSize = size / 2 + 3;
          selectionRing.drawRect(sx - halfSize, sy - halfSize, size + 6, size + 6);
        }
        
        this.entityContainer.addChild(selectionRing);
      }
    } else {
      // No selection or creature died - clear the details panel
      if (this.selectedCreature && !this.selectedCreature.alive) {
        // Selected creature died, deselect
        this.selectedCreature = null;
      }
      // Clear the details panel by passing null
      this.ui.drawSquibbleDetails(null);
    }
  }
  
  protected setupInputHandling(): void {
    // Don't call super - we handle all input ourselves to avoid ESC conflicts
    // Handle zoom and all simulation controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        // Pause/Resume
        e.preventDefault();
        this.togglePause();
      } else if (e.code === 'BracketLeft') { // [
        this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - this.zoomSpeed);
      } else if (e.code === 'BracketRight') { // ]
        this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + this.zoomSpeed);
      } else if (e.code === 'KeyR') {
        // Reset simulation
        this.squibbleManager.clear();
        this.gnawlinManager.clear();
        this.foodManager = new FoodManager(
          this.settings.mapWidth,
          this.settings.mapHeight
        );
        this.foodManager.spawnFood(
          this.worldData?.biomeGrid,
          this.worldData?.tileSize || 32,
          this.worldData?.cols,
          this.worldData?.rows
        );
        this.selectedCreature = null;
        this.statsRecorder.clear();
        this.totalBirths = 0;
        this.totalDeaths = 0;
        this.lastAliveCount = 0;
        this.spawnInitialSquibbles();
        this.spawnInitialGnawlins();
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
        // Handle ESC with priority: graphs > menu > selection
        if (this.statsGraphRenderer.isGraphVisible()) {
          // Close graphs if open
          this.statsGraphRenderer.hide();
        } else if (this.escMenu.isMenuVisible()) {
          // Menu handles its own ESC (resume)
        } else {
          // Show ESC menu
          e.preventDefault();
          this.showEscMenu();
        }
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
          // Check if click is inside the stats panel - if so, don't deselect
          if (this.ui.isPointInDetailPanel(mousePos.x, mousePos.y)) {
            // Click is inside the stats panel, don't deselect
            return;
          }
          
          // Regular click: Select creature (camera will auto-follow)
          const clickedCreature = this.findCreatureAtPosition(worldX, worldY);
          if (clickedCreature) {
            this.selectedCreature = clickedCreature;
          } else {
            // Clicked empty space - deselect
            this.selectedCreature = null;
          }
        }
      }
    });
  }
  
  /**
   * Find a creature (Squibble or Gnawlin) at the given world coordinates
   * Prioritizes Gnawlins if both are at the same position (since they're larger)
   */
  private findCreatureAtPosition(worldX: number, worldY: number): Squibble | Gnawlin | null {
    const clickRadius = 15; // Click detection radius
    
    // Check Gnawlins first (they're larger, so prioritize them)
    for (const gnawlin of this.gnawlinManager.getAlive()) {
      const dx = gnawlin.x - worldX;
      const dy = gnawlin.y - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= gnawlin.currentSize / 2 + clickRadius) {
        return gnawlin;
      }
    }
    
    // Check Squibbles
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
  
  private drawHealthBar(x: number, y: number, radius: number, health: number, maxHealth: number, zoom: number): void {
    const barWidth = 20 * zoom;
    const barHeight = 3 * zoom;
    const barX = x - barWidth / 2;
    const barY = y - radius - 15 * zoom;
    
    // Background
    this.renderer.drawRect(barX, barY, barWidth, barHeight, [100, 100, 100], 1.0);
    
    // Health fill
    const healthPercentage = health / maxHealth;
    const healthWidth = healthPercentage * barWidth;
    if (healthWidth > 0) {
      let color: [number, number, number];
      const healthPercent = healthPercentage * 100; // Convert to 0-100 scale for color calculation
      if (healthPercent > 50) {
        // Green to yellow
        const green = 255;
        const red = Math.floor(255 * (1 - (healthPercent - 50) / 50));
        color = [red, green, 0];
      } else {
        // Yellow to red
        const red = 255;
        const green = Math.floor(255 * (healthPercent / 50));
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
    
    // Love icon (only when seeking mate, not when breeding - breeding has big heart)
    if (squibble.seekingMate && !squibble.isBreeding) {
      icons.push('love');
    }
    
    // Hunger icon (show when below 50 OR when actively eating)
    if (squibble.hunger < 50.0 || squibble.isEating) {
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
    
    // Combat icon (sword)
    if (squibble.isInCombat) {
      icons.push('sword');
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
  
  /**
   * Set callback for returning to title screen
   */
  setReturnToTitleCallback(callback: () => void): void {
    this.onReturnToTitle = callback;
  }
  
  /**
   * Show the ESC menu
   */
  private async showEscMenu(): Promise<void> {
    // Pause the simulation
    this.pause();
    
    // Show menu
    const result = await this.escMenu.show();
    
    // Handle menu action
    switch (result.action) {
      case 'resume':
        // Resume simulation
        this.resume();
        break;
      case 'settings':
        // Settings placeholder - do nothing for now
        this.resume();
        break;
      case 'returnToTitle':
        // Return to title screen
        if (this.onReturnToTitle) {
          this.onReturnToTitle();
        }
        break;
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
