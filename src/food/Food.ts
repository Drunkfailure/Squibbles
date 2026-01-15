/**
 * Food - Individual food item with multi-stage consumption
 */

export type FoodSpecies = 'plainsshrub' | 'foresttree' | 'cactus' | 'tundrabush';

export interface FoodConfig {
  regenDelay: number;
  hungerGain: number;
  thirstGain: number;
}

const SPECIES_CONFIG: Record<FoodSpecies, FoodConfig> = {
  plainsshrub: { regenDelay: 5.0, hungerGain: 10.0, thirstGain: 0.0 },
  foresttree: { regenDelay: 10.0, hungerGain: 20.0, thirstGain: 0.0 },
  cactus: { regenDelay: 20.0, hungerGain: 8.0, thirstGain: 8.0 },
  tundrabush: { regenDelay: 10.0, hungerGain: 15.0, thirstGain: 0.0 },
};

export class Food {
  public x: number;
  public y: number;
  public species: FoodSpecies;
  public radius: number = 12;
  
  // Slot-based consumption
  private maxSlots: number = 3;
  public remainingSlots: number;
  
  public eaten: boolean = false;
  private eatenTime: number = 0;
  public lastRegenTime: number = 0;
  
  private regenDelay: number = 12.0;
  public hungerGain: number = 15.0;
  public thirstGain: number = 0.0;
  
  constructor(x: number, y: number, species?: FoodSpecies) {
    this.x = x;
    this.y = y;
    
    // Choose species
    const availableSpecies: FoodSpecies[] = ['plainsshrub', 'foresttree', 'cactus', 'tundrabush'];
    this.species = species || availableSpecies[Math.floor(Math.random() * availableSpecies.length)];
    
    this.remainingSlots = this.maxSlots;
    
    // Apply species-specific config
    const config = SPECIES_CONFIG[this.species];
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
