# Squibbles - Evolution Simulation

A real-time creature simulation where Squibbles navigate a procedurally generated world, seeking food and water to survive, breed, and evolve through genetic inheritance.

## TypeScript Version

This project has been fully rewritten from Python/Pygame to TypeScript for web deployment as of version v0.8.

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

### Project Structure

```
src/
  ├── main.ts              # Entry point
  ├── core/                # Core game systems
  ├── creatures/           # Squibble simulation
  ├── food/                # Food system
  ├── terrain/             # Terrain generation (WFC)
  ├── ui/                  # User interface
  ├── genetics/            # Genetic inheritance system
  ├── stats/               # Statistics tracking and graphing
  └── utils/               # Utilities
```

## Features

### Core Systems

- **Real-time creature AI** with hunger/thirst/health stats
- **Wave Function Collapse (WFC) terrain generation** - Procedurally generates organic, natural-looking biomes
- **Multi-biome world** - Plains, Forest, Desert, Tundra, and Water
- **Biome-specific food spawning** - Each biome has unique food sources
- **Water system** with drinking mechanics, swimming, and drowning
- **Camera system** with zoom, pan, and automatic following
- **Title screen** with customizable settings
- **Loading screen** with real-time progress tracking
- **Statistics tracking** with live-updating graphs

### World Generation

The world is generated using **Wave Function Collapse (WFC)**, an algorithm that creates organic, natural-looking terrain:

- **Biome Distribution**: 
  - Tundra and Desert biomes start with protected cores and expand outward
  - Forest and Plains biomes can break up the edges of Tundra/Desert
  - Water is integrated as a biome type with natural clustering
- **Tile-based System**: Default 64x64 pixel tiles for larger, more natural terrain
- **Organic Patterns**: WFC ensures biomes flow naturally into each other

### Food System

**Biome-Specific Food Sources**:
- **Forest**: Forest trees (4 food slots, moderate hunger restoration)
  - 50% chance of decorative trees (non-food)
  - 9% chance of food trees
- **Plains**: Plains shrubs (3 food slots, moderate hunger restoration)
  - 10% spawn chance
- **Desert**: Cacti (3 food slots, restores hunger and thirst)
  - 10% spawn chance
  - Can cause damage when eaten (intelligence reduces harm chance)
  - Does NOT restore health
- **Tundra**: Tundra trees with lichen (2 food slots)
  - 6% spawn chance
  - Hunger restoration scales with metabolism (slow metabolism = more hunger gain)

**Food Mechanics**:
- Food regenerates over time after being consumed
- Each food source has multiple "slots" that can be eaten before regeneration
- Visual sprites show food state (empty to full)
- Food sprites have size variation and horizontal flipping for visual diversity
- Y-sorting ensures squibbles can walk "behind" trees and food

### Breeding & Genetics

#### Gender & Mating
- **Gender System**: Male and female squibbles with gender-based breeding
- **Breeding Requirements**: Squibbles seek mates when:
  - Health ≥ 60%
  - Hunger ≥ 65%
  - Thirst ≥ 65%
  - Breeding cooldown expired
  - In fertile age window (not too young or too old)
  - Not already breeding or pregnant

#### Breeding Mechanics
- **10-second breeding duration** with visual love icon
- **Interruption system** - Other eligible males can compete during breeding
- **Female choice** - Females select the most attractive male when multiple compete
- **Breeding cooldowns** to prevent spam
- **Attractiveness System**: 
  - Each squibble has attractiveness (0-1) and minAttractiveness threshold
  - Breeding only occurs if both partners find each other attractive enough
- **Virility Trait**: Affects breeding success probability

#### Pregnancy & Reproduction
- **Gestation Period**: Variable duration (15-35 seconds, genetically determined)
  - Never longer than remaining lifespan
  - Pregnant squibbles cannot breed
- **Pregnancy Effects**:
  - Increased hunger/thirst drain
  - Slower movement (down to 50% speed at full term)
  - Visual fetus icon displayed
