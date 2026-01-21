/**
 * Squibble - Individual creature class
 */

import { RGB, Point } from '../utils/types';
import { Food } from '../food/Food';
import { FoodManager } from '../food/FoodManager';
import { WaterMap } from '../terrain/WaterMap';
import { Biome } from '../terrain/Biome';
import { Gnawlin } from './Gnawlin';
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
  // Static counter for unique IDs
  private static nextId: number = 1;
  
  public id: number; // Unique identifier for this squibble
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
  public health: number = 100.0; // Current HP
  public maxHealth: number = 100.0; // Max HP (genetic)
  public vision: number;
  public hungerCapacity: number = 100.0; // Max hunger (genetic)
  public thirstCapacity: number = 100.0; // Max thirst (genetic)
  
  // Breeding stats (derived from genome)
  public attractiveness: number; // 0-1
  public minAttractiveness: number; // 0-1, minimum attractiveness this squibble will mate with
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
  
  // Awareness (0-1): Likelihood of noticing and avoiding predators when in vision
  public awareness: number;
  
  // Combat state
  public isInCombat: boolean = false;
  public combatTarget: any = null; // Squibble or Gnawlin that this is fighting
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
  private matingHungerThreshold: number = 65.0; // Must be well-fed to seek mates
  private matingThirstThreshold: number = 65.0; // Must be well-hydrated to seek mates
  
  // Movement
  public speed: number;
  public direction: number;
  private directionChangeTimer: number = 0;
  private directionChangeInterval: number;
  
  // Water crossing target (set when entering water, cleared when reaching land)
  private waterCrossingTarget: { x: number; y: number } | null = null;
  
  // Speed-based consumption rates
  private baseHungerRate: number = 0.5;
  private baseThirstRate: number = 0.3;
  
  // Drinking state
  public isDrinking: boolean = false;
  
  // Eating state
  public isEating: boolean = false;
  public eatingTimeRemaining: number = 0;
  private eatingDuration: number = 5.0; // 5 seconds to eat food
  
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
  public deathCause: 'age' | 'hunger' | 'thirst' | 'predator' | 'drowning' | 'childbirth' | null = null;
  
  // Family tree tracking (using IDs instead of object references)
  public parent1Id: number | null = null; // Mother ID (or first parent ID)
  public parent2Id: number | null = null; // Father ID (or second parent ID)
  public mateIds: number[] = []; // All breeding partners this squibble has mated with
  
  constructor(x: number, y: number, color?: RGB, parent1?: Squibble, parent2?: Squibble) {
    // Assign unique ID
    this.id = Squibble.nextId++;
    
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
    this.speed = phenotypes.speed;
    this.attractiveness = phenotypes.attractiveness;
    this.virility = phenotypes.virility;
    this.maxAge = phenotypes.maxAge;
    this.hungerCapacity = phenotypes.hungerCapacity;
    this.thirstCapacity = phenotypes.thirstCapacity;
    this.litterSize = phenotypes.litterSize;
    this.geneticGestationDuration = phenotypes.gestationDuration;
    this.intelligence = phenotypes.intelligence;
    this.swim = phenotypes.swim;
    this.metabolism = phenotypes.metabolism;
    this.damageResistance = phenotypes.damageResistance;
    this.aggressiveness = phenotypes.aggressiveness;
    this.damage = phenotypes.damage;
    this.maxHealth = phenotypes.maxHealth;
    this.accuracy = phenotypes.accuracy;
    this.awareness = phenotypes.awareness;
    
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
    
    // Min attractiveness is random preference (not inherited)
    // Lower values = less picky, more likely to breed
    // Using Math.random() * 0.6 to make squibbles less picky on average (0-0.6 range instead of 0-1)
    this.minAttractiveness = Math.random() * 0.6;
    
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
    squibbleManager?: any, // SquibbleManager for finding mates
    getBiomeAt?: (x: number, y: number) => number,
    gnawlinManager?: any // GnawlinManager for predator detection
  ): void {
    if (!this.alive) {
      return;
    }
    
    this.age++;
    
    // Die of old age
    if (this.age >= this.maxAge) {
      this.deathCause = 'age';
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
    
    // Update combat timer
    if (this.isInCombat) {
      this.combatTimer -= dt;
      if (this.combatTimer <= 0) {
        this.combatTurn = true;
        this.combatTimer = this.combatTurnDuration;
      }
    }
    
    // Handle combat
    if (this.isInCombat && this.combatTarget) {
      // Check if target is still alive and in range
      if (!this.combatTarget.alive) {
        // Target died, end combat
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
          const minCombatDistance = this.radius + (this.combatTarget instanceof Squibble ? this.combatTarget.radius : this.combatTarget.currentSize / 2) + 5;
          if (distance < minCombatDistance && distance > 0) {
            // Push apart to maintain combat distance
            const pushDistance = (minCombatDistance - distance) * 0.5;
            const pushX = (dx / distance) * pushDistance;
            const pushY = (dy / distance) * pushDistance;
            this.x -= pushX;
            this.y -= pushY;
          }
          
          // If it's this squibble's turn, attack
          if (this.combatTurn) {
            this.performAttack(this.combatTarget);
            this.combatTurn = false;
          }
        }
      }
    } else {
      // Not in combat - check for predators (Gnawlins) using awareness
      if (gnawlinManager) {
        const nearestGnawlin = this.findNearestGnawlin(gnawlinManager);
        if (nearestGnawlin && nearestGnawlin.alive) {
          const dx = nearestGnawlin.x - this.x;
          const dy = nearestGnawlin.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= this.effectiveVision) { // Gnawlin in sight
            // Calculate effective awareness (pregnant squibbles get a boost)
            const pregnancyAwarenessBoost = this.isPregnant ? 0.3 : 0; // +30% awareness when pregnant
            const effectiveAwareness = Math.min(1.0, this.awareness + pregnancyAwarenessBoost);
            
            // Check if squibble notices the predator (based on awareness)
            const noticesPredator = Math.random() < effectiveAwareness;
            
            if (noticesPredator) {
              // Noticed the predator - decide whether to flee or stand ground based on aggressiveness
              // Low aggressiveness = flee, High aggressiveness = stand ground and continue normal behavior
              if (Math.random() < this.aggressiveness) {
                // Stand ground - continue doing what they're doing (don't flee, but also don't attack)
                // Squibbles never initiate combat with Gnawlins
              } else {
                // Flee from the predator
                this.fleeFrom(nearestGnawlin);
              }
            }
            // If not noticed, squibble continues normal behavior (unaware of danger)
          }
        }
      }
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
    // Metabolism: 0 = slow (0.6x drain), 1 = fast (1.4x drain)
    const metabolismDrain = 0.6 + 0.8 * this.metabolism;
    
    // Don't drain hunger while eating (they're actively consuming food)
    if (!this.isEating) {
      this.hunger -= this.baseHungerRate * speedMultiplier * pregnancyMultiplier * metabolismDrain * dt;
    }
    
    // Biome at current position (used for desert thirst, forest vision/speed, tundra speed)
    const biome = getBiomeAt?.(this.x, this.y) ?? -1;
    const thirstBiomeMultiplier = (biome === Biome.DESERT) ? 1.8 : 1.0;
    // Don't drain thirst while drinking (they're actively consuming water)
    if (!this.isDrinking) {
      this.thirst -= this.baseThirstRate * speedMultiplier * pregnancyMultiplier * thirstBiomeMultiplier * metabolismDrain * dt;
    }
    
    // Forest reduces vision and movement (dense foliage)
    this.effectiveVision = this.vision * (biome === Biome.FOREST ? 0.7 : 1.0);
    
    // Die if stats reach 0
    if (this.hunger <= 0 || this.thirst <= 0 || this.health <= 0) {
      if (this.hunger <= 0) {
        this.deathCause = 'hunger';
      } else if (this.thirst <= 0) {
        this.deathCause = 'thirst';
      } else {
        // Health <= 0 could be from various causes, but if hunger/thirst are fine, it's likely from combat
        // We'll set it as predator if not already set
        if (!this.deathCause) {
          this.deathCause = 'predator';
        }
      }
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
    
    // Update eating timer
    if (this.isEating) {
      this.eatingTimeRemaining -= dt;
      if (this.eatingTimeRemaining <= 0) {
        this.isEating = false;
        this.eatingTimeRemaining = 0;
      }
    }
    
    // Try to eat food if available and (hungry OR thirsty with thirst-restoring food OR need health restoration)
    // Only if not already eating
    if (!this.isEating && foodManager) {
      const isHungry = this.hunger < this.hungerThreshold;
      const isThirsty = this.thirst < 50; // Same threshold as seeking water
      const needsHealth = this.health < this.maxHealth; // Need health restoration
      
      // Only try to eat if we actually need food/thirst/health
      if (isHungry || isThirsty || needsHealth) {
        const result = foodManager.eatFoodAtPosition(this.x, this.y, this.radius + 5, this.intelligence, this.metabolism);
        if (result && (result.hungerGain > 0 || result.thirstGain > 0)) {
          // Check if this food provides what we need:
          // - If hungry: must provide hunger gain
          // - If thirsty: must provide thirst gain (like cactus)
          // - If need health: must provide health (all foods except cactus restore health)
          // - If both hungry and thirsty: must provide at least one
          const providesNeededBenefit = (isHungry && result.hungerGain > 0) || 
                                       (isThirsty && result.thirstGain > 0) ||
                                       (needsHealth && result.species && result.species !== 'cactus');
          
          if (providesNeededBenefit) {
            // Start eating - pause for 5 seconds
            this.isEating = true;
            this.eatingTimeRemaining = this.eatingDuration;
            
            // Apply food benefits immediately - always apply both hunger and thirst if available
            // (even if we only needed one, getting both is fine)
            this.hunger = Math.min(this.hungerCapacity, this.hunger + result.hungerGain);
            this.thirst = Math.min(this.thirstCapacity, this.thirst + result.thirstGain);
            
            // Restore health for all foods except cactus
            if (result.species && result.species !== 'cactus') {
              // Restore health based on hunger gain (proportional to food value)
              const healthGain = Math.min(5, result.hungerGain * 0.2); // Up to 5 HP, or 20% of hunger gain
              this.health = Math.min(this.maxHealth, this.health + healthGain);
            }
            
            // Cactus can prick: intelligence reduces harm chance. Cactus does not restore health.
            // Damage resistance reduces actual damage taken
            if (result.healthDamage && result.healthDamage > 0) {
              const actualDamage = result.healthDamage * (1 - this.damageResistance);
              this.health = Math.max(0, this.health - actualDamage);
            }
          }
        }
      }
    }
    
    // Check if we need to seek food (hungry OR need health restoration)
    const seekingFood = this.hunger < this.hungerThreshold || this.health < this.maxHealth;
    
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
      const nearestFood = foodManager.getNearestFood(this.x, this.y, this.effectiveVision);
      if (nearestFood) {
        // Move towards the food immediately
        const dx = nearestFood.x - this.x;
        const dy = nearestFood.y - this.y;
        this.direction = Math.atan2(dy, dx);
        this.directionChangeTimer = 0;
      }
    } else if (seekingWater && waterMap) {
      // Special behavior: if in desert and thirsty, try cacti first, then explore out of desert
      const currentBiome = getBiomeAt?.(this.x, this.y) ?? -1;
      const inDesert = currentBiome === Biome.DESERT;
      
      if (inDesert && foodManager) {
        // First, try to find a cactus (cacti restore thirst)
        const nearestCactus = foodManager.getNearestCactus(this.x, this.y, this.effectiveVision);
        if (nearestCactus) {
          // Move towards the cactus
          const dx = nearestCactus.x - this.x;
          const dy = nearestCactus.y - this.y;
          this.direction = Math.atan2(dy, dx);
          this.directionChangeTimer = 0;
        } else {
          // No cactus found - try to explore out of desert to find water
          const exitDirection = this.findDesertExitDirection(getBiomeAt);
          if (exitDirection !== null) {
            this.direction = exitDirection;
            this.directionChangeTimer = 0;
          } else {
            // Fallback: try normal water seeking
            const nearestWater = waterMap.findNearestWater(this.x, this.y, this.effectiveVision);
            if (nearestWater) {
              const dx = nearestWater.x - this.x;
              const dy = nearestWater.y - this.y;
              this.direction = Math.atan2(dy, dx);
              this.directionChangeTimer = 0;
            }
          }
        }
      } else {
        // Normal water seeking (not in desert)
        const nearestWater = waterMap.findNearestWater(this.x, this.y, this.effectiveVision);
        if (nearestWater) {
          // Move towards the water
          const dx = nearestWater.x - this.x;
          const dy = nearestWater.y - this.y;
          this.direction = Math.atan2(dy, dx);
          this.directionChangeTimer = 0;
        }
      }
                } else if (this.seekingMate && squibbleManager) {
                  // Seek a mate
                  const potentialMate = squibbleManager.findPotentialMate(this, waterMap);
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
        const nearestFood = foodManager.getNearestFood(this.x, this.y, this.effectiveVision);
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
    
    // Water state (before move): in-water, drowning, wet timer, evasion
    const inWater = waterMap?.isWaterAt(this.x, this.y) ?? false;
    
    // Drowning: chance per second = (1 - swim) * 0.02
    if (inWater && waterMap && Math.random() < (1 - this.swim) * 0.02 * dt) {
      this.deathCause = 'drowning';
      this.alive = false;
      return;
    }
    
    // Wet timer decays
    if (this.wetTimer > 0) {
      this.wetTimer = Math.max(0, this.wetTimer - dt);
    }
    
    // Move (unless breeding)
    // Pregnancy slows movement (down to 50% at full term)
    const pregnancySpeedPenalty = this.isPregnant ? (1 - pregnancyProgress * 0.5) : 1.0;
    let effectiveSpeed = this.speed * pregnancySpeedPenalty;
    
    // In water: swim stat determines speed (0.3 + 0.7*swim)
    if (inWater) {
      effectiveSpeed *= 0.3 + 0.7 * this.swim;
    }
    // Wet (after leaving water): 30% slower for 30 seconds
    if (this.wetTimer > 0) {
      effectiveSpeed *= 0.7;
    }
    // Forest: dense foliage reduces movement (20% slower)
    if (biome === Biome.FOREST) {
      effectiveSpeed *= 0.8;
    }
    // Tundra: cold, difficult terrain reduces movement (15% slower)
    if (biome === Biome.TUNDRA) {
      effectiveSpeed *= 0.85;
    }
    
    // Ensure we have a valid direction (safety check)
    if (isNaN(this.direction) || !isFinite(this.direction)) {
      this.direction = Math.random() * 2 * Math.PI;
    }
    
    if (!this.isBreeding && !this.isDrinking && !this.isEating) {
      // If we're in water, handle water crossing behavior
      if (inWater && waterMap) {
        if (this.waterCrossingTarget) {
          // We have a target - head towards it
          const dx = this.waterCrossingTarget.x - this.x;
          const dy = this.waterCrossingTarget.y - this.y;
          const distSq = dx * dx + dy * dy;
          
          // If we've reached the target (within 2 tiles), clear it
          const reachDistance = 128; // 2 tiles at default 64px tile size
          if (distSq < reachDistance * reachDistance) {
            this.waterCrossingTarget = null;
          } else {
            // Head towards the target
            this.direction = Math.atan2(dy, dx);
            this.directionChangeTimer = 0; // Reset direction change timer
          }
        } else {
          // We're in water but don't have a target yet - find one in our current direction
          const landTarget = waterMap.findLandInDirection(this.x, this.y, this.direction, 500);
          if (landTarget) {
            this.waterCrossingTarget = landTarget;
          }
        }
      }
      
      // Check if next step would enter water
      if (!inWater && waterMap) {
        const nextX = this.x + Math.cos(this.direction) * effectiveSpeed;
        const nextY = this.y + Math.sin(this.direction) * effectiveSpeed;
        const wouldEnterWater = waterMap.isWaterAt(nextX, nextY);
        
        if (wouldEnterWater) {
          // Check if we have an active target (food, water, or mate)
          const hasActiveTarget = (seekingFood && foodManager && foodManager.getNearestFood(this.x, this.y, this.effectiveVision)) ||
                                  (seekingWater && waterMap && waterMap.findNearestWater(this.x, this.y, this.effectiveVision)) ||
                                  (this.seekingMate && squibbleManager && squibbleManager.findPotentialMate(this, waterMap));
          
          if (hasActiveTarget) {
            // Willingness to cross water is based on swim stat
            // Swim stat (0-1) maps to 50-80% base chance, with higher swim = more willing
            // Formula: 0.5 + (swim * 0.3) gives 50-80% range
            const crossChance = 0.5 + (this.swim * 0.3);
            const willCross = Math.random() < crossChance;
            
            if (willCross) {
              // Find a land target on the other side of the water
              const landTarget = waterMap.findLandInDirection(this.x, this.y, this.direction, 500);
              if (landTarget) {
                this.waterCrossingTarget = landTarget;
              }
            } else {
              // Decided not to cross - try to avoid
              const alt = this.tryAvoidWaterDirection(this.x, this.y, this.direction, effectiveSpeed, waterMap);
              if (alt !== null) this.direction = alt;
            }
          } else {
            // No active target - still allow some chance to cross when wandering (20-50% based on swim)
            const wanderCrossChance = 0.2 + (this.swim * 0.3);
            const willCross = Math.random() < wanderCrossChance;
            
            if (willCross) {
              // Find a land target on the other side of the water
              const landTarget = waterMap.findLandInDirection(this.x, this.y, this.direction, 500);
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
  
  /**
   * Try to pick a direction that avoids stepping into water. Tries angles offset from dir.
   * Returns adjusted direction in radians, or null if all alternatives lead to water (must cross).
   */
  private tryAvoidWaterDirection(x: number, y: number, dir: number, stepSize: number, waterMap: WaterMap): number | null {
    // Try angles deflected from current; we only call when current dir would hit water
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
   * Find a direction that leads out of the desert biome
   * Samples multiple directions and picks one that leads to non-desert biomes
   */
  private findDesertExitDirection(getBiomeAt?: (x: number, y: number) => number): number | null {
    if (!getBiomeAt) return null;
    
    const sampleDistance = this.effectiveVision * 0.5; // Sample at half vision range
    const numSamples = 16; // Sample 16 directions around the circle
    const bestDirections: number[] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const angle = (i / numSamples) * 2 * Math.PI;
      const sampleX = this.x + Math.cos(angle) * sampleDistance;
      const sampleY = this.y + Math.sin(angle) * sampleDistance;
      const sampleBiome = getBiomeAt(sampleX, sampleY);
      
      // Prefer directions that lead to non-desert biomes (plains, forest, tundra, or water)
      if (sampleBiome !== Biome.DESERT && sampleBiome !== -1) {
        bestDirections.push(angle);
      }
    }
    
    // If we found good directions, pick one (prefer straight ahead if possible)
    if (bestDirections.length > 0) {
      // Try to find one close to current direction
      let bestDir = bestDirections[0];
      let bestDiff = Math.abs(this.direction - bestDir);
      if (bestDiff > Math.PI) bestDiff = 2 * Math.PI - bestDiff;
      
      for (const dir of bestDirections) {
        let diff = Math.abs(this.direction - dir);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestDir = dir;
        }
      }
      
      return bestDir;
    }
    
    // No good direction found - return null to fall back to normal water seeking
    return null;
  }
  
  getStats() {
    // Convert frame-based age to seconds (assuming ~60fps)
    const ageInSeconds = this.age / 60;
    const maxAgeInSeconds = this.maxAge / 60;
    
    return {
      id: this.id,
      hunger: this.hunger,
      thirst: this.thirst,
      health: this.health,
      max_health: this.maxHealth,
      health_percentage: (this.health / this.maxHealth) * 100,
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
      intelligence: this.intelligence,
      swim: this.swim,
      metabolism: this.metabolism,
      damage_resistance: this.damageResistance,
      aggressiveness: this.aggressiveness,
      damage: this.damage,
      accuracy: this.accuracy,
      awareness: this.awareness,
      wet_timer: this.wetTimer,
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
   * Start combat with a target (called by Gnawlin when it attacks)
   */
  startCombat(target: any): void {
    if (this.isInCombat) return; // Already in combat
    
    this.isInCombat = true;
    this.combatTarget = target;
    this.combatTurn = false; // Squibble goes second (Gnawlin attacks first)
    this.combatTimer = this.combatTurnDuration;
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
  performAttack(target: any): void {
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
        this.endCombat();
      }
    }
    // Miss - no damage dealt
  }
  
  /**
   * Find the nearest Gnawlin within vision range
   */
  private findNearestGnawlin(gnawlinManager: any): any | null {
    let nearestGnawlin: any | null = null;
    let nearestDistance = Infinity;

    for (const gnawlin of gnawlinManager.getAlive()) {
      const dx = gnawlin.x - this.x;
      const dy = gnawlin.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.effectiveVision && distance < nearestDistance) {
        nearestGnawlin = gnawlin;
        nearestDistance = distance;
      }
    }
    return nearestGnawlin;
  }

  /**
   * Flee from a predator
   */
  private fleeFrom(predator: any): void {
    const dx = predator.x - this.x;
    const dy = predator.y - this.y;
    // Move in the opposite direction
    this.direction = Math.atan2(dy, dx) + Math.PI;
    // Increase speed temporarily? (Future enhancement)
  }
  
  /**
   * Check if this squibble can mate with another
   * @param other The other squibble to check
   * @param allowInterruption If true, allows checking even if one is already breeding (for interruption logic)
   * @param waterMap Optional water map to check if squibbles are in water (breeding cannot occur in water)
   */
  canMateWith(other: Squibble, allowInterruption: boolean = false, waterMap?: WaterMap): boolean {
    // Both must be alive
    if (!this.alive || !other.alive) return false;
    
    // Must be opposite genders
    if (this.gender === other.gender) return false;
    
    // Both must be in fertile age (not too young or too old)
    if (!this.isInFertileAge() || !other.isInFertileAge()) return false;
    
    // Pregnant squibbles cannot breed
    if (this.isPregnant || other.isPregnant) return false;
    
    // Cannot breed in water - check if either squibble is in water
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
    // Track the mate before clearing the breeding partner
    // This ensures all successful breedings are recorded, even if no child is produced
    if (this.breedingPartner) {
      const partnerId = this.breedingPartner.id;
      // Add to this squibble's mate list
      if (!this.mateIds.includes(partnerId)) {
        this.mateIds.push(partnerId);
      }
      // Also add this squibble to the partner's mate list (reciprocal tracking)
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
      this.deathCause = 'childbirth';
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
