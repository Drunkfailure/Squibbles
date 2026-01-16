/**
 * SquibbleManager - Manages all squibbles in the simulation
 */

import { Squibble } from './Squibble';
import { FoodManager } from '../food/FoodManager';
import { WaterMap } from '../terrain/WaterMap';
import { Stats } from '../utils/types';

export class SquibbleManager {
  private squibbles: Squibble[] = [];
  private breedingDistance: number = 20; // Distance needed for breeding
  
  addSquibble(x: number, y: number, color?: [number, number, number], parent1?: Squibble, parent2?: Squibble): void {
    this.squibbles.push(new Squibble(x, y, color, parent1, parent2));
  }
  
  /**
   * Find a potential mate for a squibble
   */
  findPotentialMate(seeker: Squibble): Squibble | null {
    let nearestMate: Squibble | null = null;
    let nearestDistance = Infinity;
    
    for (const other of this.squibbles) {
      if (other === seeker || !other.alive) continue;
      if (!seeker.canMateWith(other)) continue;
      
      const dx = other.x - seeker.x;
      const dy = other.y - seeker.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Must be within vision range and closer than current best
      if (distance <= seeker.vision && distance < nearestDistance) {
        nearestMate = other;
        nearestDistance = distance;
      }
    }
    
    return nearestMate;
  }
  
  /**
   * Check for births (pregnant females ready to give birth)
   * Handles multiple births and potential mother death
   */
  private processPregnancies(): void {
    const newBabies: Squibble[] = [];
    
    for (const squibble of this.squibbles) {
      if (squibble.isReadyToGiveBirth()) {
        // giveBirth() now returns an array of babies (1-4)
        // May also kill the mother if childbirth risk is high
        const babies = squibble.giveBirth();
        newBabies.push(...babies);
      }
    }
    
    // Add all new babies
    for (const baby of newBabies) {
      this.squibbles.push(baby);
    }
  }
  
  /**
   * Check for breeding opportunities and start pregnancies
   */
  private processBreeding(): void {
    // First, check for completed breeding (10 seconds elapsed) - starts pregnancy
    for (const squibble of this.squibbles) {
      if (squibble.isBreeding && squibble.isBreedingComplete() && squibble.breedingPartner) {
        const partner = squibble.breedingPartner;
        
        // Determine which is female
        const female = squibble.gender === 'female' ? squibble : partner;
        const male = squibble.gender === 'male' ? squibble : partner;
        
        // Female becomes pregnant (baby comes later after gestation)
        if (female && male && !female.isPregnant) {
          female.startPregnancy(male);
        }
        
        // Complete breeding for both
        squibble.completeBreeding();
        partner.completeBreeding();
      }
    }
    
    // Second, check for new breeding pairs or interruptions
    for (let i = 0; i < this.squibbles.length; i++) {
      const squibble1 = this.squibbles[i];
      if (!squibble1.alive) continue;
      
      // If already breeding, check for interruptions (only for females)
      if (squibble1.isBreeding && squibble1.gender === 'female' && squibble1.breedingPartner) {
        // Check if other eligible males are nearby trying to interrupt
        const competingMales: Squibble[] = [];
        
        for (let j = 0; j < this.squibbles.length; j++) {
          if (i === j) continue;
          const other = this.squibbles[j];
          
          // Must be male, alive, seeking mate, and eligible
          if (!other.alive || other.gender !== 'male' || !other.seekingMate) continue;
          // Allow interruption check even if one is breeding
          if (!squibble1.canMateWith(other, true)) continue;
          
          // Check distance
          const dx = other.x - squibble1.x;
          const dy = other.y - squibble1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= this.breedingDistance * 1.5) { // Slightly larger radius for interruption
            competingMales.push(other);
          }
        }
        
        // If there are competing males, female chooses based on attractiveness
        if (competingMales.length > 0 && squibble1.breedingPartner) {
          const currentPartner = squibble1.breedingPartner;
          const allMales = [currentPartner, ...competingMales];
          
          // Female chooses the most attractive male
          let bestMale: Squibble | null = null;
          let bestAttractiveness = -1;
          
          for (const male of allMales) {
            if (male && male.alive && male.attractiveness > bestAttractiveness) {
              bestAttractiveness = male.attractiveness;
              bestMale = male;
            }
          }
          
          // If a different male is chosen, interrupt current breeding
          if (bestMale && bestMale !== currentPartner && bestMale.alive) {
            // Cancel current breeding
            squibble1.cancelBreeding();
            if (currentPartner && currentPartner.alive) {
              currentPartner.cancelBreeding();
            }
            
            // Start new breeding with chosen male
            squibble1.startBreeding(bestMale);
            bestMale.startBreeding(squibble1);
          }
        }
        continue;
      }
      
      // If not breeding, check for new breeding opportunities
      if (!squibble1.isBreeding && squibble1.seekingMate) {
        for (let j = i + 1; j < this.squibbles.length; j++) {
          const squibble2 = this.squibbles[j];
          if (!squibble2.alive || squibble2.isBreeding || !squibble2.seekingMate) continue;
          
          // Check if they can mate
          if (!squibble1.canMateWith(squibble2)) continue;
          
          // Check if they're close enough
          const dx = squibble2.x - squibble1.x;
          const dy = squibble2.y - squibble1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= this.breedingDistance) {
            // Start breeding (10 seconds)
            squibble1.startBreeding(squibble2);
            squibble2.startBreeding(squibble1);
            break; // Only one breeding attempt per squibble per cycle
          }
        }
      }
    }
  }
  
  updateAll(
    dt: number,
    screenWidth: number,
    screenHeight: number,
    foodManager?: FoodManager,
    waterMap?: WaterMap
  ): void {
    // Update all squibbles
    for (const squibble of this.squibbles) {
      squibble.update(dt, screenWidth, screenHeight, foodManager, waterMap, this);
    }
    
    // Process breeding
    this.processBreeding();
    
    // Process pregnancies (births)
    this.processPregnancies();
    
    // Remove dead squibbles
    this.squibbles = this.squibbles.filter(s => s.alive);
  }
  
  getAll(): Squibble[] {
    return this.squibbles;
  }
  
  getAlive(): Squibble[] {
    return this.squibbles.filter(s => s.alive);
  }
  
  getStats(): Stats {
    if (this.squibbles.length === 0) {
      return { count: 0, alive: 0 };
    }
    
    const aliveCount = this.squibbles.filter(s => s.alive).length;
    const avgHunger = this.squibbles.reduce((sum, s) => sum + s.hunger, 0) / this.squibbles.length;
    const avgThirst = this.squibbles.reduce((sum, s) => sum + s.thirst, 0) / this.squibbles.length;
    const avgHealth = this.squibbles.reduce((sum, s) => sum + s.health, 0) / this.squibbles.length;
    const avgSpeed = this.squibbles.reduce((sum, s) => sum + s.speed, 0) / this.squibbles.length;
    const seekingFoodCount = this.squibbles.filter(
      s => s.alive && s.hunger < 70.0
    ).length;
    const seekingMateCount = this.squibbles.filter(
      s => s.alive && s.seekingMate
    ).length;
    
    return {
      count: this.squibbles.length,
      alive: aliveCount,
      avg_hunger: avgHunger,
      avg_thirst: avgThirst,
      avg_health: avgHealth,
      avg_speed: avgSpeed,
      seeking_food_count: seekingFoodCount,
      seeking_mate_count: seekingMateCount,
    };
  }
  
  clear(): void {
    this.squibbles = [];
  }
}