- **Litter Size**: Genetically determined (1-4 babies on average)
- **Childbirth Risk**: Mothers can die during childbirth
  - Risk increases with litter size
  - Risk increases with each multi-baby pregnancy
- **Fertility Window**: Squibbles cannot breed during first and last 1/5 of their life

#### Genetic Inheritance

**Polygenic Traits** (Continuous, smooth variation):
- **Speed** - Movement speed
- **Vision** - Detection range for food/water/mates
- **Size** - Adult body size (0.7-1.3x multiplier)
  - Females tend to be smaller, males larger
- **Attractiveness** - Mating appeal (0-1)
- **Virility** - Breeding success probability (0-1)
- **Max Age** - Lifespan in frames (3-5 minutes for initial squibbles)
- **Hunger/Thirst Capacity** - Maximum hunger and thirst values
- **Litter Size** - Average number of offspring (1-4)
- **Gestation Duration** - Pregnancy length (15-35 seconds)
- **Intelligence** - Reduces cactus prick damage chance (0-1)
- **Swim** - Swimming efficiency and water crossing willingness (0-1)
- **Metabolism** - Hunger/thirst drain rate (0-1)
  - Affects lichen (tundra food) hunger gain (slow = more gain)

**Multi-Allele Traits** (Discrete, dominance-based):
- Physical characteristics for future graphical updates
- Horn style, eye type, ear type, tail type, pattern type, body shape

**Color Inheritance**:
- Offspring inherit color from both parents with variation

**Genetic Mutation**:
- Random mutations can occur during inheritance
- Configurable mutation rates

### Age & Lifespan

- **Heritable Max Age**: Each squibble has a genetically determined maximum age
- **Death from Age**: Squibbles die when they reach their max age
- **Age Display**: Shown in seconds in the stats panel
- **Initial Lifespan**: Starting squibbles have 3-5 minute lifespans
- **Baby Growth**: 
  - Babies start smaller (radius 4) and grow to adult size over first 1/5 of life
  - Initial simulation squibbles start at beginning of adulthood

### Water Mechanics

- **Water Detection**: Uses vision range to find water
- **Drinking Behavior**: 
  - Start seeking water at 50% thirst
  - Stay at water until 90% thirst (not instant)
- **Water Evasion**: 
  - Squibbles avoid water when wandering
  - When seeking food/mates, willingness to cross based on swim stat (30-50% chance)
  - Higher swim stat = more willing to cross
- **Swimming**: 
  - Swim stat (0-1) determines speed in water
  - Speed formula: `0.3 + 0.7 * swim` (poor swimmers move at 30% speed, strong at 100%)
- **Drowning**: 
  - Chance per second: `(1 - swim) * 0.02`
  - Poor swimmers have higher drowning risk
- **Wet Condition**: 
  - After leaving water, squibbles are "wet" for 30 seconds
  - Wet squibbles move 30% slower

### Biome Environmental Effects

- **Forest**:
  - Reduces vision by 30% (dense foliage)
  - Reduces movement speed by 20% (difficult terrain)
- **Desert**:
  - Increases thirst drain by 80% (hot, dry environment)
- **Tundra**:
  - Reduces movement speed by 15% (difficult, cold terrain)
  - Lichen (tundra food) hunger gain scales with metabolism
    - Slow metabolism = more hunger gain
    - Fast metabolism = less hunger gain

### Interaction & Observation

- **Click to Select**: Click any squibble to view detailed stats
- **Camera Follow**: Automatically follows selected squibble (works even when paused/zoomed)
- **Detailed Stats Panel**: View all squibble attributes including:
  - Unique ID
  - Gender, age (in seconds), health, hunger, thirst
  - Speed, vision range, size
  - Attractiveness, minAttractiveness, virility
  - Intelligence, swim, metabolism
  - Breeding status, pregnancy status, cooldowns
  - Genetic traits and visual characteristics
- **Visual Indicators**:
  - Heart icon for squibbles seeking mates
  - Love icon for squibbles actively breeding
  - Fetus icon for pregnant squibbles
  - Hunger/thirst icons when critically low
  - Health bars above each squibble
  - Direction indicator showing movement direction

