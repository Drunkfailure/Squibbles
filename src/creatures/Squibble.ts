/**
 * Squibble - Individual creature class
 */

import { RGB, Point } from '../utils/types';
import { Food } from '../food/Food';
import { FoodManager } from '../food/FoodManager';
import { WaterMap } from '../terrain/WaterMap';

export class Squibble {
  public x: number;
  public y: number;
  public color: RGB;
  public radius: number = 10;
  
  // Stats
  public hunger: number = 100.0;
  public thirst: number = 100.0;
  public health: number = 100.0;
  public vision: number;
  
  // Breeding stats
  public attractiveness: number; // 0-1, randomly generated
  public minAttractiveness: number; // 0-1, minimum attractiveness this squibble will mate with
  public virility: number; // 0-1, affects probability of successful breeding
  public gender: 'male' | 'female'; // Gender for breeding
  
  // Behavior thresholds
  private hungerThreshold: number = 70.0;
  private thirstThreshold: number = 70.0; // Threshold for seeking water
  private matingHealthThreshold: number = 60.0; // Minimum health to seek mates
  private matingHungerThreshold: number = 65.0; // Must be well-fed to seek mates
  private matingThirstThreshold: number = 65.0; // Must be well-hydrated to seek mates
  
  // Movement
  public speed: number;
  public direction: number;
  private directionChangeTimer: number = 0;
  private directionChangeInterval: number;
  
  // Speed-based consumption rates
  private baseHungerRate: number = 0.5;
  private baseThirstRate: number = 0.3;
  
  // Breeding state
  public seekingMate: boolean = false;
  public isBreeding: boolean = false;
  public breedingPartner: Squibble | null = null;
  public breedingTimeRemaining: number = 0;
  private breedingDuration: number = 10.0; // 10 seconds to complete breeding
  private breedingCooldown: number = 0;
  private breedingCooldownDuration: number = 30.0; // seconds between breeding attempts
  
  // State
  public alive: boolean = true;
  public age: number = 0;
  
  constructor(x: number, y: number, color?: RGB, parent1?: Squibble, parent2?: Squibble) {
    this.x = x;
    this.y = y;
    
    // Genetics: inherit from parents or generate randomly
    if (parent1 && parent2) {
      // Inherit traits from parents with variation
      this.color = this.inheritColor(parent1.color, parent2.color);
      this.vision = this.inheritTrait(parent1.vision, parent2.vision, 50, 150);
      this.speed = this.inheritTrait(parent1.speed, parent2.speed, 1.0, 3.0);
      this.attractiveness = this.inheritTrait(parent1.attractiveness, parent2.attractiveness, 0, 1);
      this.minAttractiveness = Math.random(); // New random minimum
      this.virility = this.inheritTrait(parent1.virility, parent2.virility, 0, 1);
      this.gender = Math.random() < 0.5 ? 'male' : 'female'; // Random gender for offspring
    } else {
      // Generate random stats for new squibble
      this.color = color || this.generateRandomColor();
      this.vision = 50 + Math.random() * 100; // 50-150
      this.speed = 1.0 + Math.random() * 2.0; // 1.0-3.0
      this.attractiveness = Math.random(); // 0-1
      this.minAttractiveness = Math.random(); // 0-1
      this.virility = Math.random(); // 0-1
      this.gender = Math.random() < 0.5 ? 'male' : 'female'; // Random gender
    }
    
    this.direction = Math.random() * 2 * Math.PI;
    this.directionChangeInterval = 30 + Math.floor(Math.random() * 90); // 30-120 frames
  }
  
  /**
   * Inherit a trait from two parents with variation
   */
  private inheritTrait(parent1Value: number, parent2Value: number, min: number, max: number): number {
    // Average of parents with some random variation
    const average = (parent1Value + parent2Value) / 2;
    const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
    const inherited = average * (1 + variation);
    return Math.max(min, Math.min(max, inherited));
  }
  
  /**
   * Inherit color from parents (blend with variation)
   */
  private inheritColor(parent1Color: RGB, parent2Color: RGB): RGB {
    const blend = (c1: number, c2: number) => {
      const avg = (c1 + c2) / 2;
      const variation = (Math.random() - 0.5) * 30; // ±15 color variation
      return Math.max(0, Math.min(255, Math.round(avg + variation)));
    };
    
    return [
      blend(parent1Color[0], parent2Color[0]),
      blend(parent1Color[1], parent2Color[1]),
      blend(parent1Color[2], parent2Color[2]),
    ];
  }
  
