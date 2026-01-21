/**
 * Gnawlin - Predator creature that hunts Squibbles
 */

import { RGB, Point } from '../utils/types';
import { Squibble } from './Squibble';
import { WaterMap } from '../terrain/WaterMap';
import { Biome } from '../terrain/Biome';
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

export class Gnawlin {
  // Static counter for unique IDs
  private static nextId: number = 1;
  
  public id: number; // Unique identifier for this gnawlin
  public x: number;
  public y: number;
  public color: RGB;
  public size: number; // Heritable size stat (0.6 - 1.4 multiplier)
  public adultSize: number = 20; // Full grown size (base)
  public currentSize: number = 20; // Current size (grows from baby to adult)
  
  // Genome - stores all genetic information
  public genome: Genome;
  
  // Stats (derived from genome)
  public hunger: number = 100.0;
  public thirst: number = 100.0;
  public health: number = 100.0; // Current HP
  public maxHealth: number = 100.0; // Max HP (genetic)
  public vision: number;
  public hungerCapacity: number = 100.0; // Max hunger (genetic)
  public thirstCapacity: number = 100.0; // Max thirst (genetic)
  
  // Breeding stats (derived from genome)
  // Note: Gnawlins don't use attractiveness - they breed with any eligible gnawlin
  public virility: number; // 0-1, affects probability of successful breeding
  public gender: 'male' | 'female'; // Gender for breeding
  
  // Intelligence (0-1): reduces chance of cactus prick damage when eating cactus
  public intelligence: number;
  
  // Swim (0-1): efficiency in water; low = slow + higher drown chance
  public swim: number;
  
  // Metabolism (0-1): 0 = slow (less hunger/thirst drain, more from lichen), 1 = fast
  public metabolism: number;
  
  // Damage Resistance (0-0.5): 0 = no resistance, 0.5 = 50% damage resistance
  public damageResistance: number;
  
  // Aggressiveness (0-1): 0 = flee from predators, 1 = stand ground (for future predator update)
  public aggressiveness: number;
  
  // Damage (1-15): Combat damage/ability (for future combat system)
  public damage: number;
  
  // Accuracy (0.3-1.0): Chance to hit in combat
  public accuracy: number;
  
  // Combat state
  public isInCombat: boolean = false;
  public combatTarget: any = null; // Squibble that this is fighting
  public combatTurn: boolean = false; // True if it's this creature's turn to attack
  public combatTimer: number = 0; // Time until next turn (turn-based combat)
  private combatTurnDuration: number = 1.0; // 1 second per turn
  
  // Wet: after leaving water, slow for 30 seconds
  public wetTimer: number = 0;
  
  // Effective vision (base vision * forest penalty); set each frame in update
  public effectiveVision: number = 100;
  
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
  private matingHealthThreshold: number = 0.6; // Minimum health percentage (60%) to seek mates
  private matingHungerThreshold: number = 70.0; // Must be well-fed to seek mates (same as hunger threshold)
  private matingThirstThreshold: number = 70.0; // Must be well-hydrated to seek mates (same as thirst threshold)
  
  // Movement
  public speed: number;
  public direction: number;
  private directionChangeTimer: number = 0;
  private directionChangeInterval: number;
  
  // Water crossing target (set when entering water, cleared when reaching land)
  private waterCrossingTarget: { x: number; y: number } | null = null;
  
    // Speed-based consumption rates (slower than squibbles - gnawlins have slower metabolism)
    private baseHungerRate: number = 0.3; // Reduced from 0.5 (40% slower)
    private baseThirstRate: number = 0.2; // Reduced from 0.3 (33% slower)
  
  // Drinking state
  public isDrinking: boolean = false;
  
  // Eating state (hunting/eating Squibbles)
  public isEating: boolean = false;
  public eatingTimeRemaining: number = 0;
  private eatingDuration: number = 5.0; // 5 seconds to eat a Squibble
  public targetSquibble: Squibble | null = null; // Currently targeted/hunting Squibble
  
  // Breeding state
  public seekingMate: boolean = false;
  public isBreeding: boolean = false;
  public breedingPartner: Gnawlin | null = null;
  public breedingTimeRemaining: number = 0;
  private breedingDuration: number = 10.0; // 10 seconds to complete breeding
  private breedingCooldown: number = 0;
  private breedingCooldownDuration: number = 120.0; // 2 minutes between breeding attempts
  
