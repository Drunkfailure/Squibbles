/**
 * Genetics System for Squibbles
 * 
 * Supports two genetic models:
 * - Model B: Multi-Allele + Dominance Ranking (for visual traits like horns, eyes, patterns)
 * - Model C: Polygenic Traits (for continuous stats like speed, vision, attractiveness)
 */

// ============================================
// MUTATION CONFIGURATION
// ============================================

export interface MutationConfig {
  /** Probability of mutation per allele (0-1) */
  mutationRate: number;
  /** Maximum change for polygenic loci mutations */
  polygenicMutationMagnitude: number;
  /** Probability of allele jumping to adjacent variant for multi-allele */
  alleleMutationRate: number;
}

export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
  mutationRate: 0.05,           // 5% chance per allele
  polygenicMutationMagnitude: 1, // ±1 for loci values
  alleleMutationRate: 0.02,     // 2% chance for multi-allele mutation
};

// ============================================
// MODEL B: MULTI-ALLELE TRAITS
// ============================================

/**
 * Definition of a multi-allele trait (for visual characteristics)
 * Alleles are ordered by dominance (index 0 = most recessive)
 */
export interface MultiAlleleTrait {
  name: string;
  alleles: string[];  // Ordered by dominance rank (0 = recessive, higher = dominant)
}

/**
 * Genotype for a multi-allele trait (two alleles, one from each parent)
 */
export interface MultiAlleleGenotype {
  allele1: number;  // Index into alleles array
  allele2: number;  // Index into alleles array
}

/**
 * Pre-defined multi-allele traits for future graphical update
 */
export const MULTI_ALLELE_TRAITS: Record<string, MultiAlleleTrait> = {
  hornStyle: {
    name: 'Horn Style',
    alleles: ['none', 'small', 'curved', 'ram', 'spiked', 'antler'],
    // Dominance: antler > spiked > ram > curved > small > none
  },
  eyeType: {
    name: 'Eye Type',
    alleles: ['beady', 'round', 'almond', 'wide', 'sleepy'],
  },
  earType: {
    name: 'Ear Type',
    alleles: ['none', 'small', 'pointed', 'floppy', 'large'],
  },
  tailType: {
    name: 'Tail Type',
    alleles: ['none', 'stub', 'short', 'medium', 'long', 'fluffy'],
  },
  patternType: {
    name: 'Pattern Type',
    alleles: ['solid', 'spotted', 'striped', 'patched', 'gradient'],
  },
  bodyShape: {
    name: 'Body Shape',
    alleles: ['round', 'oval', 'elongated', 'stocky'],
  },
};

/**
 * Get the expressed phenotype from a multi-allele genotype
 * The more dominant allele (higher index) is expressed
 */
export function getMultiAllelePhenotype(
  trait: MultiAlleleTrait,
  genotype: MultiAlleleGenotype
): string {
  const dominantIndex = Math.max(genotype.allele1, genotype.allele2);
  return trait.alleles[dominantIndex];
}

/**
 * Inherit a multi-allele trait from two parents
 */
export function inheritMultiAllele(
  parent1Genotype: MultiAlleleGenotype,
  parent2Genotype: MultiAlleleGenotype,
  trait: MultiAlleleTrait,
  mutationConfig: MutationConfig = DEFAULT_MUTATION_CONFIG
): MultiAlleleGenotype {
  // Each parent contributes one random allele
  const fromParent1 = Math.random() < 0.5 ? parent1Genotype.allele1 : parent1Genotype.allele2;
  const fromParent2 = Math.random() < 0.5 ? parent2Genotype.allele1 : parent2Genotype.allele2;
  
  // Apply mutations
  const allele1 = mutateMultiAllele(fromParent1, trait.alleles.length, mutationConfig);
  const allele2 = mutateMultiAllele(fromParent2, trait.alleles.length, mutationConfig);
  
  return { allele1, allele2 };
}

/**
 * Apply mutation to a multi-allele (can shift to adjacent allele)
 */
function mutateMultiAllele(
  allele: number,
  maxAlleles: number,
  config: MutationConfig
): number {
  if (Math.random() < config.alleleMutationRate) {
    // Mutate to adjacent allele (up or down)
    const direction = Math.random() < 0.5 ? -1 : 1;
    return Math.max(0, Math.min(maxAlleles - 1, allele + direction));
  }
  return allele;
}

/**
 * Generate random multi-allele genotype
 */
