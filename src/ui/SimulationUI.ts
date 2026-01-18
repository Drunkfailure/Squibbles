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
  private page1Button: Graphics | null = null;
  private page1ButtonText: Text | null = null;
  private page2Button: Graphics | null = null;
  private page2ButtonText: Text | null = null;
  private familyTreeButton: Graphics | null = null;
  private familyTreeButtonText: Text | null = null;
  private currentPage: number = 1;
  private lastSelectedSquibbleId: number | null = null;
  private onFamilyTreeClick: (() => void) | null = null;
  
  // Panel bounds for click detection
  private panelX: number = 0;
  private panelY: number = 0;
  private panelWidth: number = 0;
  private panelHeight: number = 0;
  
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
    if (this.page1Button) {
      this.container.removeChild(this.page1Button);
      this.page1Button.destroy();
      this.page1Button = null;
    }
    if (this.page1ButtonText) {
      this.container.removeChild(this.page1ButtonText);
      this.page1ButtonText.destroy();
      this.page1ButtonText = null;
    }
    if (this.page2Button) {
      this.container.removeChild(this.page2Button);
      this.page2Button.destroy();
      this.page2Button = null;
    }
    if (this.page2ButtonText) {
      this.container.removeChild(this.page2ButtonText);
      this.page2ButtonText.destroy();
      this.page2ButtonText = null;
    }
    if (this.familyTreeButton) {
      this.container.removeChild(this.familyTreeButton);
      this.familyTreeButton.destroy();
      this.familyTreeButton = null;
    }
    if (this.familyTreeButtonText) {
      this.container.removeChild(this.familyTreeButtonText);
      this.familyTreeButtonText.destroy();
      this.familyTreeButtonText = null;
    }
    
    if (!squibble) {
      this.lastSelectedSquibbleId = null;
      // Clear panel bounds when no squibble is selected
      this.panelX = 0;
      this.panelY = 0;
      this.panelWidth = 0;
      this.panelHeight = 0;
      return;
    }
    
    // Reset to page 1 if a different squibble is selected
    const stats = squibble.getStats();
    if (this.lastSelectedSquibbleId !== stats.id) {
      this.currentPage = 1;
      this.lastSelectedSquibbleId = stats.id;
    }
    
    const panelWidth = 280;
    const buttonHeight = 30;
    const buttonMargin = 15;
    const buttonSpacing = 5;
    const textAreaHeight = 480; // Increased height for text content (accommodates all stats)
    // Total height: text area + page buttons + spacing + family tree button + margins
    const panelHeight = textAreaHeight + (buttonHeight * 2) + (buttonSpacing * 2) + (buttonMargin * 2) + 50; // ~650px total
    const panelX = this.screenWidth - panelWidth - 10;
    const panelY = 10;
    // Position buttons at the bottom of the panel (with margin from bottom)
    const buttonY = panelY + panelHeight - buttonHeight - buttonMargin;
    
    // Store panel bounds for click detection
    this.panelX = panelX;
    this.panelY = panelY;
    this.panelWidth = panelWidth;
    this.panelHeight = panelHeight;
    
    // Draw detail panel background
    this.squibbleDetailPanel = new Graphics();
    this.squibbleDetailPanel
      .beginFill(0x000000, 0.85)
      .drawRect(panelX, panelY, panelWidth, panelHeight)
      .endFill();
    this.container.addChild(this.squibbleDetailPanel);
    
    // Create detail text style
    const style = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 16,
      fill: 0xffffff,
    });
    
    const buttonStyle = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 14,
      fill: 0xffffff,
    });
    
    // Page 1: Basic Info, Health, Traits, Breeding
    const page1Lines: string[] = [
      '=== Selected Squibble ===',
      `Page ${this.currentPage}/2`,
      '',
      `ID: ${stats.id || 'N/A'}`,
      `Gender: ${stats.gender || 'unknown'}`,
      `Age: ${stats.age.toFixed(1)}s / ${stats.max_age.toFixed(1)}s`,
      '',
      'Health:',
      `  Health: ${stats.health.toFixed(1)} / ${stats.max_health.toFixed(1)} HP`,
      `  Hunger: ${stats.hunger.toFixed(1)}%`,
      `  Thirst: ${stats.thirst.toFixed(1)}%`,
      '',
      'Traits:',
      `  Speed: ${stats.speed.toFixed(2)}`,
      `  Vision: ${stats.vision.toFixed(1)}`,
      `  Intelligence: ${((stats.intelligence ?? 0.5) * 100).toFixed(1)}%`,
      `  Swim: ${((stats.swim ?? 0.5) * 100).toFixed(1)}%`,
      `  Metabolism: ${((stats.metabolism ?? 0.5) * 100).toFixed(1)}%`,
      `  Damage Resistance: ${((stats.damage_resistance ?? 0) * 100).toFixed(1)}%`,
      `  Aggressiveness: ${((stats.aggressiveness ?? 0.5) * 100).toFixed(1)}%`,
      `  Damage: ${(stats.damage ?? 5).toFixed(1)}`,
      `  Wet: ${(stats.wet_timer ?? 0) > 0 ? (stats.wet_timer ?? 0).toFixed(1) + 's' : 'No'}`,
      '',
      'Breeding:',
      `  Attractiveness: ${(stats.attractiveness * 100).toFixed(1)}%`,
      `  Min Attractiveness: ${(stats.min_attractiveness * 100).toFixed(1)}%`,
      `  Virility: ${(stats.virility * 100).toFixed(1)}%`,
      `  Size: ${(stats.size * 100).toFixed(0)}%`,
    ];
    
    // Page 2: Reproduction, Breeding Status, Status, Appearance
    const page2Lines: string[] = [
      '=== Selected Squibble ===',
      `Page ${this.currentPage}/2`,
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
    
    // Display current page
    const lines = this.currentPage === 1 ? page1Lines : page2Lines;
    
    this.squibbleDetailText = new Text(lines.join('\n'), style);
    this.squibbleDetailText.x = panelX + 10;
    this.squibbleDetailText.y = panelY + 10;
    // Ensure text doesn't overlap with buttons
    this.squibbleDetailText.style.wordWrap = true;
    this.squibbleDetailText.style.wordWrapWidth = panelWidth - 20;
    this.container.addChild(this.squibbleDetailText);
    
    // Create page navigation buttons
    const buttonWidth = (panelWidth - 20) / 2;
    // buttonSpacing is already declared above (line 196)
    
    // Page 1 button
    const page1ButtonX = panelX + 10;
    this.page1Button = new Graphics();
    this.page1Button
      .beginFill(this.currentPage === 1 ? 0x444444 : 0x222222, 0.9)
      .drawRect(page1ButtonX, buttonY, buttonWidth, buttonHeight)
      .endFill();
    this.page1Button.interactive = true;
    this.page1Button.buttonMode = true;
    this.page1Button.on('pointerdown', () => {
      this.currentPage = 1;
      this.drawSquibbleDetails(squibble);
    });
    this.container.addChild(this.page1Button);
    
    this.page1ButtonText = new Text('Page 1', buttonStyle);
    this.page1ButtonText.x = page1ButtonX + buttonWidth / 2 - this.page1ButtonText.width / 2;
    this.page1ButtonText.y = buttonY + buttonHeight / 2 - this.page1ButtonText.height / 2;
    this.container.addChild(this.page1ButtonText);
    
    // Page 2 button
    const page2ButtonX = page1ButtonX + buttonWidth + buttonSpacing;
    this.page2Button = new Graphics();
    this.page2Button
      .beginFill(this.currentPage === 2 ? 0x444444 : 0x222222, 0.9)
      .drawRect(page2ButtonX, buttonY, buttonWidth, buttonHeight)
      .endFill();
    this.page2Button.interactive = true;
    this.page2Button.buttonMode = true;
    this.page2Button.on('pointerdown', () => {
      this.currentPage = 2;
      this.drawSquibbleDetails(squibble);
    });
    this.container.addChild(this.page2Button);
    
    this.page2ButtonText = new Text('Page 2', buttonStyle);
    this.page2ButtonText.x = page2ButtonX + buttonWidth / 2 - this.page2ButtonText.width / 2;
    this.page2ButtonText.y = buttonY + buttonHeight / 2 - this.page2ButtonText.height / 2;
    this.container.addChild(this.page2ButtonText);
    
    // Family Tree button (full width, below page buttons)
    const familyTreeButtonY = buttonY + buttonHeight + buttonSpacing;
    this.familyTreeButton = new Graphics();
    this.familyTreeButton
      .beginFill(0x3498db, 0.9)
      .drawRect(panelX + 10, familyTreeButtonY, panelWidth - 20, buttonHeight)
      .endFill();
    this.familyTreeButton.interactive = true;
    this.familyTreeButton.buttonMode = true;
    this.familyTreeButton.on('pointerdown', () => {
      if (this.onFamilyTreeClick) {
        this.onFamilyTreeClick();
      }
    });
    this.container.addChild(this.familyTreeButton);
    
    this.familyTreeButtonText = new Text('Family Tree', buttonStyle);
    this.familyTreeButtonText.x = panelX + panelWidth / 2 - this.familyTreeButtonText.width / 2;
    this.familyTreeButtonText.y = familyTreeButtonY + buttonHeight / 2 - this.familyTreeButtonText.height / 2;
    this.container.addChild(this.familyTreeButtonText);
  }
  
  /**
   * Set callback for family tree button click
   */
  setFamilyTreeCallback(callback: () => void): void {
    this.onFamilyTreeClick = callback;
  }
  
  toggleControls(): void {
    this.showControls = !this.showControls;
  }
  
  /**
   * Check if a screen coordinate is inside the squibble detail panel
   */
  isPointInDetailPanel(screenX: number, screenY: number): boolean {
    // Only check if panel exists (a squibble is selected)
    if (!this.squibbleDetailPanel) {
      return false;
    }
    
    return screenX >= this.panelX && 
           screenX <= this.panelX + this.panelWidth &&
           screenY >= this.panelY && 
           screenY <= this.panelY + this.panelHeight;
  }
}