  // Pregnancy state (females only)
  public isPregnant: boolean = false;
  public pregnancyTimeRemaining: number = 0;
  public pregnancyDuration: number = 40.0; // Current pregnancy duration (may be adjusted)
  public geneticGestationDuration: number = 40.0; // Base genetic gestation duration (longer than Squibbles: 30-50 seconds)
  public pregnancyFather: Gnawlin | null = null; // Store father for genetics
  public pregnancyFatherId: number | null = null; // Store father ID for family tree
  public litterSize: number = 2.0; // Average litter size (genetic, 1-4)
  public multiBabyPregnancyCount: number = 0; // Track pregnancies with 2+ babies for death risk
  
  // State
  public alive: boolean = true;
  public age: number = 0; // Age in frames
  public maxAge: number; // Maximum age in frames before death (genetic)
  public deathCause: 'age' | 'hunger' | 'thirst' | 'childbirth' | null = null;
  
  // Family tree tracking (using IDs instead of object references)
  public parent1Id: number | null = null; // Mother ID (or first parent ID)
  public parent2Id: number | null = null; // Father ID (or second parent ID)
  public mateIds: number[] = []; // All breeding partners this gnawlin has mated with
  
  constructor(x: number, y: number, color?: RGB, parent1?: Gnawlin, parent2?: Gnawlin) {
    // Assign unique ID
    this.id = Gnawlin.nextId++;
    
    this.x = x;
    this.y = y;
    
    // Store parent IDs for family tree (more reliable than object references)
    this.parent1Id = parent1?.id || null;
    this.parent2Id = parent2?.id || null;
    
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
    this.effectiveVision = phenotypes.vision; // updated each frame for forest penalty
    // Gnawlins are slower on average - apply 0.75x speed multiplier
    this.speed = phenotypes.speed * 0.75;
    this.virility = phenotypes.virility;
    
    // Gnawlins have longer lifespan: 10-15 minutes (600-900 seconds = 36000-54000 frames at 60fps)
    const baseMaxAgeSeconds = 600 + Math.random() * 300; // 600-900 seconds
    this.maxAge = Math.round(baseMaxAgeSeconds * 60); // Convert to frames
    
    this.hungerCapacity = phenotypes.hungerCapacity;
    this.thirstCapacity = phenotypes.thirstCapacity;
    
    // Gnawlins always have litter size of 1
    this.litterSize = 1.0;
    
    // Gnawlins have longer gestation than Squibbles: 30-50 seconds (instead of 15-35)
    // Override the genetic value to be in the longer range
    const baseGestation = phenotypes.gestationDuration;
    // Scale from Squibble range (15-35) to Gnawlin range (30-50)
    const squibbleMin = 15.0;
    const squibbleMax = 35.0;
    const gnawlinMin = 30.0;
    const gnawlinMax = 50.0;
    const normalized = (baseGestation - squibbleMin) / (squibbleMax - squibbleMin);
    this.geneticGestationDuration = gnawlinMin + normalized * (gnawlinMax - gnawlinMin);
    this.intelligence = phenotypes.intelligence;
    this.swim = phenotypes.swim;
    this.metabolism = phenotypes.metabolism;
    this.damageResistance = phenotypes.damageResistance;
    this.aggressiveness = phenotypes.aggressiveness;
    this.damage = phenotypes.damage;
    this.accuracy = phenotypes.accuracy;
    
    // Gnawlins have more health: 200-400 HP (vs 50-200 for Squibbles)
    const baseMaxHealth = 200 + Math.random() * 200; // 200-400 HP
    this.maxHealth = Math.round(baseMaxHealth);
    
    // Set initial hunger/thirst to capacity
    this.hunger = this.hungerCapacity;
    this.thirst = this.thirstCapacity;
    // Set initial health to max HP
    this.health = this.maxHealth;
    
    // Visual traits (stored for future graphical update)
    this.hornStyle = phenotypes.hornStyle;
    this.eyeType = phenotypes.eyeType;
    this.earType = phenotypes.earType;
    this.tailType = phenotypes.tailType;
    this.patternType = phenotypes.patternType;
    this.bodyShape = phenotypes.bodyShape;
    
    // Gender is random (not genetic in this model)
    this.gender = Math.random() < 0.5 ? 'male' : 'female';
    
    // Size with gender bias applied
    const baseSize = phenotypes.size;
    const genderBias = this.gender === 'female' ? -0.05 : 0.05;
    this.size = Math.max(0.6, Math.min(1.4, baseSize + genderBias));
    
    this.direction = Math.random() * 2 * Math.PI;
    this.directionChangeInterval = 30 + Math.floor(Math.random() * 90); // 30-120 frames
    
    // Set adult size based on size stat (base 20, range ~12-28)
    this.adultSize = 20 * this.size;
    
    if (parent1 && parent2) {
      // Babies start small
      this.currentSize = 8; // Smaller than adults
      this.age = 0;
    } else {
      // Initial gnawlins start as young adults (at beginning of fertile period)
      this.age = Math.floor(this.maxAge * 0.2); // Start at 20% of max age (just became adult)
      this.currentSize = this.adultSize; // Already full size
    }
  }
  
