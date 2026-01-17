/**
 * TitleScreen - Title screen with settings customization
 */

import { Application, Container, Sprite, Text, TextStyle, Graphics, Assets, Texture } from 'pixi.js';
import { GameSettings } from '../core/Game';
import { FontLoader } from '../utils/FontLoader';

export interface TitleScreenResult {
  settings: GameSettings | null;
}

export class TitleScreen {
  private app: Application;
  private container: Container;
  private screenWidth: number;
  private screenHeight: number;
  private currentScreen: 'title' | 'customization' = 'title';
  private blinkTimer: number = 0;
  private blinkVisible: boolean = true;
  
  // Background images
  private titleBgImages: Texture[] = [];
  private selectedBg: Texture | null = null;
  private squibblesFg: Texture | null = null;
  private backgroundSprite: Sprite | null = null;
  private foregroundSprite: Sprite | null = null;
  
  // Settings
  private creatureCount: number = 200;
  private mapWidth: number = 6000;
  private mapHeight: number = 6000;
  private biomeScale: number = 5;
  private biomeWeights = { plains: 45, forest: 25, desert: 20, tundra: 10 };
  private pondChance: number = 15;
  private riverChance: number = 60;
  private riverWidth: number = 0;
  
  // UI Elements (simplified - using text inputs via DOM overlay for now)
  private titleContainer: Container;
  private customizationContainer: Container;
  private resolveCallback: ((result: TitleScreenResult) => void) | null = null;
  
