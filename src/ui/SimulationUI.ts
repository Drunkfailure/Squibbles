/**
 * SimulationUI - UI overlay for stats and controls
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Stats } from '../utils/types';
import { FoodStats } from '../food/FoodManager';
import { FontLoader } from '../utils/FontLoader';
import { Gnawlin } from '../creatures/Gnawlin';

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
  
  drawStatsPanel(stats: Stats, foodStats: FoodStats, zoomLevel: number, gnawlinStats?: Stats): void {
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
    
    // Draw panel background with border (matching graph style)
    this.statsPanel = new Graphics();
    // Background (darker, matching graph)
    this.statsPanel
      .beginFill(0x0d0d1a, 0.95) // Dark background matching graph
      .drawRoundedRect(10, 10, panelWidth, panelHeight, 8)
      .endFill();
    // Border
    this.statsPanel
      .lineStyle(2, 0x34495e, 1.0) // Subtle border
      .drawRoundedRect(10, 10, panelWidth, panelHeight, 8);
    this.container.addChild(this.statsPanel);
    
    // Create text
    const style = new TextStyle({
      fontFamily: FontLoader.getFontFamily(),
      fontSize: 18,
      fill: 0xffffff,
    });
    
    // Ensure all values are properly converted to strings
    const lines: string[] = [
      `Squibbles: ${stats.alive || 0}`,
      gnawlinStats ? `Gnawlins: ${gnawlinStats.alive || 0}` : '',
      `Avg Hunger: ${(stats.avg_hunger ?? 0).toFixed(1)}`,
      `Avg Thirst: ${(stats.avg_thirst ?? 0).toFixed(1)}`,
      `Avg Health: ${(stats.avg_health ?? 0).toFixed(1)}`,
      `Avg Speed: ${(stats.avg_speed ?? 0).toFixed(1)}`,
      `Seeking Mate: ${stats.seeking_mate_count || 0}`,
      `Food: ${foodStats.available_food || 0}/${foodStats.total_food || 0}`,
      `Respawning: ${foodStats.respawning_soon || 0}`,
      `Seeking Food: ${stats.seeking_food_count || 0}`,
      `Zoom: ${zoomLevel.toFixed(1)}x`,
    ].filter(line => line !== ''); // Remove empty lines
    
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
  
  drawSquibbleDetails(creature: any): void {
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
    
    if (!creature) {
      this.lastSelectedSquibbleId = null;
      // Clear panel bounds when no creature is selected
      this.panelX = 0;
      this.panelY = 0;
      this.panelWidth = 0;
      this.panelHeight = 0;
      return;
    }
    
    // Determine creature type
    const isGnawlin = creature instanceof Gnawlin;
    const creatureType = isGnawlin ? 'Gnawlin' : 'Squibble';
    
    // Reset to page 1 if a different creature is selected
    const stats = creature.getStats();
    if (this.lastSelectedSquibbleId !== stats.id) {
      this.currentPage = 1;
      this.lastSelectedSquibbleId = stats.id;
    }
    
    const panelWidth = 280;
    const buttonHeight = 30;
    const buttonMargin = 15;
    const buttonSpacing = 5;
    const textAreaHeight = 480; // Increased height for text content (accommodates all stats)
    // Total height: text area + page buttons + spacing + family tree button + margins + extra space
    const panelHeight = textAreaHeight + (buttonHeight * 2) + (buttonSpacing * 2) + (buttonMargin * 2) + 110; // ~710px total (extended by 60px)
    const panelX = this.screenWidth - panelWidth - 10;
    const panelY = 10;
    // Position buttons exactly 20 pixels from the bottom of the panel
    // Family tree button bottom should be 20px from panel bottom
    // buttonY is for Page 1/2 buttons, Family Tree is below them
    const familyTreeButtonY = panelY + panelHeight - 20 - buttonHeight;
    const buttonY = familyTreeButtonY - buttonHeight - buttonSpacing;
    
    // Store panel bounds for click detection
    this.panelX = panelX;
    this.panelY = panelY;
    this.panelWidth = panelWidth;
    this.panelHeight = panelHeight;
    
    // Draw detail panel background with border (matching graph style)
    this.squibbleDetailPanel = new Graphics();
    // Background (darker, matching graph)
    this.squibbleDetailPanel
      .beginFill(0x0d0d1a, 0.95) // Dark background matching graph
      .drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 8)
      .endFill();
    // Border
    this.squibbleDetailPanel
      .lineStyle(2, 0x34495e, 1.0) // Subtle border
      .drawRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
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
      `=== Selected ${creatureType} ===`,
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
      `  Accuracy: ${((stats.accuracy ?? 0.7) * 100).toFixed(1)}%`,
      `  Awareness: ${((stats.awareness ?? 0.5) * 100).toFixed(1)}%`,
      `  Wet: ${(stats.wet_timer ?? 0) > 0 ? (stats.wet_timer ?? 0).toFixed(1) + 's' : 'No'}`,
      '',
      'Breeding:',
    ];
    
    // Add attractiveness stats only for Squibbles
    if (!isGnawlin && 'attractiveness' in stats && 'min_attractiveness' in stats) {
      page1Lines.push(
        `  Attractiveness: ${((stats as any).attractiveness * 100).toFixed(1)}%`,
        `  Min Attractiveness: ${((stats as any).min_attractiveness * 100).toFixed(1)}%`
      );
    }
    
    page1Lines.push(
      `  Virility: ${(stats.virility * 100).toFixed(1)}%`,
      `  Size: ${(stats.size * 100).toFixed(0)}%`
    );
    
    // Page 2: Reproduction, Breeding Status, Status, Appearance
    const page2Lines: string[] = [
      `=== Selected ${creatureType} ===`,
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
    
    // Page 1 button (matching graph button style)
    const page1ButtonX = panelX + 10;
    this.page1Button = new Graphics();
    const page1Color = this.currentPage === 1 ? 0x3498db : 0x555555; // Blue when active, gray when inactive
    this.page1Button
      .beginFill(page1Color, 0.9)
      .drawRoundedRect(page1ButtonX, buttonY, buttonWidth, buttonHeight, 5)
      .endFill();
    this.page1Button.interactive = true;
    this.page1Button.buttonMode = true;
                this.page1Button.on('pointerdown', () => {
                  this.currentPage = 1;
                  this.drawSquibbleDetails(creature);
                });
    this.container.addChild(this.page1Button);
    
    this.page1ButtonText = new Text('Page 1', buttonStyle);
    this.page1ButtonText.x = page1ButtonX + buttonWidth / 2 - this.page1ButtonText.width / 2;
    this.page1ButtonText.y = buttonY + buttonHeight / 2 - this.page1ButtonText.height / 2;
    this.container.addChild(this.page1ButtonText);
    
    // Page 2 button (matching graph button style)
    const page2ButtonX = page1ButtonX + buttonWidth + buttonSpacing;
    this.page2Button = new Graphics();
    const page2Color = this.currentPage === 2 ? 0x3498db : 0x555555; // Blue when active, gray when inactive
    this.page2Button
      .beginFill(page2Color, 0.9)
      .drawRoundedRect(page2ButtonX, buttonY, buttonWidth, buttonHeight, 5)
      .endFill();
    this.page2Button.interactive = true;
    this.page2Button.buttonMode = true;
                this.page2Button.on('pointerdown', () => {
                  this.currentPage = 2;
                  this.drawSquibbleDetails(creature);
                });
    this.container.addChild(this.page2Button);
    
    this.page2ButtonText = new Text('Page 2', buttonStyle);
    this.page2ButtonText.x = page2ButtonX + buttonWidth / 2 - this.page2ButtonText.width / 2;
    this.page2ButtonText.y = buttonY + buttonHeight / 2 - this.page2ButtonText.height / 2;
    this.container.addChild(this.page2ButtonText);
    
    // Family Tree button (full width, below page buttons, matching graph button style)
    // familyTreeButtonY is already calculated above to be exactly 50px from bottom
    this.familyTreeButton = new Graphics();
    this.familyTreeButton
      .beginFill(0x3498db, 0.9) // Blue matching graph buttons
      .drawRoundedRect(panelX + 10, familyTreeButtonY, panelWidth - 20, buttonHeight, 5)
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