  private generateRandomColor(): RGB {
    return [
      50 + Math.floor(Math.random() * 205),
      50 + Math.floor(Math.random() * 205),
      50 + Math.floor(Math.random() * 205),
    ];
  }
  
  update(
    dt: number,
    screenWidth: number,
    screenHeight: number,
    foodManager?: FoodManager,
    waterMap?: WaterMap,
    squibbleManager?: any // SquibbleManager for finding mates
  ): void {
    if (!this.alive) {
      return;
    }
    
    this.age++;
    
    // Update breeding cooldown
    if (this.breedingCooldown > 0) {
      this.breedingCooldown = Math.max(0, this.breedingCooldown - dt);
    }
    
    // Update breeding progress
    if (this.isBreeding && this.breedingPartner) {
      // Check if partner is still alive and breeding with us
      if (!this.breedingPartner.alive || 
          !this.breedingPartner.isBreeding || 
          this.breedingPartner.breedingPartner !== this) {
        // Partner died or stopped breeding - cancel
        this.cancelBreeding();
        return;
      }
      
      // Update breeding timer
      this.breedingTimeRemaining = Math.max(0, this.breedingTimeRemaining - dt);
      
      // Stop movement while breeding
      // (squibbles stay in place during breeding)
      
      // If breeding completes, it's handled by SquibbleManager
    }
    
    // Decrease stats over time (speed affects consumption rate)
    const speedMultiplier = 1.0 + (this.speed - 1.0) * 0.5;
    this.hunger -= this.baseHungerRate * speedMultiplier * dt;
    this.thirst -= this.baseThirstRate * speedMultiplier * dt;
    
    // Die if stats reach 0
    if (this.hunger <= 0 || this.thirst <= 0 || this.health <= 0) {
      this.alive = false;
      return;
    }
    
    // Try to drink if thirsty and near water
    if (waterMap && this.thirst < 80.0) {
      if (waterMap.isWaterNear(this.x, this.y, this.radius + 8)) {
        // Drink: restore thirst moderately
        this.thirst = Math.min(100.0, this.thirst + 25.0 * dt);
      }
    }
    
    // Try to eat food if available and hungry
    if (foodManager && this.hunger < this.hungerThreshold) {
      const nutrition = foodManager.eatFoodAtPosition(this.x, this.y, this.radius + 5);
      if (nutrition) {
        const [hungerGain, thirstGain] = nutrition;
        this.hunger = Math.min(100, this.hunger + hungerGain);
        this.thirst = Math.min(100, this.thirst + thirstGain);
      }
    }
    
    // Check if we need to seek food
    const seekingFood = this.hunger < this.hungerThreshold;
    
    // Update seekingMate status (re-evaluated every frame)
    // Don't seek mates if already breeding
    if (this.isBreeding) {
      this.seekingMate = false;
    } else {
      // Check if we should seek a mate (must be healthy, well-fed, well-hydrated, and cooldown expired)
      // Squibbles prioritize survival over reproduction
      // This is re-evaluated every frame, so seekingMate will turn back on automatically
      // when conditions are met again (e.g., after eating and getting full)
      const canSeekMate = this.health >= this.matingHealthThreshold &&
                         this.hunger >= this.matingHungerThreshold &&
                         this.thirst >= this.matingThirstThreshold &&
                         this.breedingCooldown <= 0;
      
      this.seekingMate = canSeekMate;
    }
    
    // Priority: Food > Mate > Wander
    if (seekingFood && foodManager) {
      const nearestFood = foodManager.getNearestFood(this.x, this.y, this.vision);
      if (nearestFood) {
        // Move towards the food immediately
        const dx = nearestFood.x - this.x;
        const dy = nearestFood.y - this.y;
        this.direction = Math.atan2(dy, dx);
        this.directionChangeTimer = 0;
      }
    } else if (this.seekingMate && squibbleManager) {
      // Seek a mate
      const potentialMate = squibbleManager.findPotentialMate(this);
      if (potentialMate) {
        // Move towards the potential mate
        const dx = potentialMate.x - this.x;
        const dy = potentialMate.y - this.y;
        this.direction = Math.atan2(dy, dx);
        this.directionChangeTimer = 0;
      }
    }
    
    // Change direction based on behavior
    this.directionChangeTimer += 1;
    if (this.directionChangeTimer >= this.directionChangeInterval) {
      if (seekingFood && foodManager) {
        const nearestFood = foodManager.getNearestFood(this.x, this.y, this.vision);
        if (nearestFood) {
          // Move towards the food
          const dx = nearestFood.x - this.x;
          const dy = nearestFood.y - this.y;
          this.direction = Math.atan2(dy, dx);
          this.directionChangeInterval = 15 + Math.floor(Math.random() * 45); // 15-60
        } else {
          // No food found, wander randomly
          if (Math.random() < 0.3) {
            this.direction = Math.random() * 2 * Math.PI;
          }
          this.directionChangeInterval = 60 + Math.floor(Math.random() * 120); // 60-180
        }
      } else {
        // Normal random movement when not hungry
        this.direction = Math.random() * 2 * Math.PI;
        this.directionChangeInterval = 30 + Math.floor(Math.random() * 90); // 30-120
      }
      
      this.directionChangeTimer = 0;
    }
    
    // Move (unless breeding)
    if (!this.isBreeding) {
      this.x += Math.cos(this.direction) * this.speed;
      this.y += Math.sin(this.direction) * this.speed;
    }
    
    // Bounce off boundaries
    if (this.x - this.radius <= 0 || this.x + this.radius >= screenWidth) {
      this.direction = Math.PI - this.direction;
      this.x = Math.max(this.radius, Math.min(screenWidth - this.radius, this.x));
    }
    
    if (this.y - this.radius <= 0 || this.y + this.radius >= screenHeight) {
      this.direction = -this.direction;
      this.y = Math.max(this.radius, Math.min(screenHeight - this.radius, this.y));
    }
  }
  