### Statistics & Graphing

- **Live Statistics Tracking**: Records population, health, traits, and behavior stats over time
- **Interactive Graphs**: Press **G** to view live-updating graphs
  - Multiple stat categories: Population, Health, Traits, Behavior, Resources, Demographics
  - Select/deselect stats to display
  - Export data as CSV or JSON
  - Real-time updates every 500ms
- **Tracked Statistics**:
  - Population (total, births, deaths)
  - Average health, hunger, thirst
  - Average traits (speed, vision, attractiveness, virility, intelligence, swim, metabolism)
  - Behavior counts (seeking food, seeking mate, pregnant, breeding)
  - Available food
  - Gender distribution

### Technology Stack

- **TypeScript** - Type-safe JavaScript
- **PixiJS v7** - High-performance 2D rendering
- **Vite** - Fast build tool and dev server
- **Canvas API** - Terrain rendering
- **Wave Function Collapse** - Procedural terrain generation

## Controls

### Simulation Controls
- **SPACE** - Pause/Resume simulation
- **R** - Reset simulation
- **A** - Add a new squibble at random location
- **I** - Toggle controls help display
- **G** - Show/hide statistics graphs
- **ESC** - Deselect squibble / Close graphs / Quit to title

### Camera Controls
- **Arrow Keys** - Move camera manually (when not following)
- **[** - Zoom out
- **]** - Zoom in
- **Click** - Select squibble (camera automatically follows)
- **Shift + Click** - Add new squibble at mouse position

### Graph Controls (when graphs are open)
- **Click checkboxes** - Toggle stats on/off
- **Export CSV** - Download statistics as CSV file
- **Export JSON** - Download statistics as JSON file
- **ESC** - Close graphs

## Breeding Mechanics

1. **Mate Seeking**: When conditions are met, squibbles actively seek opposite-gender partners
2. **Attractiveness Check**: Both partners must find each other attractive enough (based on minAttractiveness threshold)
3. **Breeding Process**: 
   - Takes 10 seconds to complete
   - Both squibbles stop moving during breeding
   - Love icon displayed above breeding pairs
4. **Interruption**: Other eligible males can approach and compete
5. **Female Choice**: If multiple males compete, the female chooses the most attractive one
6. **Pregnancy**: 
   - Female becomes pregnant after successful breeding
   - Gestation time is genetically determined (15-35 seconds)
   - Pregnancy affects movement speed and hunger/thirst drain
7. **Birth**: 
   - 1-4 babies born (genetically determined)
   - Mother may die during childbirth (risk increases with litter size)
   - Babies inherit genetic traits from both parents
8. **Offspring**: 
   - Start small and grow to adult size
   - Cannot breed until reaching fertile age window

## Genetic Traits Explained

### Polygenic Traits
These traits are controlled by multiple genetic loci, resulting in smooth, continuous variation:
- **Speed**: How fast a squibble moves
- **Vision**: How far a squibble can see food, water, and mates
- **Size**: Adult body size (affects radius)
- **Attractiveness**: How appealing a squibble is to potential mates
- **Virility**: Likelihood of successful breeding
- **Max Age**: Maximum lifespan
- **Intelligence**: Reduces chance of taking damage from cacti
- **Swim**: Swimming ability and willingness to cross water
- **Metabolism**: Rate of hunger/thirst consumption (affects lichen nutrition)

### Inheritance
- Offspring inherit traits from both parents
- Genetic variation ensures diversity
- Mutations can introduce new variations
- Traits can evolve over generations through natural selection

## Future Enhancements
- More advanced creature behaviors
- Visual Traits for squibbles and their predators
- Save/load simulation states
- Predator/prey relationships. Addition of predators for the Squibbles, and Apex predators.
- More detailed visual traits (horns, tails, patterns)
- Advanced genetic analysis tools
- Population migration patterns
- Seasonal changes
- Disease and immunity systems