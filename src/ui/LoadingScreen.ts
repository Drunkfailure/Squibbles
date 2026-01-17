/**
 * LoadingScreen - Shows loading progress
 */

import { Application, Container, Text, TextStyle, Graphics } from 'pixi.js';
import { GameSettings } from '../core/Game';
import { FontLoader } from '../utils/FontLoader';

export class LoadingScreen {
  private app: Application;
  private container: Container;
  private screenWidth: number;
  private screenHeight: number;
  private progress: number = 0;
  private currentTask: string = 'Initializing...';
  
  private tasks: Array<[string, number]> = [
    ['Setting up simulation environment', 10],
    ['Creating squibble population', 30],
    ['Spawning food items', 50],
    ['Initializing UI components', 70],
    ['Preparing simulation engine', 90],
    ['Starting simulation', 100],
  ];
  
  constructor(screenWidth: number, screenHeight: number, private settings: GameSettings) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.container = new Container();
  }
  
  async initialize(): Promise<void> {
    this.app = new Application({
      width: this.screenWidth,
      height: this.screenHeight,
      backgroundColor: 0x141e28, // (20, 30, 40)
      antialias: true,
    });
    
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.innerHTML = '';
      const canvas = (this.app as any).canvas || (this.app as any).view;
      if (canvas) {
        appElement.appendChild(canvas);
      }
    }
    
    this.app.stage.addChild(this.container);
    
    // Load Minecraft font
    await FontLoader.loadMinecraftFont();
    
    this.draw();
  }
  
  updateProgress(taskName: string, progress: number): void {
    this.currentTask = taskName;
    this.progress = progress;
    this.draw();
  }
  
  private draw(): void {
    this.container.removeChildren();
    
    // Title
    const titleStyle = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 36,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    
    const titleText = new Text('Loading Simulation', titleStyle);
    titleText.x = this.screenWidth / 2 - titleText.width / 2;
    titleText.y = this.screenHeight / 2 - 100;
    this.container.addChild(titleText);
    
    // Current task
    const taskStyle = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 18,
      fill: 0xffffff,
    });
    
    const taskText = new Text(this.currentTask, taskStyle);
    taskText.x = this.screenWidth / 2 - taskText.width / 2;
    taskText.y = this.screenHeight / 2 - 50;
    this.container.addChild(taskText);
    
    // Progress bar
    const barWidth = 400;
    const barHeight = 20;
    const barX = (this.screenWidth - barWidth) / 2;
    const barY = this.screenHeight / 2;
    
    // Background - use path drawing for PixiJS v7 compatibility
    const bgBar = new Graphics();
    bgBar
      .beginFill(0x323232) // (50, 50, 50)
      .drawRect(barX, barY, barWidth, barHeight)
      .endFill();
    this.container.addChild(bgBar);
    
    // Progress fill
    const progressWidth = (this.progress / 100) * barWidth;
    if (progressWidth > 0) {
      const progressBar = new Graphics();
      progressBar
        .beginFill(0x00ff00) // Green
        .drawRect(barX, barY, progressWidth, barHeight)
        .endFill();
      this.container.addChild(progressBar);
    }
    
    // Border
    const border = new Graphics();
    border
      .lineStyle(2, 0xffffff)
      .drawRect(barX, barY, barWidth, barHeight);
    this.container.addChild(border);
    
    // Percentage
    const percentText = new Text(`${this.progress}%`, taskStyle);
    percentText.x = this.screenWidth / 2 - percentText.width / 2;
    percentText.y = barY + barHeight + 30;
    this.container.addChild(percentText);
    
    // Settings info
    const settingsText = [
      `Map Size: ${this.settings.mapWidth} x ${this.settings.mapHeight}`,
      `Creatures: ${this.settings.creatureCount}`,
      `Food: Auto-spawned by biome`,
    ];
    
    let yOffset = this.screenHeight / 2 + 100;
    for (const text of settingsText) {
      const textObj = new Text(text, taskStyle);
      textObj.x = this.screenWidth / 2 - textObj.width / 2;
      textObj.y = yOffset;
      this.container.addChild(textObj);
      yOffset += 25;
    }
  }
  
  async runLoadingSequence(): Promise<void> {
    // This is now handled by actual progress updates from simulation
    // Keep for backwards compatibility but don't do anything
  }
  
  getApp(): Application {
    return this.app;
  }
  
  cleanup(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