export function randomMultiAlleleGenotype(trait: MultiAlleleTrait): MultiAlleleGenotype {
  const maxIndex = trait.alleles.length - 1;
  return {
    allele1: Math.floor(Math.random() * (maxIndex + 1)),
    allele2: Math.floor(Math.random() * (maxIndex + 1)),
  };
}

// ============================================
// MODEL C: POLYGENIC TRAITS
// ============================================

/**
 * Definition of a polygenic trait
 */
export interface PolygenicTrait {
  name: string;
  lociCount: number;      // Number of loci (genes) controlling this trait
  lociRange: [number, number]; // Min/max value per locus allele
  baseValue: number;      // Base value before loci contributions
  outputRange: [number, number]; // Final clamped output range
}

/**
 * Genotype for a polygenic trait
 * Each locus has two alleles (one from each parent)
 */
export interface PolygenicGenotype {
  loci: Array<[number, number]>; // Array of [allele1, allele2] for each locus
}

/**
 * Pre-defined polygenic traits
 */
export const POLYGENIC_TRAITS: Record<string, PolygenicTrait> = {
  speed: {
    name: 'Speed',
    lociCount: 6,
    lociRange: [-2, 2],
    baseValue: 2.0,
    outputRange: [0.5, 4.0],
  },
  vision: {
    name: 'Vision',
    lociCount: 6,
    lociRange: [-10, 10],
    baseValue: 100,
    outputRange: [30, 200],
  },
  size: {
    name: 'Size',
    lociCount: 5,
    lociRange: [-0.05, 0.05],
    baseValue: 1.0,
    outputRange: [0.6, 1.4],
  },
  attractiveness: {
    name: 'Attractiveness',
    lociCount: 4,
    lociRange: [-0.1, 0.1],
    baseValue: 0.5,
    outputRange: [0, 1],
  },
  virility: {
    name: 'Virility',
    lociCount: 4,
    lociRange: [-0.1, 0.1],
    baseValue: 0.5,
    outputRange: [0, 1],
  },
  maxAge: {
    name: 'Max Age',
    lociCount: 6,
    lociRange: [-600, 600], // ~10 seconds per locus contribution
    baseValue: 14400,       // 4 minutes base (in frames at 60fps)
    outputRange: [10800, 18000], // 3-5 minutes
  },
  hungerCapacity: {
    name: 'Hunger Capacity',
    lociCount: 4,
    lociRange: [-5, 5],
    baseValue: 100,
    outputRange: [70, 130],
  },
  thirstCapacity: {
    name: 'Thirst Capacity',
    lociCount: 4,
    lociRange: [-5, 5],
    baseValue: 100,
    outputRange: [70, 130],
  },
  litterSize: {
    name: 'Litter Size',
    lociCount: 5,
    lociRange: [-0.3, 0.3],
    baseValue: 2.0, // Average 2 babies
    outputRange: [1.0, 4.0], // Range 1-4 babies on average
  },
  gestationDuration: {
    name: 'Gestation Duration',
    lociCount: 4,
    lociRange: [-2, 2], // Seconds per locus
    baseValue: 25.0, // 25 seconds base
    outputRange: [15.0, 35.0], // 15-35 seconds
  },
  intelligence: {
    name: 'Intelligence',
    lociCount: 5,
    lociRange: [-0.08, 0.08],
    baseValue: 0.5,
    outputRange: [0, 1], // 0 = dim, 1 = clever; affects cactus prick chance
  },
  swim: {
    name: 'Swim',
    lociCount: 4,
    lociRange: [-0.1, 0.1],
    baseValue: 0.5,
    outputRange: [0, 1], // 0 = poor, 1 = strong; affects speed in water and drowning chance
  },
  metabolism: {
    name: 'Metabolism',
    lociCount: 5,
    lociRange: [-0.08, 0.08],
    baseValue: 0.5,
    outputRange: [0, 1], // 0 = slow (less drain, more from lichen), 1 = fast (more drain, less from lichen)
  },
};

/**
 * Calculate the expressed phenotype value from a polygenic genotype
 */
export function getPolygenicPhenotype(
  trait: PolygenicTrait,
  genotype: PolygenicGenotype
): number {
  // Sum all allele contributions
  let totalContribution = 0;
  for (const [allele1, allele2] of genotype.loci) {
    totalContribution += allele1 + allele2;
  }
  
  // Apply to base value and clamp
  const rawValue = trait.baseValue + totalContribution;
  return Math.max(trait.outputRange[0], Math.min(trait.outputRange[1], rawValue));
}

