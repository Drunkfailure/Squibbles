/**
 * GnawlinManager - Manages all gnawlins in the simulation
 */

import { Gnawlin } from './Gnawlin';
import { WaterMap } from '../terrain/WaterMap';
import { SquibbleManager } from './SquibbleManager';

export class GnawlinManager {
  private gnawlins: Gnawlin[] = [];
  private breedingDistance: number = 20; // Distance needed for breeding
  
  addGnawlin(x: number, y: number, color?: [number, number, number], parent1?: Gnawlin, parent2?: Gnawlin): void {
    this.gnawlins.push(new Gnawlin(x, y, color, parent1, parent2));
  }
  
  /**
   * Find a potential mate for a gnawlin
   */
  findPotentialMate(seeker: Gnawlin, waterMap?: WaterMap): Gnawlin | null {
    let nearestMate: Gnawlin | null = null;
    let nearestDistance = Infinity;
    
    for (const other of this.gnawlins) {
      if (other === seeker || !other.alive) continue;
      if (!seeker.canMateWith(other, false, waterMap)) continue;
      
      const dx = other.x - seeker.x;
      const dy = other.y - seeker.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Must be within vision range and closer than current best (effectiveVision includes forest penalty)
      if (distance <= (seeker.effectiveVision ?? seeker.vision) && distance < nearestDistance) {
        nearestMate = other;
        nearestDistance = distance;
      }
    }
    
    return nearestMate;
  }
  
  /**
   * Get a gnawlin by ID
   */
  getGnawlinById(id: number): Gnawlin | null {
    return this.gnawlins.find(g => g.id === id) || null;
  }
  
  /**
   * Check for births (pregnant females ready to give birth)
   * Handles potential mother death
   */
  private processPregnancies(): void {
    const newBabies: Gnawlin[] = [];
    
    for (const gnawlin of this.gnawlins) {
      if (gnawlin.isReadyToGiveBirth()) {
        // giveBirth() returns an array of babies (always 1 for gnawlins)
        // May also kill the mother if childbirth risk is high (though risk is 0 for single births)
        const babies = gnawlin.giveBirth(this);
        newBabies.push(...babies);
      }
    }
    
    // Add all new babies
    for (const baby of newBabies) {
      this.gnawlins.push(baby);
    }
  }
  
  /**
   * Check for breeding opportunities and start pregnancies
   */
  private processBreeding(waterMap?: WaterMap): void {
    // First, check for completed breeding (10 seconds elapsed) - starts pregnancy
    for (const gnawlin of this.gnawlins) {
      if (gnawlin.isBreeding && gnawlin.isBreedingComplete() && gnawlin.breedingPartner) {
        const partner = gnawlin.breedingPartner;
        
        // Determine which is female
        const female = gnawlin.gender === 'female' ? gnawlin : partner;
        const male = gnawlin.gender === 'male' ? gnawlin : partner;
        
        // Female becomes pregnant (baby comes later after gestation)
        if (female && male && !female.isPregnant) {
          female.startPregnancy(male);
        }
        
        // Complete breeding for both (this will track mates in completeBreeding())
        gnawlin.completeBreeding();
        partner.completeBreeding();
      }
    }
    
    // Second, check for new breeding pairs
    for (let i = 0; i < this.gnawlins.length; i++) {
      const gnawlin1 = this.gnawlins[i];
      if (!gnawlin1.alive) continue;
      
      // If not breeding, check for new breeding opportunities
      if (!gnawlin1.isBreeding && gnawlin1.seekingMate) {
        for (let j = i + 1; j < this.gnawlins.length; j++) {
          const gnawlin2 = this.gnawlins[j];
          if (!gnawlin2.alive || gnawlin2.isBreeding || !gnawlin2.seekingMate) continue;
          
          // Check if they can mate (gnawlins don't check attractiveness, just eligibility)
          if (!gnawlin1.canMateWith(gnawlin2, false, waterMap)) continue;
          
          // Check if they're close enough
          const dx = gnawlin2.x - gnawlin1.x;
          const dy = gnawlin2.y - gnawlin1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= this.breedingDistance) {
            // Start breeding (10 seconds)
            gnawlin1.startBreeding(gnawlin2);
            gnawlin2.startBreeding(gnawlin1);
            break; // Only one breeding attempt per gnawlin per cycle
          }
        }
      }
    }
  }
  
  updateAll(
    dt: number,
    screenWidth: number,
    screenHeight: number,
    squibbleManager?: SquibbleManager, // For finding prey (Squibbles)
    waterMap?: WaterMap,
    getBiomeAt?: (x: number, y: number) => number
  ): void {
    // Update all gnawlins
    for (const gnawlin of this.gnawlins) {
      gnawlin.update(dt, screenWidth, screenHeight, squibbleManager, waterMap, this, getBiomeAt);
    }
    
    // Process breeding
    this.processBreeding(waterMap);
    
    // Process pregnancies (births)
    this.processPregnancies();
    
    // Remove dead gnawlins
    this.gnawlins = this.gnawlins.filter(g => g.alive);
  }
  
  getAll(): Gnawlin[] {
    return this.gnawlins;
  }
  
  getAlive(): Gnawlin[] {
    return this.gnawlins.filter(g => g.alive);
  }
  
  getStats(): { count: number; alive: number } {
    if (this.gnawlins.length === 0) {
      return { count: 0, alive: 0 };
    }
    
    const aliveCount = this.gnawlins.filter(g => g.alive).length;
    
    return {
      count: this.gnawlins.length,
      alive: aliveCount,
    };
  }
  
  clear(): void {
    this.gnawlins = [];
  }
}