  getStats() {
    return {
      hunger: this.hunger,
      thirst: this.thirst,
      health: this.health,
      vision: this.vision,
      speed: this.speed,
      speed_multiplier: 1.0 + (this.speed - 1.0) * 0.5,
      age: this.age,
      alive: this.alive,
      seeking_food: this.hunger < this.hungerThreshold,
      seeking_mate: this.seekingMate,
      attractiveness: this.attractiveness,
      virility: this.virility,
      gender: this.gender,
      min_attractiveness: this.minAttractiveness,
      breeding_cooldown: this.breedingCooldown,
    };
  }
  
  /**
   * Check if this squibble can mate with another
   * @param allowInterruption If true, allows checking even if one is already breeding (for interruption logic)
   */
  canMateWith(other: Squibble, allowInterruption: boolean = false): boolean {
    // Both must be alive
    if (!this.alive || !other.alive) return false;
    
    // Must be opposite genders
    if (this.gender === other.gender) return false;
    
    // If not allowing interruption, check cooldowns and breeding status
    if (!allowInterruption) {
      if (this.breedingCooldown > 0 || other.breedingCooldown > 0) return false;
      if (this.isBreeding || other.isBreeding) return false;
    }
    
    // Both must meet health/hunger/thirst thresholds
    if (this.health < this.matingHealthThreshold || 
        this.hunger < this.matingHungerThreshold || 
        this.thirst < this.matingThirstThreshold) return false;
    if (other.health < other.matingHealthThreshold || 
        other.hunger < other.matingHungerThreshold ||
        other.thirst < other.matingThirstThreshold) return false;
    
    // Attractiveness check: each must find the other attractive enough
    if (this.attractiveness < other.minAttractiveness) return false;
    if (other.attractiveness < this.minAttractiveness) return false;
    
    return true;
  }
  
  /**
   * Start breeding with another squibble
   */
  startBreeding(partner: Squibble): void {
    this.isBreeding = true;
    this.breedingPartner = partner;
    this.breedingTimeRemaining = this.breedingDuration;
    this.seekingMate = false;
  }
  
  /**
   * Cancel breeding (e.g., if interrupted)
   */
  cancelBreeding(): void {
    this.isBreeding = false;
    this.breedingPartner = null;
    this.breedingTimeRemaining = 0;
    // Set a short cooldown after interruption
    this.breedingCooldown = this.breedingCooldownDuration * 0.3;
  }
  
  /**
   * Complete breeding successfully
   */
  completeBreeding(): void {
    this.isBreeding = false;
    this.breedingPartner = null;
    this.breedingTimeRemaining = 0;
    this.breedingCooldown = this.breedingCooldownDuration;
  }
  
  /**
   * Check if breeding is complete (10 seconds elapsed)
   */
  isBreedingComplete(): boolean {
    return this.isBreeding && this.breedingTimeRemaining <= 0;
  }
}