/**
 * Inherit a polygenic trait from two parents
 */
export function inheritPolygenic(
  parent1Genotype: PolygenicGenotype,
  parent2Genotype: PolygenicGenotype,
  trait: PolygenicTrait,
  mutationConfig: MutationConfig = DEFAULT_MUTATION_CONFIG
): PolygenicGenotype {
  const loci: Array<[number, number]> = [];
  
  for (let i = 0; i < trait.lociCount; i++) {
    // Each parent contributes one allele per locus
    const fromParent1 = Math.random() < 0.5 
      ? parent1Genotype.loci[i][0] 
      : parent1Genotype.loci[i][1];
    const fromParent2 = Math.random() < 0.5 
      ? parent2Genotype.loci[i][0] 
      : parent2Genotype.loci[i][1];
    
    // Apply mutations
    const allele1 = mutatePolygenicAllele(fromParent1, trait.lociRange, mutationConfig);
    const allele2 = mutatePolygenicAllele(fromParent2, trait.lociRange, mutationConfig);
    
    loci.push([allele1, allele2]);
  }
  
  return { loci };
}

/**
 * Apply mutation to a polygenic allele
 */
function mutatePolygenicAllele(
  allele: number,
  range: [number, number],
  config: MutationConfig
): number {
  if (Math.random() < config.mutationRate) {
    // Add or subtract mutation magnitude
    const mutation = (Math.random() - 0.5) * 2 * config.polygenicMutationMagnitude;
    const mutated = allele + mutation;
    return Math.max(range[0], Math.min(range[1], mutated));
  }
  return allele;
}

/**
 * Generate random polygenic genotype
 */
export function randomPolygenicGenotype(trait: PolygenicTrait): PolygenicGenotype {
  const loci: Array<[number, number]> = [];
  
  for (let i = 0; i < trait.lociCount; i++) {
    const [min, max] = trait.lociRange;
    const allele1 = min + Math.random() * (max - min);
    const allele2 = min + Math.random() * (max - min);
    loci.push([allele1, allele2]);
  }
  
  return { loci };
}

// ============================================
// COMPLETE GENOME
// ============================================

/**
 * Complete genome containing all genetic information for a Squibble
 */
export interface Genome {
  // Polygenic traits (continuous values)
  polygenic: {
    speed: PolygenicGenotype;
    vision: PolygenicGenotype;
    size: PolygenicGenotype;
    attractiveness: PolygenicGenotype;
    virility: PolygenicGenotype;
    maxAge: PolygenicGenotype;
    hungerCapacity: PolygenicGenotype;
    thirstCapacity: PolygenicGenotype;
    litterSize: PolygenicGenotype;
    gestationDuration: PolygenicGenotype;
    intelligence: PolygenicGenotype;
    swim: PolygenicGenotype;
    metabolism: PolygenicGenotype;
  };
  
  // Multi-allele traits (discrete visual characteristics)
  multiAllele: {
    hornStyle: MultiAlleleGenotype;
    eyeType: MultiAlleleGenotype;
    earType: MultiAlleleGenotype;
    tailType: MultiAlleleGenotype;
    patternType: MultiAlleleGenotype;
    bodyShape: MultiAlleleGenotype;
  };
  
  // Color genes (special polygenic for RGB)
  colorGenes: {
    red: PolygenicGenotype;
    green: PolygenicGenotype;
    blue: PolygenicGenotype;
  };
}

/**
 * Color polygenic trait definition
 */
const COLOR_TRAIT: PolygenicTrait = {
  name: 'Color Channel',
  lociCount: 4,
  lociRange: [-20, 20],
  baseValue: 128,
  outputRange: [30, 225],
};

/**
 * Generate a random genome for a new squibble
 */