  /**
   * Update gnawlin behavior (hunting Squibbles, movement, etc.)
   */
  update(
    dt: number,
    screenWidth: number,
    screenHeight: number,
    squibbleManager?: any, // For finding prey (Squibbles)
    waterMap?: WaterMap,
    gnawlinManager?: any, // GnawlinManager for finding mates
    getBiomeAt?: (x: number, y: number) => number
  ): void {
    if (!this.alive) {
      return;
    }
    
    // Age
    this.age++;
    if (this.age >= this.maxAge) {
      this.deathCause = 'age';
      this.alive = false;
      return;
    }
    
    // Grow from baby to adult size over first 1/5 of life
    if (this.age < this.maxAge * 0.2) {
      const growthProgress = this.age / (this.maxAge * 0.2);
      this.currentSize = 8 + (this.adultSize - 8) * growthProgress;
    }
    
    // Fertility window: cannot breed during first and last 1/5 of life
    const fertilityStart = this.maxAge * 0.2;
    const fertilityEnd = this.maxAge * 0.8;
    const isFertile = this.age >= fertilityStart && this.age <= fertilityEnd;
    
    // Update breeding cooldown
    if (this.breedingCooldown > 0) {
      this.breedingCooldown -= dt;
    }
    
    // Update pregnancy
    if (this.isPregnant) {
      this.pregnancyTimeRemaining = Math.max(0, this.pregnancyTimeRemaining - dt);
      // Birth is handled by GnawlinManager.processPregnancies()
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
      
      // Keep breeding partners close together (maintain breeding distance)
      const dx = this.breedingPartner.x - this.x;
      const dy = this.breedingPartner.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const targetDistance = (this.currentSize + this.breedingPartner.currentSize) / 2 + 5; // Close together
      
      if (distance > targetDistance && distance > 0) {
        // Move closer to partner
        const pullStrength = (distance - targetDistance) * 0.3;
        this.x += (dx / distance) * pullStrength;
        this.y += (dy / distance) * pullStrength;
      } else if (distance < targetDistance && distance > 0) {
        // Push apart slightly if too close
        const pushStrength = (targetDistance - distance) * 0.2;
        this.x -= (dx / distance) * pushStrength;
        this.y -= (dy / distance) * pushStrength;
      }
      
      // Face the partner
      this.direction = Math.atan2(dy, dx);
      
      // Stop movement while breeding (gnawlins stay in place during breeding)
      // If breeding completes, it's handled by GnawlinManager
    }
    
    // Update eating timer
    if (this.isEating) {
      this.eatingTimeRemaining -= dt;
      if (this.eatingTimeRemaining <= 0) {
        this.isEating = false;
        this.eatingTimeRemaining = 0;
        // Clear target after eating
        if (this.targetSquibble && !this.targetSquibble.alive) {
          this.targetSquibble = null;
        }
      }
    }
    
    // Update wet timer
    if (this.wetTimer > 0) {
      this.wetTimer -= dt;
    }
    
    // Update combat timer
    if (this.isInCombat) {
      this.combatTimer -= dt;
      if (this.combatTimer <= 0) {
        this.combatTurn = true;
        this.combatTimer = this.combatTurnDuration;
      }
    }
    
    // Biome effects
    const currentBiome = getBiomeAt ? getBiomeAt(this.x, this.y) : -1;
    const inForest = currentBiome === Biome.FOREST;
    const inDesert = currentBiome === Biome.DESERT;
    const inTundra = currentBiome === Biome.TUNDRA;
    
    // Forest reduces vision and movement
    if (inForest) {
      this.effectiveVision = this.vision * 0.7;
    } else {
      this.effectiveVision = this.vision;
    }
    
    // Tundra slows movement
    const tundraSpeedMultiplier = inTundra ? 0.7 : 1.0;
    
    // Desert increases thirst drain
    const thirstBiomeMultiplier = inDesert ? 1.5 : 1.0;
    
    // Wet condition slows movement
    const wetSpeedMultiplier = this.wetTimer > 0 ? 0.7 : 1.0;
    
    // Pregnancy slows movement and increases consumption
    const pregnancyMultiplier = this.isPregnant ? 1.3 : 1.0;
    const pregnancyProgress = this.isPregnant ? 1 - (this.pregnancyTimeRemaining / this.pregnancyDuration) : 0;
    const pregnancySpeedMultiplier = this.isPregnant ? (1.0 - pregnancyProgress * 0.3) : 1.0; // Up to 30% slower
    
    // Metabolism affects consumption rate (gnawlins have inherently slower metabolism)
    // Base metabolism multiplier is lower for gnawlins (0.5x to 1.0x instead of 0.7x to 1.3x)
    const metabolismDrain = 0.5 + (this.metabolism * 0.5); // 0.5x to 1.0x drain (slower than squibbles)
    
    // Calculate effective speed
    const effectiveSpeed = this.speed * tundraSpeedMultiplier * wetSpeedMultiplier * pregnancySpeedMultiplier;
    
    // Don't drain hunger while eating (they're actively consuming food)
    if (!this.isEating) {
      this.hunger -= this.baseHungerRate * effectiveSpeed * pregnancyMultiplier * metabolismDrain * dt;
    }
    
    // Don't drain thirst while drinking (they're actively consuming water)
    if (!this.isDrinking) {
      this.thirst -= this.baseThirstRate * effectiveSpeed * pregnancyMultiplier * thirstBiomeMultiplier * metabolismDrain * dt;
    }
    
    // Health checks
    if (this.hunger <= 0 || this.thirst <= 0) {
      this.health = Math.max(0, this.health - 0.5 * dt); // Lose health if starving/dehydrated
    }
    if (this.health <= 0) {
      // Health <= 0 from starvation/dehydration
      if (this.hunger <= 0) {
        this.deathCause = 'hunger';
      } else if (this.thirst <= 0) {
        this.deathCause = 'thirst';
      } else {
        // Fallback to hunger if health is 0
        this.deathCause = 'hunger';
      }
      this.alive = false;
      return;
    }
    
    // Check if we need to seek food (Squibbles)
    const isHungry = this.hunger < this.hungerThreshold;
    
    // Check if we need to seek water
    const isThirsty = this.thirst < this.thirstThreshold;
    
    // Check if we can seek mate (must be healthy, well-fed, well-hydrated, fertile, and not on cooldown)
    const canSeekMate = isFertile &&
                       (this.health / this.maxHealth) >= this.matingHealthThreshold &&
                       this.hunger >= this.matingHungerThreshold &&
                       this.thirst >= this.matingThirstThreshold &&
                       this.breedingCooldown <= 0 &&
                       !this.isBreeding &&
                       !this.isPregnant;
    
    this.seekingMate = canSeekMate;
    
    // Handle combat
    if (this.isInCombat && this.combatTarget) {
      // Check if target is still alive and in range
      if (!this.combatTarget.alive) {
        // Target died - restore full hunger and end combat
        this.hunger = this.hungerCapacity; // Full hunger on successful kill
        this.endCombat();
      } else {
        const dx = this.combatTarget.x - this.x;
        const dy = this.combatTarget.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If target moved too far, end combat
        if (distance > this.effectiveVision * 1.5) {
          this.endCombat();
        } else {
          // Face the target
          this.direction = Math.atan2(dy, dx);
          
          // Maintain minimum combat distance to prevent overlap
          const targetRadius = this.combatTarget instanceof Squibble ? this.combatTarget.radius : this.combatTarget.currentSize / 2;
          const minCombatDistance = this.currentSize / 2 + targetRadius + 5;
          if (distance < minCombatDistance && distance > 0) {
            // Push apart to maintain combat distance
            const pushDistance = (minCombatDistance - distance) * 0.5;
            const pushX = (dx / distance) * pushDistance;
            const pushY = (dy / distance) * pushDistance;
            this.x -= pushX;
            this.y -= pushY;
          }
          
          // If it's this gnawlin's turn, attack
          if (this.combatTurn) {
            this.performAttack(this.combatTarget);
            this.combatTurn = false;
          }
        }
      }
    } else {
      // Not in combat - prioritize: hunting > mate-seeking > water > wander
      
      // First priority: Hunt Squibbles if hungry
      if (isHungry && squibbleManager) {
        const nearestSquibble = this.findNearestSquibble(squibbleManager);
        
        if (nearestSquibble && nearestSquibble.alive) {
          const dx = nearestSquibble.x - this.x;
          const dy = nearestSquibble.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If close enough, initiate combat
          if (distance <= (this.currentSize + nearestSquibble.radius + 20)) {
            this.startCombat(nearestSquibble);
          } else {
            // Move towards the Squibble
            this.direction = Math.atan2(dy, dx);
            this.targetSquibble = nearestSquibble;
          }
        } else {
          // No Squibble found, check for other priorities
          this.targetSquibble = null;
        }
      } else {
        // Not hungry - clear hunting target
        this.targetSquibble = null;
      }
      
      // Second priority: Seek water if thirsty (survival first)
      if (isThirsty && !this.isDrinking && waterMap) {
        const waterTarget = this.findWaterTarget(waterMap);
        if (waterTarget) {
          const dx = waterTarget.x - this.x;
          const dy = waterTarget.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If close enough, start drinking
          if (distance <= (this.currentSize + 20)) {
            this.isDrinking = true;
          } else {
            // Move towards water
            this.direction = Math.atan2(dy, dx);
          }
        }
      }
      
      // Third priority: Seek mate if conditions are met (only if not hungry and not thirsty)
      if (!isHungry && !isThirsty && this.seekingMate && !this.isBreeding && gnawlinManager) {
        const mate = gnawlinManager.findPotentialMate(this, waterMap);
        if (mate) {
          // Move towards mate (GnawlinManager.processBreeding() will handle starting breeding when close enough)
          const dx = mate.x - this.x;
          const dy = mate.y - this.y;
          this.direction = Math.atan2(dy, dx);
        }
      }
      
      // Last priority: Wander if nothing else to do
      if (!isHungry && !isThirsty && !this.seekingMate) {
        this.directionChangeTimer += dt;
        if (this.directionChangeTimer >= this.directionChangeInterval / 60) {
          this.direction = Math.random() * 2 * Math.PI;
          this.directionChangeTimer = 0;
          this.directionChangeInterval = 30 + Math.floor(Math.random() * 90);
        }
      }
    }
    
    // Drink water
    if (this.isDrinking && waterMap) {
      const waterDetectionRadius = this.currentSize + 20;
      if (waterMap.isWaterNear(this.x, this.y, waterDetectionRadius)) {
        // Gradually restore thirst
        this.thirst = Math.min(this.thirstCapacity, this.thirst + 20 * dt);
        if (this.thirst >= 90) {
          // Fully hydrated, stop drinking
          this.isDrinking = false;
        }
      } else {
        // Moved away from water
        this.isDrinking = false;
      }
    }
    
    // Movement (only if not eating, drinking, or breeding)
    if (!this.isEating && !this.isDrinking && !this.isBreeding) {
      const inWater = waterMap?.isWaterAt(this.x, this.y) ?? false;
      
      // Water evasion and crossing logic (similar to Squibbles)
      if (waterMap && !inWater) {
        const nextX = this.x + Math.cos(this.direction) * effectiveSpeed;
        const nextY = this.y + Math.sin(this.direction) * effectiveSpeed;
        const nextInWater = waterMap.isWaterAt(nextX, nextY);
        
        if (nextInWater) {
          // About to enter water - decide whether to cross
          const shouldCross = Math.random() < (0.3 + this.swim * 0.2); // 30-50% base chance, modified by swim stat
          
          if (shouldCross) {
            // Find land target on other side
            const landTarget = this.findLandTarget(nextX, nextY, this.direction, waterMap);
            if (landTarget) {
              this.waterCrossingTarget = landTarget;
            }
          } else {
            // Decided not to cross - try to avoid
            const alt = this.tryAvoidWaterDirection(this.x, this.y, this.direction, effectiveSpeed, waterMap);
            if (alt !== null) this.direction = alt;
          }
        }
      }
      
      // Only move if not in combat (combat handles positioning separately)
      if (!this.isInCombat) {
        this.x += Math.cos(this.direction) * effectiveSpeed;
        this.y += Math.sin(this.direction) * effectiveSpeed;
      }
      
      // Just left water: apply wet for 30 seconds and clear crossing target
      const inWaterAfter = waterMap?.isWaterAt(this.x, this.y) ?? false;
      if (inWater && !inWaterAfter) {
        this.wetTimer = 30;
        this.waterCrossingTarget = null; // Clear target when reaching land
      }
      
      // Drowning chance while in water
      if (inWaterAfter) {
        const drownChance = (1 - this.swim) * 0.001 * dt; // Higher chance for low swim stat
        if (Math.random() < drownChance) {
          this.health = Math.max(0, this.health - 10 * dt); // Take damage while drowning
        }
      }
    }
    
    // Bounce off boundaries
    if (this.x - this.currentSize <= 0 || this.x + this.currentSize >= screenWidth) {
      this.direction = Math.PI - this.direction;
      this.x = Math.max(this.currentSize, Math.min(screenWidth - this.currentSize, this.x));
    }
    
    if (this.y - this.currentSize <= 0 || this.y + this.currentSize >= screenHeight) {
      this.direction = -this.direction;
      this.y = Math.max(this.currentSize, Math.min(screenHeight - this.currentSize, this.y));
    }
    
    // Reset direction if it becomes invalid
    if (!isFinite(this.direction)) {
      this.direction = Math.random() * 2 * Math.PI;
    }
  }
  
