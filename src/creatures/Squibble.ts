/**
 * Squibble - Individual creature class
 */

import { RGB, Point } from '../utils/types';
import { Food } from '../food/Food';
import { FoodManager } from '../food/FoodManager';
import { WaterMap } from '../terrain/WaterMap';
import {
  Genome,
  ExpressedPhenotypes,
  generateRandomGenome,
  inheritGenome,
  expressGenome,
  MutationConfig,
  DEFAULT_MUTATION_CONFIG,
  MULTI_ALLELE_TRAITS,
  getMultiAllelePhenotype,
} from '../genetics/Genetics';

export class Squibble {
  public x: number;
  public y: number;
  public color: RGB;
  public radius: number = 10;
  public adultRadius: number = 10; // Full grown size
  public size: number; // Heritable size stat (0.6 - 1.4 multiplier)
  
  // Genome - stores all genetic information
  public genome: Genome;
  
  // Stats (derived from genome)
  public hunger: number = 100.0;
  public thirst: number = 100.0;
  public health: number = 100.0;
  public vision: number;
  public hungerCapacity: number = 100.0; // Max hunger (genetic)
  public thirstCapacity: number = 100.0; // Max thirst (genetic)
  
  // Breeding stats (derived from genome)
  public attractiveness: number; // 0-1
  public minAttractiveness: number; // 0-1, minimum attractiveness this squibble will mate with
  public virility: number; // 0-1, affects probability of successful breeding
  public gender: 'male' | 'female'; // Gender for breeding
  
  // Visual traits (from multi-allele genes, for future graphical update)
  public hornStyle: string;
  public eyeType: string;
  public earType: string;
  public tailType: string;
  public patternType: string;
  public bodyShape: string;
  
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
  
  // Drinking state
  public isDrinking: boolean = false;
  
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
  public pregnancyDuration: number = 25.0; // Current pregnancy duration (may be adjusted)
  public geneticGestationDuration: number = 25.0; // Base genetic gestation duration
  public pregnancyFather: Squibble | null = null; // Store father for genetics
  public litterSize: number = 2.0; // Average litter size (genetic, 1-4)
  public multiBabyPregnancyCount: number = 0; // Track pregnancies with 2+ babies for death risk
  
  // State
  public alive: boolean = true;
  public age: number = 0; // Age in frames
  public maxAge: number; // Maximum age in frames before death (genetic)
  