export function generateRandomGenome(): Genome {
  return {
    polygenic: {
      speed: randomPolygenicGenotype(POLYGENIC_TRAITS.speed),
      vision: randomPolygenicGenotype(POLYGENIC_TRAITS.vision),
      size: randomPolygenicGenotype(POLYGENIC_TRAITS.size),
      attractiveness: randomPolygenicGenotype(POLYGENIC_TRAITS.attractiveness),
      virility: randomPolygenicGenotype(POLYGENIC_TRAITS.virility),
      maxAge: randomPolygenicGenotype(POLYGENIC_TRAITS.maxAge),
      hungerCapacity: randomPolygenicGenotype(POLYGENIC_TRAITS.hungerCapacity),
      thirstCapacity: randomPolygenicGenotype(POLYGENIC_TRAITS.thirstCapacity),
      litterSize: randomPolygenicGenotype(POLYGENIC_TRAITS.litterSize),
      gestationDuration: randomPolygenicGenotype(POLYGENIC_TRAITS.gestationDuration),
      intelligence: randomPolygenicGenotype(POLYGENIC_TRAITS.intelligence),
      swim: randomPolygenicGenotype(POLYGENIC_TRAITS.swim),
      metabolism: randomPolygenicGenotype(POLYGENIC_TRAITS.metabolism),
    },
    multiAllele: {
      hornStyle: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.hornStyle),
      eyeType: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.eyeType),
      earType: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.earType),
      tailType: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.tailType),
      patternType: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.patternType),
      bodyShape: randomMultiAlleleGenotype(MULTI_ALLELE_TRAITS.bodyShape),
    },
    colorGenes: {
      red: randomPolygenicGenotype(COLOR_TRAIT),
      green: randomPolygenicGenotype(COLOR_TRAIT),
      blue: randomPolygenicGenotype(COLOR_TRAIT),
    },
  };
}

/**
 * Inherit a genome from two parent genomes
 */
export function inheritGenome(
  parent1: Genome,
  parent2: Genome,
  mutationConfig: MutationConfig = DEFAULT_MUTATION_CONFIG
): Genome {
  return {
    polygenic: {
      speed: inheritPolygenic(parent1.polygenic.speed, parent2.polygenic.speed, POLYGENIC_TRAITS.speed, mutationConfig),
      vision: inheritPolygenic(parent1.polygenic.vision, parent2.polygenic.vision, POLYGENIC_TRAITS.vision, mutationConfig),
      size: inheritPolygenic(parent1.polygenic.size, parent2.polygenic.size, POLYGENIC_TRAITS.size, mutationConfig),
      attractiveness: inheritPolygenic(parent1.polygenic.attractiveness, parent2.polygenic.attractiveness, POLYGENIC_TRAITS.attractiveness, mutationConfig),
      virility: inheritPolygenic(parent1.polygenic.virility, parent2.polygenic.virility, POLYGENIC_TRAITS.virility, mutationConfig),
      maxAge: inheritPolygenic(parent1.polygenic.maxAge, parent2.polygenic.maxAge, POLYGENIC_TRAITS.maxAge, mutationConfig),
      hungerCapacity: inheritPolygenic(parent1.polygenic.hungerCapacity, parent2.polygenic.hungerCapacity, POLYGENIC_TRAITS.hungerCapacity, mutationConfig),
      thirstCapacity: inheritPolygenic(parent1.polygenic.thirstCapacity, parent2.polygenic.thirstCapacity, POLYGENIC_TRAITS.thirstCapacity, mutationConfig),
      litterSize: inheritPolygenic(parent1.polygenic.litterSize, parent2.polygenic.litterSize, POLYGENIC_TRAITS.litterSize, mutationConfig),
      gestationDuration: inheritPolygenic(parent1.polygenic.gestationDuration, parent2.polygenic.gestationDuration, POLYGENIC_TRAITS.gestationDuration, mutationConfig),
      intelligence: inheritPolygenic(parent1.polygenic.intelligence, parent2.polygenic.intelligence, POLYGENIC_TRAITS.intelligence, mutationConfig),
      swim: inheritPolygenic(parent1.polygenic.swim, parent2.polygenic.swim, POLYGENIC_TRAITS.swim, mutationConfig),
      metabolism: inheritPolygenic(parent1.polygenic.metabolism, parent2.polygenic.metabolism, POLYGENIC_TRAITS.metabolism, mutationConfig),
    },
    multiAllele: {
      hornStyle: inheritMultiAllele(parent1.multiAllele.hornStyle, parent2.multiAllele.hornStyle, MULTI_ALLELE_TRAITS.hornStyle, mutationConfig),
      eyeType: inheritMultiAllele(parent1.multiAllele.eyeType, parent2.multiAllele.eyeType, MULTI_ALLELE_TRAITS.eyeType, mutationConfig),
      earType: inheritMultiAllele(parent1.multiAllele.earType, parent2.multiAllele.earType, MULTI_ALLELE_TRAITS.earType, mutationConfig),
      tailType: inheritMultiAllele(parent1.multiAllele.tailType, parent2.multiAllele.tailType, MULTI_ALLELE_TRAITS.tailType, mutationConfig),
      patternType: inheritMultiAllele(parent1.multiAllele.patternType, parent2.multiAllele.patternType, MULTI_ALLELE_TRAITS.patternType, mutationConfig),
      bodyShape: inheritMultiAllele(parent1.multiAllele.bodyShape, parent2.multiAllele.bodyShape, MULTI_ALLELE_TRAITS.bodyShape, mutationConfig),
    },
    colorGenes: {
      red: inheritPolygenic(parent1.colorGenes.red, parent2.colorGenes.red, COLOR_TRAIT, mutationConfig),
      green: inheritPolygenic(parent1.colorGenes.green, parent2.colorGenes.green, COLOR_TRAIT, mutationConfig),
      blue: inheritPolygenic(parent1.colorGenes.blue, parent2.colorGenes.blue, COLOR_TRAIT, mutationConfig),
    },
  };
}

