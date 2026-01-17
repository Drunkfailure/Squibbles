/**
 * Food - Individual food item with multi-stage consumption
 */

export type FoodSpecies = 'plainsshrub' | 'foresttree' | 'cactus' | 'tundratree';

export interface FoodConfig {
  maxSlots: number;
  regenDelay: number;
  hungerGain: number;
  thirstGain: number;
}

const SPECIES_CONFIG: Record<FoodSpecies, FoodConfig> = {
  plainsshrub: { maxSlots: 3, regenDelay: 5.0, hungerGain: 10.0, thirstGain: 0.0 }, // 3 slots, moderate hunger
  foresttree: { maxSlots: 4, regenDelay: 10.0, hungerGain: 15.0, thirstGain: 0.0 }, // 4 slots, moderate hunger
  cactus: { maxSlots: 3, regenDelay: 25.0, hungerGain: 8.0, thirstGain: 8.0 }, // 3 slots, slow regrowth, hunger+thirst only; does NOT restore health; can prick (intelligence reduces harm chance)
  tundratree: { maxSlots: 2, regenDelay: 10.0, hungerGain: 12.0, thirstGain: 0.0 }, // 2 slots, lichen; hunger scaled by metabolism in FoodManager (slow=more, fast=less)
};

export class Food {
  public x: number;
  public y: number;
  public species: FoodSpecies;
  public radius: number = 12;
  
  /** Visual scale (0.75–1.25) so vegetation isn’t uniform; used for sprite size. */
  public scale: number = 1.0;
  /** Flip horizontally for variation. */
  public flipH: boolean = false;
  
  // Slot-based consumption
  public maxSlots: number;
  public remainingSlots: number;
  
  public eaten: boolean = false;
  public eatenTime: number = 0;
  public lastRegenTime: number = 0;
  
  private regenDelay: number;
  public hungerGain: number;
  public thirstGain: number;
  
  constructor(x: number, y: number, species?: FoodSpecies, scale?: number, flipH?: boolean) {
    this.x = x;
    this.y = y;
    this.scale = scale ?? 1.0;
    this.flipH = flipH ?? Math.random() < 0.5;
    
    // Choose species
    const availableSpecies: FoodSpecies[] = ['plainsshrub', 'foresttree', 'cactus', 'tundratree'];
    this.species = species || availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
    
    // Apply species-specific config
    const config = SPECIES_CONFIG[this.species];
    this.maxSlots = config.maxSlots;
    this.remainingSlots = this.maxSlots; // Start with full slots
    this.regenDelay = config.regenDelay;
    this.hungerGain = config.hungerGain;
    this.thirstGain = config.thirstGain;
  }
  
  eat(currentTime: number): [number, number] | null {
    if (this.eaten || this.remainingSlots <= 0) {
      return null;
    }
    
    this.remainingSlots = Math.max(0, this.remainingSlots - 1);
    this.lastRegenTime = currentTime;
    
    if (this.remainingSlots === 0) {
      this.eaten = true;
      this.eatenTime = currentTime;
    }
    
    return [this.hungerGain, this.thirstGain];
  }
  
  respawn(currentTime: number): void {
    // Increase by one slot up to max
    this.remainingSlots = Math.min(this.maxSlots, this.remainingSlots + 1);
    this.eatenTime = 0;
    
    // If it now has at least one slot, it's no longer considered eaten
    if (this.remainingSlots > 0) {
      this.eaten = false;
    }
  }
  
  shouldRegen(currentTime: number): boolean {
    const lastTime = this.eaten ? this.eatenTime : this.lastRegenTime;
    return (currentTime - lastTime) >= this.regenDelay && this.remainingSlots < this.maxSlots;
  }
  
  isAvailable(): boolean {
    return !this.eaten && this.remainingSlots > 0;
  }
}