  constructor(x: number, y: number, color?: RGB, parent1?: Squibble, parent2?: Squibble) {
    this.x = x;
    this.y = y;
    
    // Genetics: inherit from parents or generate randomly
    if (parent1 && parent2) {
      // Inherit genome from parents with mutations
      this.genome = inheritGenome(parent1.genome, parent2.genome, DEFAULT_MUTATION_CONFIG);
    } else {
      // Generate random genome
      this.genome = generateRandomGenome();
    }
    
    // Express phenotypes from genome
    const phenotypes = expressGenome(this.genome);
    
    // Apply expressed traits
    this.color = color || (phenotypes.color as RGB);
    this.vision = phenotypes.vision;
    this.speed = phenotypes.speed;
    this.attractiveness = phenotypes.attractiveness;
    this.virility = phenotypes.virility;
    this.maxAge = phenotypes.maxAge;
    this.hungerCapacity = phenotypes.hungerCapacity;
    this.thirstCapacity = phenotypes.thirstCapacity;
    this.litterSize = phenotypes.litterSize;
    this.geneticGestationDuration = phenotypes.gestationDuration;
    
    // Set initial hunger/thirst to capacity
    this.hunger = this.hungerCapacity;
    this.thirst = this.thirstCapacity;
    
    // Visual traits (stored for future graphical update)
    this.hornStyle = phenotypes.hornStyle;
    this.eyeType = phenotypes.eyeType;
    this.earType = phenotypes.earType;
    this.tailType = phenotypes.tailType;
    this.patternType = phenotypes.patternType;
    this.bodyShape = phenotypes.bodyShape;
    
    // Gender is random (not genetic in this model)
    this.gender = Math.random() < 0.5 ? 'male' : 'female';
    
    // Min attractiveness is random preference (not inherited)
    this.minAttractiveness = Math.random();
    
    // Size with gender bias applied
    const baseSize = phenotypes.size;
    const genderBias = this.gender === 'female' ? -0.05 : 0.05;
    this.size = Math.max(0.6, Math.min(1.4, baseSize + genderBias));
    
    this.direction = Math.random() * 2 * Math.PI;
    this.directionChangeInterval = 30 + Math.floor(Math.random() * 90); // 30-120 frames
    
    // Set adult radius based on size stat (base 10, range ~6-14)
    this.adultRadius = 10 * this.size;
    
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
    
    // Try to drink if thirsty and near water (only stop to drink if actually thirsty)
    this.isDrinking = false;
    if (waterMap && this.thirst < 90) {
      if (waterMap.isWaterNear(this.x, this.y, this.radius + 20)) {
        // Drink: restore thirst gradually (stay until full)
        this.isDrinking = true;
        this.thirst = Math.min(this.thirstCapacity, this.thirst + 30.0 * dt);
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
    
    // Check if we need to seek water (start at 50%, drink until 90%)
    const seekingWater = this.thirst < 50;
    
    // Priority: Food > Water > Mate > Wander
    if (seekingFood && foodManager) {
      const nearestFood = foodManager.getNearestFood(this.x, this.y, this.vision);
      if (nearestFood) {
        // Move towards the food immediately
        const dx = nearestFood.x - this.x;
        const dy = nearestFood.y - this.y;
        this.direction = Math.atan2(dy, dx);
        this.directionChangeTimer = 0;
      }
    } else if (seekingWater && waterMap) {
      const nearestWater = waterMap.findNearestWater(this.x, this.y, this.vision);
      if (nearestWater) {
        // Move towards the water
        const dx = nearestWater.x - this.x;
        const dy = nearestWater.y - this.y;
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
    
    if (!this.isBreeding && !this.isDrinking) {
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
      size: this.size,
      hunger_capacity: this.hungerCapacity,
      thirst_capacity: this.thirstCapacity,
      litter_size: this.litterSize,
      gestation_duration: this.geneticGestationDuration,
      multi_baby_pregnancies: this.multiBabyPregnancyCount,
      // Visual traits (for future graphical update)
      horn_style: this.hornStyle,
      eye_type: this.eyeType,
      ear_type: this.earType,
      tail_type: this.tailType,
      pattern_type: this.patternType,
      body_shape: this.bodyShape,
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
    
    // Use genetic gestation duration with some variation (±20%)
    const baseGestation = this.geneticGestationDuration;
    const variation = baseGestation * 0.2 * (Math.random() * 2 - 1); // ±20%
    const gestation = baseGestation + variation;
    
    // Cap gestation at remaining lifespan (in seconds)
    const remainingLifeSeconds = (this.maxAge - this.age) / 60;
    this.pregnancyDuration = Math.min(gestation, remainingLifeSeconds - 1);
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
   * Determine actual litter size based on genetic average
   * Uses Poisson-like distribution centered on litterSize
   */
  private determineLitterSize(): number {
    // Use the genetic average as the mean for a Poisson-like distribution
    // Clamp to 1-4 range
    const mean = this.litterSize;
    
    // Simple approximation: use normal distribution, then round and clamp
    // For small means, we'll use a more direct approach
    let total = 0;
    const samples = 10; // Sample multiple times for smoother distribution
    for (let i = 0; i < samples; i++) {
      // Generate value around mean with some variance
      const value = mean + (Math.random() - 0.5) * 1.5;
      total += value;
    }
    const average = total / samples;
    
    // Round to nearest integer and clamp
    let litter = Math.round(average);
    litter = Math.max(1, Math.min(4, litter));
    
    return litter;
  }
  
  /**
   * Calculate childbirth death risk based on litter size and pregnancy history
   */
  private calculateChildbirthDeathRisk(litterSize: number): number {
    // Base risk increases with litter size
    // 1 baby: 0% risk (safe)
    // 2 babies: 5% risk
    // 3 babies: 15% risk
    // 4 babies: 30% risk
    let baseRisk = 0;
    if (litterSize === 2) {
      baseRisk = 0.05; // 5%
    } else if (litterSize === 3) {
      baseRisk = 0.15; // 15%
    } else if (litterSize >= 4) {
      baseRisk = 0.30; // 30%
    }
    // 1 baby has 0% risk (no risk for single births)
    
    // Additional risk from previous multi-baby pregnancies
    // Each previous multi-baby pregnancy adds 5% risk
    const historyRisk = this.multiBabyPregnancyCount * 0.05;
    
    // Total risk (capped at 80%)
    const totalRisk = Math.min(0.8, baseRisk + historyRisk);
    
    return totalRisk;
  }
  
  /**
   * Complete pregnancy (give birth)
   * Returns array of babies (can be 1-4)
   * May kill the mother if risk is high
   */
  giveBirth(): Squibble[] {
    if (!this.isPregnant || !this.pregnancyFather) return [];
    
    // Determine actual litter size
    const actualLitterSize = this.determineLitterSize();
    
    // Track if this is a multi-baby pregnancy
    if (actualLitterSize >= 2) {
      this.multiBabyPregnancyCount++;
    }
    
    // Calculate death risk
    const deathRisk = this.calculateChildbirthDeathRisk(actualLitterSize);
    
    // Check if mother dies during childbirth
    if (Math.random() < deathRisk) {
      // Mother dies
      this.alive = false;
      // Still give birth to babies before dying
    }
    
    // Create babies at mother's position (slightly spread out)
    const babies: Squibble[] = [];
    for (let i = 0; i < actualLitterSize; i++) {
      // Spread babies slightly (within 10 pixels)
      const angle = (i / actualLitterSize) * Math.PI * 2;
      const offset = 5 + Math.random() * 5;
      const babyX = this.x + Math.cos(angle) * offset;
      const babyY = this.y + Math.sin(angle) * offset;
      
      const baby = new Squibble(babyX, babyY, undefined, this, this.pregnancyFather);
      babies.push(baby);
    }
    
    // Reset pregnancy state
    this.isPregnant = false;
    this.pregnancyTimeRemaining = 0;
    this.pregnancyFather = null;
    
    return babies;
  }
}