/**
 * Express all phenotypes from a genome
 */
export interface ExpressedPhenotypes {
  // Continuous traits
  speed: number;
  vision: number;
  size: number;
  attractiveness: number;
  virility: number;
  maxAge: number;
  hungerCapacity: number;
  thirstCapacity: number;
  litterSize: number;
  gestationDuration: number;
  intelligence: number;
  swim: number;
  metabolism: number;
  
  // Visual traits (strings)
  hornStyle: string;
  eyeType: string;
  earType: string;
  tailType: string;
  patternType: string;
  bodyShape: string;
  
  // Color
  color: [number, number, number];
}

/**
 * Express all phenotypes from a genome
 */
export function expressGenome(genome: Genome): ExpressedPhenotypes {
  return {
    speed: getPolygenicPhenotype(POLYGENIC_TRAITS.speed, genome.polygenic.speed),
    vision: getPolygenicPhenotype(POLYGENIC_TRAITS.vision, genome.polygenic.vision),
    size: getPolygenicPhenotype(POLYGENIC_TRAITS.size, genome.polygenic.size),
    attractiveness: getPolygenicPhenotype(POLYGENIC_TRAITS.attractiveness, genome.polygenic.attractiveness),
    virility: getPolygenicPhenotype(POLYGENIC_TRAITS.virility, genome.polygenic.virility),
    maxAge: Math.round(getPolygenicPhenotype(POLYGENIC_TRAITS.maxAge, genome.polygenic.maxAge)),
    hungerCapacity: getPolygenicPhenotype(POLYGENIC_TRAITS.hungerCapacity, genome.polygenic.hungerCapacity),
    thirstCapacity: getPolygenicPhenotype(POLYGENIC_TRAITS.thirstCapacity, genome.polygenic.thirstCapacity),
    litterSize: getPolygenicPhenotype(POLYGENIC_TRAITS.litterSize, genome.polygenic.litterSize),
    gestationDuration: getPolygenicPhenotype(POLYGENIC_TRAITS.gestationDuration, genome.polygenic.gestationDuration),
    intelligence: getPolygenicPhenotype(POLYGENIC_TRAITS.intelligence, genome.polygenic.intelligence),
    swim: getPolygenicPhenotype(POLYGENIC_TRAITS.swim, genome.polygenic.swim),
    metabolism: getPolygenicPhenotype(POLYGENIC_TRAITS.metabolism, genome.polygenic.metabolism),
    
    hornStyle: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.hornStyle, genome.multiAllele.hornStyle),
    eyeType: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.eyeType, genome.multiAllele.eyeType),
    earType: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.earType, genome.multiAllele.earType),
    tailType: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.tailType, genome.multiAllele.tailType),
    patternType: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.patternType, genome.multiAllele.patternType),
    bodyShape: getMultiAllelePhenotype(MULTI_ALLELE_TRAITS.bodyShape, genome.multiAllele.bodyShape),
    
    color: [
      Math.round(getPolygenicPhenotype(COLOR_TRAIT, genome.colorGenes.red)),
      Math.round(getPolygenicPhenotype(COLOR_TRAIT, genome.colorGenes.green)),
      Math.round(getPolygenicPhenotype(COLOR_TRAIT, genome.colorGenes.blue)),
    ],
  };
}