  constructor(screenWidth: number = 1000, screenHeight: number = 800) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.container = new Container();
    this.titleContainer = new Container();
    this.customizationContainer = new Container();
  }
  
  async initialize(): Promise<void> {
    this.app = new Application({
      width: this.screenWidth,
      height: this.screenHeight,
      backgroundColor: 0x000000,
      antialias: true,
    });
    
    const appElement = document.getElementById('app');
    if (appElement) {
      const canvas = (this.app as any).canvas || (this.app as any).view;
      if (canvas) {
        appElement.appendChild(canvas);
      }
    }
    
    this.app.stage.addChild(this.container);
    this.container.addChild(this.titleContainer);
    this.container.addChild(this.customizationContainer);
    
    // Load Minecraft font
    await FontLoader.loadMinecraftFont();
    
    // Load background images
    await this.loadBackgroundImages();
    
    this.setupTitleScreen();
    this.setupCustomizationScreen();
    
    // Start animation loop
    this.app.ticker.add(() => this.update());
    
    // Handle input
    this.setupInputHandling();
  }
  
  private async loadBackgroundImages(): Promise<void> {
    try {
      // Load all title background images (excluding squibbles.png)
      const bgFiles = [
        'Assets/Title Screen/desert1.png',
        'Assets/Title Screen/desert2.png',
        'Assets/Title Screen/plains1.png',
        'Assets/Title Screen/plains2.png',
        'Assets/Title Screen/rainforest1.png',
        'Assets/Title Screen/tundra1.png',
      ];
      
      for (const path of bgFiles) {
        try {
          const texture = await Assets.load(path);
          this.titleBgImages.push(texture);
        } catch (e) {
          console.warn(`Could not load background image: ${path}`, e);
        }
      }
      
      // Select random background
      if (this.titleBgImages.length > 0) {
        this.selectedBg = this.titleBgImages[Math.floor(Math.random() * this.titleBgImages.length)];
      }
      
      // Load squibbles foreground image
      try {
        this.squibblesFg = await Assets.load('Assets/Title Screen/squibbles.png');
      } catch (e) {
        console.warn('Could not load squibbles.png foreground:', e);
      }
      
      console.log(`Loaded ${this.titleBgImages.length} background images`);
    } catch (error) {
      console.error('Error loading title screen images:', error);
    }
  }
  
  private setupTitleScreen(): void {
    this.titleContainer.removeChildren();
    
    // Draw background image if available
    if (this.selectedBg) {
      this.backgroundSprite = new Sprite(this.selectedBg);
      this.backgroundSprite.width = this.screenWidth;
      this.backgroundSprite.height = this.screenHeight;
      this.backgroundSprite.x = 0;
      this.backgroundSprite.y = 0;
      this.titleContainer.addChild(this.backgroundSprite);
    }
    
    // Draw squibbles foreground image if available
    if (this.squibblesFg) {
      // Scale to 80% of screen width, keep aspect ratio
      const fgWidth = this.screenWidth * 0.8;
      const aspect = this.squibblesFg.height / this.squibblesFg.width;
      const fgHeight = fgWidth * aspect;
      
      this.foregroundSprite = new Sprite(this.squibblesFg);
      this.foregroundSprite.width = fgWidth;
      this.foregroundSprite.height = fgHeight;
      this.foregroundSprite.anchor.set(0.5);
      this.foregroundSprite.x = this.screenWidth / 2;
      this.foregroundSprite.y = this.screenHeight * 0.30; // Upper part of screen
      this.titleContainer.addChild(this.foregroundSprite);
    }
    
    // Title text (if no foreground image, show text title)
    if (!this.squibblesFg) {
      const titleStyle = new TextStyle({
        fontFamily: FontLoader.getFontFamily(),
        fontSize: 48,
        fill: 0xffffff,
        fontWeight: 'bold',
      });
      
      const titleText = new Text('Squibbles', titleStyle);
      titleText.x = this.screenWidth / 2 - titleText.width / 2;
      titleText.y = this.screenHeight * 0.3;
      this.titleContainer.addChild(titleText);
      
      // Subtitle
      const subtitleStyle = new TextStyle({
        fontFamily: FontLoader.getFontFamily(),
        fontSize: 24,
        fill: 0xffffff,
      });
      
      const subtitleText = new Text('Evolution Simulation', subtitleStyle);
      subtitleText.x = this.screenWidth / 2 - subtitleText.width / 2;
      subtitleText.y = this.screenHeight * 0.3 + 60;
      this.titleContainer.addChild(subtitleText);
    }
    
    // Instructions (blinking text)
    const instructionStyle = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 20,
      fill: 0xffffff,
    });
    
    // Use the correct PixiJS v7 Text constructor
    const instructionText = new Text('Press Enter to Start', instructionStyle);
    instructionText.x = this.screenWidth / 2 - instructionText.width / 2;
    instructionText.y = this.screenHeight / 2 + 250; // Lower center area
    instructionText.name = 'instructionText'; // Name it for easy access
    this.titleContainer.addChild(instructionText);
  }
  
  private setupCustomizationScreen(): void {
    this.customizationContainer.removeChildren();
    this.customizationContainer.visible = false;
    
    // Create HTML overlay for inputs (simpler than building full UI in PixiJS)
    this.createHTMLOverlay();
  }
  
  private createHTMLOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'title-screen-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: Arial;
      z-index: 1000;
    `;
    
    overlay.innerHTML = `
      <div style="background: rgba(20, 30, 40, 0.95); padding: 30px; border-radius: 10px; max-width: 600px;">
        <h2 style="text-align: center; margin-bottom: 20px;">Simulation Settings</h2>
        
        <div style="margin-bottom: 15px;">
          <label>Map Size Preset:</label>
          <select id="size-preset" style="margin-left: 10px; padding: 5px;">
            <option value="small">Small (6000x6000)</option>
            <option value="medium" selected>Medium (7000x7000)</option>
            <option value="large">Large (8000x8000)</option>
          </select>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>Creatures (1-1000):</label>
          <input type="number" id="creature-count" value="200" min="1" max="1000" style="margin-left: 10px; padding: 5px; width: 100px;">
        </div>
        
        <div style="margin-bottom: 15px;">
          <p style="font-size: 12px; color: #aaa; margin-top: 5px;">Food spawns automatically based on biome tiles</p>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>Map Width (1000-10000):</label>
          <input type="number" id="map-width" value="6000" min="1000" max="10000" style="margin-left: 10px; padding: 5px; width: 100px;">
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>Map Height (1000-10000):</label>
          <input type="number" id="map-height" value="6000" min="1000" max="10000" style="margin-left: 10px; padding: 5px; width: 100px;">
        </div>
        
        <div style="margin-top: 30px; text-align: center;">
          <button id="start-btn" style="padding: 10px 20px; margin: 5px; font-size: 16px; cursor: pointer;">Start Simulation</button>
          <button id="back-btn" style="padding: 10px 20px; margin: 5px; font-size: 16px; cursor: pointer;">Back to Title</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Setup event handlers
    const sizePreset = document.getElementById('size-preset') as HTMLSelectElement;
    sizePreset.addEventListener('change', () => {
      const presets: Record<string, { w: number; h: number; c: number }> = {
        small: { w: 6000, h: 6000, c: 200 },
        medium: { w: 7000, h: 7000, c: 300 },
        large: { w: 8000, h: 8000, c: 400 },
      };
      const preset = presets[sizePreset.value];
      if (preset) {
        this.mapWidth = preset.w;
        this.mapHeight = preset.h;
        this.creatureCount = preset.c;
        (document.getElementById('map-width') as HTMLInputElement).value = String(preset.w);
        (document.getElementById('map-height') as HTMLInputElement).value = String(preset.h);
        (document.getElementById('creature-count') as HTMLInputElement).value = String(preset.c);
      }
    });
    
    (document.getElementById('start-btn') as HTMLButtonElement).addEventListener('click', () => {
      this.getSettingsAndStart();
    });
    
    (document.getElementById('back-btn') as HTMLButtonElement).addEventListener('click', () => {
      this.currentScreen = 'title';
      this.titleContainer.visible = true;
      this.customizationContainer.visible = false;
      overlay.style.display = 'none';
    });
  }
  
  private setupInputHandling(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') {
        if (this.currentScreen === 'title') {
          this.currentScreen = 'customization';
          this.titleContainer.visible = false;
          this.customizationContainer.visible = true;
          const overlay = document.getElementById('title-screen-overlay');
          if (overlay) {
            overlay.style.display = 'flex';
          }
        } else if (this.currentScreen === 'customization') {
          this.getSettingsAndStart();
        }
      }
    });
  }
  
  private getSettingsAndStart(): void {
    const creatureInput = document.getElementById('creature-count') as HTMLInputElement;
    const widthInput = document.getElementById('map-width') as HTMLInputElement;
    const heightInput = document.getElementById('map-height') as HTMLInputElement;
    
    this.creatureCount = Math.max(1, Math.min(1000, parseInt(creatureInput.value) || 200));
    this.mapWidth = Math.max(1000, Math.min(10000, parseInt(widthInput.value) || 6000));
    this.mapHeight = Math.max(1000, Math.min(10000, parseInt(heightInput.value) || 6000));
    
    const settings: GameSettings = {
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      creatureCount: this.creatureCount,
      terrain: {
        biome_scale: this.biomeScale,
        biome_weights: { ...this.biomeWeights },
        pond_chance: this.pondChance,
        river_chance: this.riverChance,
        river_width: this.riverWidth,
      },
    };
    
    if (this.resolveCallback) {
      this.resolveCallback({ settings });
    }
  }
  
  private update(): void {
    if (this.currentScreen === 'title') {
      this.blinkTimer += this.app.ticker.deltaMS / 1000;
      if (this.blinkTimer >= 0.5) {
        this.blinkVisible = !this.blinkVisible;
        this.blinkTimer = 0;
        
        // Update instruction text visibility
        const instructionText = this.titleContainer.getChildByName('instructionText') as Text;
        if (instructionText) {
          instructionText.alpha = this.blinkVisible ? 1.0 : 0.3;
        }
      }
    }
  }
  
  async show(): Promise<GameSettings | null> {
    return new Promise((resolve) => {
      this.resolveCallback = (result) => {
        this.cleanup();
        resolve(result.settings);
      };
    });
  }
  
  cleanup(): void {
    this.app.destroy(true, { children: true, texture: true });
    const overlay = document.getElementById('title-screen-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
}
