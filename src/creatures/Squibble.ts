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
  public adultRadius: number = 10; // Full grown size
  
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
  
  // Pregnancy state (females only)
  public isPregnant: boolean = false;
  public pregnancyTimeRemaining: number = 0;
  public pregnancyDuration: number = 25.0; // Base gestation ~25 seconds (varies)
  public pregnancyFather: Squibble | null = null; // Store father for genetics
  
  // State
  public alive: boolean = true;
  public age: number = 0; // Age in frames
  public maxAge: number; // Maximum age in frames before death (genetic)
  
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
      // Inherit max age from parents (in frames, ~60fps so 3600 = 60 seconds)
      this.maxAge = Math.round(this.inheritTrait(parent1.maxAge, parent2.maxAge, 1800, 18000)); // 30s - 5min
    } else {
      // Generate random stats for new squibble
      this.color = color || this.generateRandomColor();
      this.vision = 50 + Math.random() * 100; // 50-150
      this.speed = 1.0 + Math.random() * 2.0; // 1.0-3.0
      this.attractiveness = Math.random(); // 0-1
      this.minAttractiveness = Math.random(); // 0-1
      this.virility = Math.random(); // 0-1
      this.gender = Math.random() < 0.5 ? 'male' : 'female'; // Random gender
      // Random max age (in frames, ~60fps)
      // 3-5 minutes = 180-300 seconds = 10800-18000 frames
      this.maxAge = 10800 + Math.floor(Math.random() * 7200); // 3-5min lifespan
    }
    
    this.direction = Math.random() * 2 * Math.PI;
    this.directionChangeInterval = 30 + Math.floor(Math.random() * 90); // 30-120 frames
    
    // Set size based on whether this is a baby (has parents) or initial adult
    this.adultRadius = 8 + Math.random() * 4; // Adult size 8-12
    
    if (parent1 && parent2) {
      // Babies start small
      this.radius = 4;
      this.age = 0;
    } else {
      // Initial squibbles start as young adults (at beginning of fertile period)
      this.age = Math.floor(this.maxAge * 0.2); // Start at 20% of max age (just became adult)
      this.radius = this.adultRadius; // Already full size
    }
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
    
    // Die of old age
    if (this.age >= this.maxAge) {
      this.alive = false;
      return;
    }
    
    // Grow from baby to adult size over first 1/5 of life
    const growthPhase = this.maxAge * 0.2;
    if (this.age < growthPhase) {
      const growthProgress = this.age / growthPhase;
      this.radius = 4 + (this.adultRadius - 4) * growthProgress;
    } else {
      this.radius = this.adultRadius;
    }
    
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
    
    // Update pregnancy
    if (this.isPregnant) {
      this.pregnancyTimeRemaining = Math.max(0, this.pregnancyTimeRemaining - dt);
    }
    
    // Calculate pregnancy progress (0 = not pregnant, 1 = about to give birth)
    const pregnancyProgress = this.isPregnant 
      ? 1 - (this.pregnancyTimeRemaining / this.pregnancyDuration) 
      : 0;
    
    // Pregnancy increases consumption rates (up to 2x at full term)
    const pregnancyMultiplier = 1.0 + pregnancyProgress;
    
    // Decrease stats over time (speed affects consumption rate)
    const speedMultiplier = 1.0 + (this.speed - 1.0) * 0.5;
    this.hunger -= this.baseHungerRate * speedMultiplier * pregnancyMultiplier * dt;
    this.thirst -= this.baseThirstRate * speedMultiplier * pregnancyMultiplier * dt;
    
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
      // Check if we should seek a mate (must be healthy, well-fed, well-hydrated, cooldown expired, AND in fertile age)
      // Squibbles prioritize survival over reproduction
      // This is re-evaluated every frame, so seekingMate will turn back on automatically
      // when conditions are met again (e.g., after eating and getting full)
      const canSeekMate = this.health >= this.matingHealthThreshold &&
                         this.hunger >= this.matingHungerThreshold &&
                         this.thirst >= this.matingThirstThreshold &&
                         this.breedingCooldown <= 0 &&
                         this.isInFertileAge(); // Must be adult (not too young or old)
      
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
    // Pregnancy slows movement (down to 50% at full term)
    const pregnancySpeedPenalty = this.isPregnant ? (1 - pregnancyProgress * 0.5) : 1.0;
    const effectiveSpeed = this.speed * pregnancySpeedPenalty;
    
    if (!this.isBreeding) {
      this.x += Math.cos(this.direction) * effectiveSpeed;
      this.y += Math.sin(this.direction) * effectiveSpeed;
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
    // Convert frame-based age to seconds (assuming ~60fps)
    const ageInSeconds = this.age / 60;
    const maxAgeInSeconds = this.maxAge / 60;
    
    return {
      hunger: this.hunger,
      thirst: this.thirst,
      health: this.health,
      vision: this.vision,
      speed: this.speed,
      speed_multiplier: 1.0 + (this.speed - 1.0) * 0.5,
      age: ageInSeconds,
      max_age: maxAgeInSeconds,
      alive: this.alive,
      seeking_food: this.hunger < this.hungerThreshold,
      seeking_mate: this.seekingMate,
      attractiveness: this.attractiveness,
      virility: this.virility,
      gender: this.gender,
      min_attractiveness: this.minAttractiveness,
      breeding_cooldown: this.breedingCooldown,
      is_pregnant: this.isPregnant,
      pregnancy_progress: this.isPregnant ? (1 - this.pregnancyTimeRemaining / this.pregnancyDuration) : 0,
      pregnancy_time_remaining: this.pregnancyTimeRemaining,
    };
  }
  
  /**
   * Check if squibble is in fertile age (middle 3/5 of life)
   */
  isInFertileAge(): boolean {
    const youngLimit = this.maxAge * 0.2; // First 1/5
    const oldLimit = this.maxAge * 0.8;   // Last 1/5
    return this.age >= youngLimit && this.age <= oldLimit;
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
    
    // Both must be in fertile age (not too young or too old)
    if (!this.isInFertileAge() || !other.isInFertileAge()) return false;
    
    // Pregnant squibbles cannot breed
    if (this.isPregnant || other.isPregnant) return false;
    
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
  
  /**
   * Start pregnancy (called after successful mating for females)
   */
  startPregnancy(father: Squibble): void {
    if (this.gender !== 'female') return;
    this.isPregnant = true;
    
    // Variable gestation: 20-30 seconds base
    const baseGestation = 20 + Math.random() * 10;
    
    // Cap gestation at remaining lifespan (in seconds)
    const remainingLifeSeconds = (this.maxAge - this.age) / 60;
    this.pregnancyDuration = Math.min(baseGestation, remainingLifeSeconds - 1);
    this.pregnancyTimeRemaining = this.pregnancyDuration;
    this.pregnancyFather = father;
  }
  
  /**
   * Check if ready to give birth
   */
  isReadyToGiveBirth(): boolean {
    return this.isPregnant && this.pregnancyTimeRemaining <= 0;
  }
  
  /**
   * Complete pregnancy (give birth)
   */
  giveBirth(): Squibble | null {
    if (!this.isPregnant || !this.pregnancyFather) return null;
    
    // Create baby at mother's position
    const baby = new Squibble(this.x, this.y, undefined, this, this.pregnancyFather);
    
    // Reset pregnancy state
    this.isPregnant = false;
    this.pregnancyTimeRemaining = 0;
    this.pregnancyFather = null;
    
    return baby;
  }
}