  /**
   * Find the nearest Squibble within vision range
   */
  private findNearestSquibble(squibbleManager: any): Squibble | null {
    let nearest: Squibble | null = null;
    let nearestDistance = Infinity;
    
    const allSquibbles = squibbleManager.getAll();
    for (const squibble of allSquibbles) {
      if (!squibble.alive) continue;
      
      const dx = squibble.x - this.x;
      const dy = squibble.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= this.effectiveVision && distance < nearestDistance) {
        nearest = squibble;
        nearestDistance = distance;
      }
    }
    
    return nearest;
  }
  
  /**
   * Find water target within vision range
   */
  private findWaterTarget(waterMap: WaterMap): Point | null {
    const searchRadius = this.effectiveVision;
    const stepSize = 20;
    let bestWater: Point | null = null;
    let bestDistance = Infinity;
    
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      for (let dist = stepSize; dist <= searchRadius; dist += stepSize) {
        const x = this.x + Math.cos(angle) * dist;
        const y = this.y + Math.sin(angle) * dist;
        
        if (waterMap.isWaterAt(x, y)) {
          const dx = x - this.x;
          const dy = y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < bestDistance) {
            bestWater = { x, y };
            bestDistance = distance;
          }
        }
      }
    }
    
    return bestWater;
  }
  
  /**
   * Find a land target on the other side of water
   */
  private findLandTarget(startX: number, startY: number, direction: number, waterMap: WaterMap): Point | null {
    const searchDistance = 200;
    const stepSize = 10;
    
    for (let dist = 0; dist <= searchDistance; dist += stepSize) {
      const x = startX + Math.cos(direction) * dist;
      const y = startY + Math.sin(direction) * dist;
      
      if (!waterMap.isWaterAt(x, y)) {
        return { x, y };
      }
    }
    
    return null;
  }
  
  /**
   * Try to pick a direction that avoids stepping into water
   */
  private tryAvoidWaterDirection(x: number, y: number, dir: number, stepSize: number, waterMap: WaterMap): number | null {
    const offsets = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4];
    for (const off of offsets) {
      const tryDir = dir + off;
      const nx = x + Math.cos(tryDir) * stepSize;
      const ny = y + Math.sin(tryDir) * stepSize;
      if (!waterMap.isWaterAt(nx, ny)) return tryDir;
    }
    return null;
  }
  
  /**
   * Start breeding with another gnawlin
   */
  startBreeding(partner: Gnawlin): void {
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
    // Track the mate before clearing the breeding partner
    // This ensures all successful breedings are recorded, even if no child is produced
    if (this.breedingPartner) {
      const partnerId = this.breedingPartner.id;
      // Add to this gnawlin's mate list
      if (!this.mateIds.includes(partnerId)) {
        this.mateIds.push(partnerId);
      }
      // Also add this gnawlin to the partner's mate list (reciprocal tracking)
      if (!this.breedingPartner.mateIds.includes(this.id)) {
        this.breedingPartner.mateIds.push(this.id);
      }
    }
    
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
  startPregnancy(father: Gnawlin): void {
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
    this.pregnancyFatherId = father.id;
  }
  
  /**
   * Check if ready to give birth
   */
  isReadyToGiveBirth(): boolean {
    return this.isPregnant && this.pregnancyTimeRemaining <= 0;
  }
  
  /**
   * Determine actual litter size
   * Gnawlins always have exactly 1 baby
   */
  private determineLitterSize(): number {
    return 1;
  }
  
  /**
   * Calculate childbirth death risk based on litter size and pregnancy history
   * Gnawlins always have 1 baby, so no death risk
   */
  private calculateChildbirthDeathRisk(litterSize: number): number {
    // Gnawlins always have exactly 1 baby, so there's no childbirth death risk
    return 0;
  }
  
  /**
   * Complete pregnancy (give birth)
   * Returns array of babies (can be 1-4)
   * May kill the mother if risk is high
   */
  giveBirth(gnawlinManager?: any): Gnawlin[] {
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
      this.deathCause = 'childbirth';
      this.alive = false;
      // Still give birth to babies before dying
    }
    
    // Create babies at mother's position (slightly spread out)
    const babies: Gnawlin[] = [];
    for (let i = 0; i < actualLitterSize; i++) {
      // Spread babies slightly (within 10 pixels)
      const angle = (i / actualLitterSize) * Math.PI * 2;
      const offset = 5 + Math.random() * 5;
      const babyX = this.x + Math.cos(angle) * offset;
      const babyY = this.y + Math.sin(angle) * offset;
      
      const baby = new Gnawlin(babyX, babyY, undefined, this, this.pregnancyFather);
      babies.push(baby);
    }
    
    // Reset pregnancy state
    this.isPregnant = false;
    this.pregnancyTimeRemaining = 0;
    this.pregnancyFather = null;
    this.pregnancyFatherId = null;
    
    return babies;
  }
  
  /**
   * Check if gnawlin is in fertile age (middle 3/5 of life)
   */
  isInFertileAge(): boolean {
    const youngLimit = this.maxAge * 0.2; // First 1/5
    const oldLimit = this.maxAge * 0.8;   // Last 1/5
    return this.age >= youngLimit && this.age <= oldLimit;
  }
  
  /**
   * Start combat with a target
   */
  startCombat(target: Squibble): void {
    if (this.isInCombat) return; // Already in combat
    
    this.isInCombat = true;
    this.combatTarget = target;
    this.combatTurn = true; // Gnawlin attacks first
    this.combatTimer = this.combatTurnDuration;
    
    // Also set the Squibble's combat state
    if (!target.isInCombat) {
      target.startCombat(this);
    }
  }
  
  /**
   * End combat
   */
  endCombat(): void {
    if (this.combatTarget) {
      // Clear target's combat state if it's still pointing to us
      if (this.combatTarget.combatTarget === this) {
        this.combatTarget.isInCombat = false;
        this.combatTarget.combatTarget = null;
        this.combatTarget.combatTurn = false;
        this.combatTarget.combatTimer = 0;
      }
    }
    
    this.isInCombat = false;
    this.combatTarget = null;
    this.combatTurn = false;
    this.combatTimer = 0;
  }
  
  /**
   * Perform an attack on the target
   */
  performAttack(target: Squibble): void {
    // Check accuracy - chance to hit
    if (Math.random() < this.accuracy) {
      // Hit! Calculate damage
      const baseDamage = this.damage;
      // Apply target's damage resistance
      const actualDamage = baseDamage * (1 - target.damageResistance);
      target.health = Math.max(0, target.health - actualDamage);
      
      // Check if target died
      if (target.health <= 0) {
        target.deathCause = 'predator';
        target.alive = false;
        // Restore full hunger on successful kill
        this.hunger = this.hungerCapacity;
        // Heal after successful kill (restore up to 50% of max health)
        const healAmount = this.maxHealth * 0.5;
        this.health = Math.min(this.maxHealth, this.health + healAmount);
        this.endCombat();
      }
    }
    // Miss - no damage dealt
  }
  
  /**
   * Check if this gnawlin can mate with another
   */
  canMateWith(other: Gnawlin, allowInterruption: boolean = false, waterMap?: WaterMap): boolean {
    // Both must be alive
    if (!this.alive || !other.alive) return false;
    
    // Must be opposite genders
    if (this.gender === other.gender) return false;
    
    // Both must be in fertile age (not too young or too old)
    if (!this.isInFertileAge() || !other.isInFertileAge()) return false;
    
    // Pregnant gnawlins cannot breed
    if (this.isPregnant || other.isPregnant) return false;
    
    // Cannot breed in water - check if either gnawlin is in water
    if (waterMap) {
      if (waterMap.isWaterAt(this.x, this.y) || waterMap.isWaterAt(other.x, other.y)) {
        return false;
      }
    }
    
    // If not allowing interruption, check cooldowns and breeding status
    if (!allowInterruption) {
      if (this.breedingCooldown > 0 || other.breedingCooldown > 0) return false;
      if (this.isBreeding || other.isBreeding) return false;
    }
    
    // Both must meet health/hunger/thirst thresholds
    const thisHealthPercent = this.health / this.maxHealth;
    if (thisHealthPercent < this.matingHealthThreshold || 
        this.hunger < this.matingHungerThreshold || 
        this.thirst < this.matingThirstThreshold) return false;
    const otherHealthPercent = other.health / other.maxHealth;
    if (otherHealthPercent < other.matingHealthThreshold || 
        other.hunger < other.matingHungerThreshold ||
        other.thirst < other.matingThirstThreshold) return false;
    
    // Gnawlins don't check attractiveness - they breed with any eligible gnawlin
    
    return true;
  }
  
  /**
   * Get stats for display
   */
  getStats() {
    // Convert frame-based age to seconds (assuming ~60fps)
    const ageInSeconds = this.age / 60;
    const maxAgeInSeconds = this.maxAge / 60;
    
    return {
      id: this.id,
      gender: this.gender,
      age: ageInSeconds,
      max_age: maxAgeInSeconds,
      alive: this.alive,
      health: this.health,
      max_health: this.maxHealth,
      health_percentage: (this.health / this.maxHealth) * 100,
      hunger: (this.hunger / this.hungerCapacity) * 100,
      thirst: (this.thirst / this.thirstCapacity) * 100,
      hunger_capacity: this.hungerCapacity,
      thirst_capacity: this.thirstCapacity,
      speed: this.speed,
      vision: this.vision,
      intelligence: this.intelligence,
      swim: this.swim,
      metabolism: this.metabolism,
      damage_resistance: this.damageResistance,
      aggressiveness: this.aggressiveness,
      damage: this.damage,
      accuracy: this.accuracy,
      virility: this.virility,
      size: this.size,
      litter_size: this.litterSize,
      gestation_duration: this.geneticGestationDuration,
      multi_baby_pregnancies: this.multiBabyPregnancyCount,
      breeding_cooldown: this.breedingCooldown,
      is_pregnant: this.isPregnant,
      pregnancy_progress: this.isPregnant ? 1 - (this.pregnancyTimeRemaining / this.pregnancyDuration) : 0,
      seeking_food: this.hunger < this.hungerThreshold,
      seeking_mate: this.seekingMate,
      wet_timer: this.wetTimer,
      horn_style: this.hornStyle,
      eye_type: this.eyeType,
      ear_type: this.earType,
      tail_type: this.tailType,
      pattern_type: this.patternType,
      body_shape: this.bodyShape,
    };
  }
}
