/**
 * Simulation - Main simulation class that ties all systems together
 */

import { Game, GameSettings } from './Game';
import { Container, Graphics } from 'pixi.js';
import { AssetLoader } from '../utils/AssetLoader';
import { SquibbleManager } from '../creatures/SquibbleManager';
import { Squibble } from '../creatures/Squibble';
import { GnawlinManager } from '../creatures/GnawlinManager';
import { Gnawlin } from '../creatures/Gnawlin';
import { FoodManager } from '../food/FoodManager';
import { generateWorld, WorldData } from '../terrain/WorldGenerator';
import { WaterMap } from '../terrain/WaterMap';
import { HeightMap } from '../terrain/HeightMap';
import { Biome } from '../terrain/Biome';
import { TerrainVoxelRenderer } from '../terrain/TerrainVoxelRenderer';
import { WorldRenderer } from '../render/WorldRenderer';
import { SceneDrawable, renderEntityDrawables, renderTerrainToGraphics } from '../render/SceneDrawQueue';
import { Renderer } from './Renderer';
import { Camera3D } from '../render/Camera3D';
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
  private heightMap: HeightMap | null = null;
  private worldData: WorldData | null = null;
  private terrainVoxelRenderer: TerrainVoxelRenderer;
  private terrainGraphics: Graphics;
  private worldRenderer: WorldRenderer | null = null;
  private camera3d: Camera3D;

  private zoomSpeed: number = 0.08;
  private cameraMoveSpeed: number = 14;
  private cameraRotateSpeed: number = 0.04;
  private cameraPitchSpeed: number = 0.03;
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
      settings.mapHeight,
      settings.foodCount ?? 200
    );
    this.terrainVoxelRenderer = new TerrainVoxelRenderer();
    this.terrainGraphics = new Graphics();
    this.camera3d = new Camera3D(settings.screenWidth, settings.screenHeight);
    this.camera3d.focusX = settings.mapWidth / 2;
    this.camera3d.focusY = settings.mapHeight / 2;
    this.camera3d.zoom = Math.min(
      settings.screenWidth / settings.mapWidth,
      settings.screenHeight / settings.mapHeight
    ) * 0.92;
    this.ui = new SimulationUI(settings.screenWidth, settings.screenHeight);
    
    // Stats tracking
    this.statsRecorder = new StatsRecorder(1.0); // Record every 1 second
    
    // Disable Gnawlin stats if no Gnawlins at start
    if (settings.gnawlinCount === 0) {
      this.statsRecorder.disableGnawlinStats();
    }
    
    this.statsGraphRenderer = new StatsGraphRenderer(this.statsRecorder);
    
    // ESC menu
    this.escMenu = new EscMenu();
    
    // Family tree
    this.familyTree = new FamilyTree();
    
    // Create containers
    this.terrainContainer = new Container();
    this.entityContainer = new Container();
    this.uiContainer = new Container();
    
  }

  private get zoomLevel(): number {
    return this.camera3d.zoom;
  }

  private set zoomLevel(z: number) {
    this.camera3d.zoom = Math.max(this.camera3d.minZoom, Math.min(this.camera3d.maxZoom, z));
  }
  
  async initialize(onProgress?: (progress: number, message: string) => void): Promise<void> {
    await super.initialize();
    
    const app = this.getApp();
    
    // Add containers to stage
    this.terrainContainer.addChild(this.terrainGraphics);
    this.terrainContainer.zIndex = 0;
    this.entityContainer.zIndex = 10;
    app.stage.sortableChildren = true;
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
      this.settings.worldSeed,
      onProgress
    );
    
    // Create water map
    this.waterMap = new WaterMap(
      this.worldData.waterMask,
      this.worldData.tileSize,
      this.worldData.rows,
      this.worldData.cols
    );

    this.heightMap = new HeightMap(
      this.worldData.heightGrid,
      this.worldData.waterMask,
      this.worldData.tileSize,
      this.worldData.rows,
      this.worldData.cols
    );
    this.worldRenderer = new WorldRenderer(
      this.entityContainer,
      this.renderer,
      this.camera3d,
      this.heightMap,
      this.waterMap
    );

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
      const challenging = Math.random() < 0.42;
      const pos = this.pickLandSpawnPosition(challenging);
      if (pos) {
        this.squibbleManager.addSquibble(pos.x, pos.y);
      } else {
        const x = 50 + Math.random() * (this.settings.mapWidth - 100);
        const y = 50 + Math.random() * (this.settings.mapHeight - 100);
        this.squibbleManager.addSquibble(x, y);
      }
      
      if (i % 100 === 0 && i > 0) {
        console.log(`Spawned ${i}/${count} squibbles...`);
      }
    }
    
    console.log(`Finished spawning ${count} squibbles`);
  }
  
  /**
   * Spawn on land tiles; when challenging, bias toward desert/tundra so lineages face real pressure.
   */
  private pickLandSpawnPosition(challenging: boolean): { x: number; y: number } | null {
    if (!this.worldData || !this.waterMap) return null;
    const wd = this.worldData;
    const ts = wd.tileSize;
    const cols = wd.cols;
    const rows = wd.rows;
    const jitter = () => (Math.random() - 0.5) * ts * 0.35;
    
    for (let attempt = 0; attempt < 48; attempt++) {
      const tr = Math.floor(Math.random() * rows);
      const tc = Math.floor(Math.random() * cols);
      const idx = tr * cols + tc;
      const biome = wd.biomeGrid[idx];
      if (biome === Biome.WATER) continue;
      
      const x = (tc + 0.5) * ts + jitter();
      const y = (tr + 0.5) * ts + jitter();
      if (this.waterMap.isWaterAt(x, y)) continue;
      
      if (challenging && attempt < 36) {
        const hard = biome === Biome.DESERT || biome === Biome.TUNDRA;
        if (!hard) continue;
      }
      
      return { x, y };
    }
    return null;
  }
  
  private spawnInitialGnawlins(): void {
    const count = this.settings.gnawlinCount;
    if (count === 0) return; // No gnawlins to spawn
    
    console.log(`Spawning ${count} gnawlins...`);
    
    for (let i = 0; i < count; i++) {
      const challenging = Math.random() < 0.35;
      const pos = this.pickLandSpawnPosition(challenging);
      if (pos) {
        this.gnawlinManager.addGnawlin(pos.x, pos.y);
      } else {
        const x = 50 + Math.random() * (this.settings.mapWidth - 100);
        const y = 50 + Math.random() * (this.settings.mapHeight - 100);
        this.gnawlinManager.addGnawlin(x, y);
      }
      
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
        this.gnawlinManager,
        this.heightMap || undefined
      );
      this.gnawlinManager.updateAll(
        dt,
        this.settings.mapWidth,
        this.settings.mapHeight,
        this.squibbleManager,
        this.waterMap || undefined,
        getBiomeAt,
        this.heightMap || undefined
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
    
    // Get death counts from managers
    const squibbleDeaths = this.squibbleManager.getDeathCounts();
    const gnawlinDeaths = this.gnawlinManager.getDeathCounts();
    
    // Calculate detailed stats
    const stats: Record<string, number> = {
      population: currentAlive,
      births: this.totalBirths,
      deaths: this.totalDeaths,
      deaths_by_age: squibbleDeaths.age,
      deaths_by_hunger: squibbleDeaths.hunger,
      deaths_by_thirst: squibbleDeaths.thirst,
      deaths_by_predator: squibbleDeaths.predator,
      deaths_by_drowning: squibbleDeaths.drowning,
      deaths_by_childbirth: squibbleDeaths.childbirth,
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
    
    // Add Gnawlin death counts
    stats.gnawlin_deaths_by_age = gnawlinDeaths.age;
    stats.gnawlin_deaths_by_hunger = gnawlinDeaths.hunger;
    stats.gnawlin_deaths_by_thirst = gnawlinDeaths.thirst;
    stats.gnawlin_deaths_by_childbirth = gnawlinDeaths.childbirth;
    
    this.statsRecorder.update(dt, stats);
  }
  
  private handleCameraMovement(): void {
    const events = this.getEventManager();
    const pan = this.cameraMoveSpeed / Math.max(0.5, this.zoomLevel);

    if (this.selectedCreature && this.selectedCreature.alive) {
      this.camera3d.focusX = this.selectedCreature.x;
      this.camera3d.focusY = this.selectedCreature.y;
    } else {
      if (events.isKeyPressed('ArrowLeft')) this.camera3d.focusX -= pan;
      if (events.isKeyPressed('ArrowRight')) this.camera3d.focusX += pan;
      if (events.isKeyPressed('ArrowUp')) this.camera3d.focusY -= pan;
      if (events.isKeyPressed('ArrowDown')) this.camera3d.focusY += pan;

      if (events.isKeyPressed('KeyQ')) this.camera3d.yaw -= this.cameraRotateSpeed;
      if (events.isKeyPressed('KeyE')) this.camera3d.yaw += this.cameraRotateSpeed;
      if (events.isKeyPressed('KeyT')) {
        this.camera3d.pitch = Math.min(
          this.camera3d.maxPitch,
          this.camera3d.pitch + this.cameraPitchSpeed
        );
      }
      if (events.isKeyPressed('KeyF')) {
        this.camera3d.pitch = Math.max(
          this.camera3d.minPitch,
          this.camera3d.pitch - this.cameraPitchSpeed
        );
      }
    }

    this.camera3d.focusX = Math.max(0, Math.min(this.settings.mapWidth, this.camera3d.focusX));
    this.camera3d.focusY = Math.max(0, Math.min(this.settings.mapHeight, this.camera3d.focusY));
  }
  
  private draw(): void {
    // Terrain on its own layer (always behind entities)
    this.terrainGraphics.clear();
    const terrainDrawables: SceneDrawable[] = [];
    if (this.worldData && this.heightMap) {
      this.terrainVoxelRenderer.collectDrawables(
        terrainDrawables,
        this.worldData,
        this.heightMap,
        this.camera3d
      );
      renderTerrainToGraphics(this.terrainGraphics, terrainDrawables);
    }

    this.entityContainer.removeChildren();
    this.entityContainer.sortableChildren = true;

    const propDrawables: SceneDrawable[] = [];
    const creatureDrawables: SceneDrawable[] = [];

    const wr = this.worldRenderer;
    if (wr) {
      const baseSize = Simulation.TREE_FOOD_SPRITE_WORLD_SIZE;
      const zoom = this.zoomLevel;
      const { halfW, halfH } = this.camera3d.getViewHalfExtents();
      const inView = (x: number, y: number) =>
        Math.abs(x - this.camera3d.focusX) < halfW && Math.abs(y - this.camera3d.focusY) < halfH;

      const decorativeTrees = this.foodManager.getDecorativeTrees();
      for (const tree of decorativeTrees) {
        if (!inView(tree.x, tree.y)) continue;
        const scale = tree.scale ?? 1;
        const size = baseSize * scale;
        const foot = size * 0.45;
        const { sx, footSy, sortY } = wr.getEntityScreen(tree.x, tree.y, foot);
        const texture = AssetLoader.getFoodTexture('foresttree', 0);
        const flipH = tree.flipH ?? false;
        propDrawables.push({
          depth: sortY,
          kind: 'entity',
          drawEntity: (parent) => {
            if (!texture) return;
            const px = Math.max(1, size * zoom);
            wr.drawBlobShadow(parent, sx, footSy, px * 0.4);
            wr.drawPropSprite(parent, texture, sx, footSy, px, flipH);
          },
        });
      }

      const foods = this.foodManager.getAllFood();
      for (const food of foods) {
        if (!inView(food.x, food.y)) continue;
        const scale = food.scale ?? 1;
        const size = baseSize * scale;
        const foot = size * 0.45;
        const { sx, footSy, sortY } = wr.getEntityScreen(food.x, food.y, foot);
        const texture = AssetLoader.getFoodTexture(food.species, food.remainingSlots);
        const flipH = food.flipH ?? false;
        propDrawables.push({
          depth: sortY,
          kind: 'entity',
          drawEntity: (parent) => {
            if (texture) {
              const px = Math.max(1, size * zoom);
              wr.drawBlobShadow(parent, sx, footSy, px * 0.35);
              wr.drawPropSprite(parent, texture, sx, footSy, px, flipH);
            } else {
              const radius = food.radius * zoom;
              wr.drawBlobShadow(parent, sx, footSy, radius * 0.5);
              const layerRenderer = new Renderer(parent);
              layerRenderer.drawCircle(sx, footSy - radius, radius, [0, 255, 0], 0.8);
            }
          },
        });
      }

      const squibbles = this.squibbleManager.getAlive();
      for (const squibble of squibbles) {
        const foot = this.heightMap
          ? squibble.getFootPosition(this.heightMap)
          : { x: squibble.x, y: squibble.y, z: 0 };
        if (!inView(foot.x, foot.y)) continue;
        const { sx, footSy, sortY } = wr.getEntityScreen(foot.x, foot.y, squibble.radius, {
          squibbleRadius: squibble.radius,
          worldZ: foot.z,
        });
        creatureDrawables.push({
          depth: sortY,
          kind: 'entity',
          drawEntity: (parent) => {
            wr.drawSquibble(parent, squibble, sx, footSy, zoom, (footX, headY, radiusPx) => {
              wr.drawHealthBar(
                parent,
                footX,
                headY,
                radiusPx,
                squibble.health,
                squibble.maxHealth,
                zoom
              );
              wr.drawStatusIcons(parent, footX, headY, radiusPx, squibble, zoom);
            });
          },
        });
      }

      const gnawlins = this.gnawlinManager.getAlive();
      for (const gnawlin of gnawlins) {
        const foot = this.heightMap
          ? gnawlin.getFootPosition(this.heightMap)
          : { x: gnawlin.x, y: gnawlin.y, z: 0 };
        if (!inView(foot.x, foot.y)) continue;
        const { sx, footSy, sortY } = wr.getEntityScreen(foot.x, foot.y, gnawlin.currentSize, {
          worldZ: foot.z,
        });
        creatureDrawables.push({
          depth: sortY,
          kind: 'entity',
          drawEntity: (parent) => {
            wr.drawGnawlin(parent, gnawlin, sx, footSy, zoom, (footX, headY, halfSizePx) => {
              wr.drawHealthBar(
                parent,
                footX,
                headY,
                halfSizePx,
                gnawlin.health,
                gnawlin.maxHealth,
                zoom
              );
              wr.drawStatusIcons(parent, footX, headY, halfSizePx, gnawlin, zoom);
            });
          },
        });
      }

      let z = renderEntityDrawables(this.entityContainer, propDrawables, 0);
      renderEntityDrawables(this.entityContainer, creatureDrawables, z);
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
      if (this.worldRenderer) {
        const creature = this.selectedCreature;
        if (creature instanceof Squibble) {
          const foot = this.heightMap
            ? creature.getFootPosition(this.heightMap)
            : { x: creature.x, y: creature.y, z: 0 };
          const { sx, footSy } = this.worldRenderer.getEntityScreen(
            foot.x,
            foot.y,
            creature.radius,
            { squibbleRadius: creature.radius, worldZ: foot.z }
          );
          const radius = Math.max(1, creature.radius * this.zoomLevel);
          const selectionRing = new Graphics();
          selectionRing.lineStyle(3, 0x00ffff, 1.0);
          selectionRing.drawCircle(sx, footSy - radius * 0.88, radius + 3);
          this.entityContainer.addChild(selectionRing);
        } else if (creature instanceof Gnawlin) {
          const foot = this.heightMap
            ? creature.getFootPosition(this.heightMap)
            : { x: creature.x, y: creature.y, z: 0 };
          const { sx, footSy } = this.worldRenderer.getEntityScreen(
            foot.x,
            foot.y,
            creature.currentSize,
            { worldZ: foot.z }
          );
          const size = Math.max(1, creature.currentSize * this.zoomLevel);
          const halfSize = size / 2 + 3;
          const selectionRing = new Graphics();
          selectionRing.lineStyle(3, 0x00ffff, 1.0);
          selectionRing.drawRect(sx - halfSize, footSy - size, size + 6, size + 6);
          this.entityContainer.addChild(selectionRing);
        }
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
      } else if (e.code === 'BracketLeft') {
        this.zoomLevel -= this.zoomSpeed;
      } else if (e.code === 'BracketRight') {
        this.zoomLevel += this.zoomSpeed;
      } else if (e.code === 'KeyG') {
        this.statsGraphRenderer.show();
      } else if (e.code === 'KeyR') {
        // Reset simulation
        this.squibbleManager.clear();
        this.gnawlinManager.clear();
        this.foodManager = new FoodManager(
          this.settings.mapWidth,
          this.settings.mapHeight,
          this.settings.foodCount ?? 200
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
        
        const { worldX, worldY } = this.camera3d.screenToWorld(
          mousePos.x,
          mousePos.y,
          (x, y) => this.heightMap?.getSurfaceWorldZ(x, y) ?? 0
        );
        
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
  
}
