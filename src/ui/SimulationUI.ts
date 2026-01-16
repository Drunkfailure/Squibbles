/**
 * SimulationUI - UI overlay for stats and controls
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Stats } from '../utils/types';
import { FoodStats } from '../food/FoodManager';
import { FontLoader } from '../utils/FontLoader';

export class SimulationUI {
  private container: Container;
  private screenWidth: number;
  private screenHeight: number;
  private showControls: boolean = false;
  
  private statsPanel: Graphics | null = null;
  private statsText: Text | null = null;
  private squibbleDetailPanel: Graphics | null = null;
  private squibbleDetailText: Text | null = null;
  
  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.container = new Container();
  }
  
  getContainer(): Container {
    return this.container;
  }
  
  drawStatsPanel(stats: Stats, foodStats: FoodStats, zoomLevel: number): void {
    // Remove old panel and text
    if (this.statsPanel) {
      this.container.removeChild(this.statsPanel);
      this.statsPanel.destroy();
      this.statsPanel = null;
    }
    if (this.statsText) {
      this.container.removeChild(this.statsText);
      this.statsText.destroy();
      this.statsText = null;
    }
    
    const panelHeight = this.showControls ? 450 : 250;
    const panelWidth = 300;
    
    // Draw panel background
    this.statsPanel = new Graphics();
    this.statsPanel
      .beginFill(0x000000, 0.78) // ~200/255 alpha
      .drawRect(10, 10, panelWidth, panelHeight)
      .endFill();
    this.container.addChild(this.statsPanel);
    
    // Create text
    const style = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 18,
      fill: 0xffffff,
    });
    
    // Ensure all values are properly converted to strings
    const lines: string[] = [
      `Squibbles: ${stats.alive || 0}/${stats.count || 0}`,
      `Avg Hunger: ${(stats.avg_hunger ?? 0).toFixed(1)}`,
      `Avg Thirst: ${(stats.avg_thirst ?? 0).toFixed(1)}`,
      `Avg Health: ${(stats.avg_health ?? 0).toFixed(1)}`,
      `Avg Speed: ${(stats.avg_speed ?? 0).toFixed(1)}`,
      `Seeking Mate: ${stats.seeking_mate_count || 0}`,
      `Food: ${foodStats.available_food || 0}/${foodStats.total_food || 0}`,
      `Respawning: ${foodStats.respawning_soon || 0}`,
      `Seeking Food: ${stats.seeking_food_count || 0}`,
      `Zoom: ${zoomLevel.toFixed(1)}x`,
    ];
    
    if (this.showControls) {
      lines.push(
        '',
        'Controls:',
        'SPACE - Pause/Resume',
        'R - Reset',
        'A - Add Squibble',
        'Click - Select Squibble',
        'Shift+Click - Add at mouse',
        'F - Toggle Follow',
        'I - Toggle Controls',
        'ESC - Deselect/Quit',
        '',
        'Camera:',
        'Arrow Keys - Move camera',
        '[ - Zoom out',
        '] - Zoom in'
      );
    }
    
    this.statsText = new Text(lines.join('\n'), style);
    this.statsText.x = 20;
    this.statsText.y = 20;
    this.container.addChild(this.statsText);
  }
  
  drawPauseIndicator(paused: boolean): void {
    if (paused) {
      const style = new TextStyle({
        fontFamily: FontLoader.getFontFamily(),
        fontSize: 36,
        fill: 0xffff00,
        fontWeight: 'bold',
      });
      
      const pauseText = new Text('PAUSED', style);
      pauseText.x = this.screenWidth / 2 - pauseText.width / 2;
      pauseText.y = 30;
      this.container.addChild(pauseText);
    }
  }
  
  drawSquibbleDetails(squibble: any): void {
    // Remove old detail panel
    if (this.squibbleDetailPanel) {
      this.container.removeChild(this.squibbleDetailPanel);
      this.squibbleDetailPanel.destroy();
      this.squibbleDetailPanel = null;
    }
    if (this.squibbleDetailText) {
      this.container.removeChild(this.squibbleDetailText);
      this.squibbleDetailText.destroy();
      this.squibbleDetailText = null;
    }
    
    if (!squibble) return;
    
    const panelWidth = 280;
    const panelHeight = 650; // Increased to accommodate all stats including new reproduction traits
    const panelX = this.screenWidth - panelWidth - 10;
    const panelY = 10;
    
    // Draw detail panel background
    this.squibbleDetailPanel = new Graphics();
    this.squibbleDetailPanel
      .beginFill(0x000000, 0.85)
      .drawRect(panelX, panelY, panelWidth, panelHeight)
      .endFill();
    this.container.addChild(this.squibbleDetailPanel);
    
    // Create detail text
    const style = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 16,
      fill: 0xffffff,
    });
    
    const stats = squibble.getStats();
    const lines: string[] = [
      '=== Selected Squibble ===',
      '',
      `Gender: ${stats.gender || 'unknown'}`,
      `Age: ${stats.age.toFixed(1)}s / ${stats.max_age.toFixed(1)}s`,
      '',
      'Health:',
      `  Health: ${stats.health.toFixed(1)}%`,
      `  Hunger: ${stats.hunger.toFixed(1)}%`,
      `  Thirst: ${stats.thirst.toFixed(1)}%`,
      '',
      'Traits:',
      `  Speed: ${stats.speed.toFixed(2)}`,
      `  Vision: ${stats.vision.toFixed(1)}`,
      '',
      'Breeding:',
      `  Attractiveness: ${(stats.attractiveness * 100).toFixed(1)}%`,
      `  Min Attractiveness: ${(stats.min_attractiveness * 100).toFixed(1)}%`,
      `  Virility: ${(stats.virility * 100).toFixed(1)}%`,
      `  Size: ${(stats.size * 100).toFixed(0)}%`,
      '',
      'Reproduction:',
      `  Litter Size: ${stats.litter_size?.toFixed(1) || 'N/A'} (avg)`,
      `  Gestation: ${stats.gestation_duration?.toFixed(1) || 'N/A'}s`,
      `  Multi-baby Pregnancies: ${stats.multi_baby_pregnancies || 0}`,
      '',
      'Breeding Status:',
      `  Cooldown: ${stats.breeding_cooldown > 0 ? stats.breeding_cooldown.toFixed(1) + 's' : 'Ready'}`,
      `  Pregnant: ${stats.is_pregnant ? `Yes (${(stats.pregnancy_progress * 100).toFixed(0)}%)` : 'No'}`,
      '',
      'Status:',
      `  Seeking Food: ${stats.seeking_food ? 'Yes' : 'No'}`,
      `  Seeking Mate: ${stats.seeking_mate ? 'Yes' : 'No'}`,
      `  Alive: ${stats.alive ? 'Yes' : 'No'}`,
      '',
      'Appearance:',
      `  Horns: ${stats.horn_style}`,
      `  Eyes: ${stats.eye_type}`,
      `  Ears: ${stats.ear_type}`,
      `  Tail: ${stats.tail_type}`,
      `  Pattern: ${stats.pattern_type}`,
      `  Body: ${stats.body_shape}`,
    ];
    
    this.squibbleDetailText = new Text(lines.join('\n'), style);
    this.squibbleDetailText.x = panelX + 10;
    this.squibbleDetailText.y = panelY + 10;
    this.container.addChild(this.squibbleDetailText);
  }
  
  toggleControls(): void {
    this.showControls = !this.showControls;
  }
}
