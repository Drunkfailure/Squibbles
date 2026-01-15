# Squibbles - Evolution Simulation

A real-time creature simulation where Squibbles navigate a procedurally generated world, seeking food and water to survive, breed, and evolve through genetic inheritance.

## TypeScript Version

This project has been fully rewritten from Python/Pygame to TypeScript for web deployment.

### Status

✅ **Complete!** All phases finished:
- ✅ Phase 1: Project setup
- ✅ Phase 2: Core game loop and window management
- ✅ Phase 3: Basic rendering system
- ✅ Phase 4: Creature system (Squibbles)
- ✅ Phase 5: Food system with spatial indexing
- ✅ Phase 6: Terrain generation (CPU-based)
- ✅ Phase 7: UI system
- ✅ Phase 8: Title screen and loading screen
- ✅ Phase 9: Camera system with zoom
- ✅ Phase 10: Cleanup complete

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
  ├── terrain/             # Terrain generation
  ├── ui/                  # User interface
  └── utils/               # Utilities
```

### Features

#### Core Systems
- Real-time creature AI with hunger/thirst/health stats
- CPU-based terrain generation (GPU support can be added later)
- Multi-biome world (plains, forest, desert, tundra)
- Food system with regeneration and spatial indexing
- Water system with drinking mechanics
- Camera with zoom and smooth following
- Title screen with customizable settings
- Loading screen with progress
- Full web deployment ready

#### Breeding & Genetics
- **Gender System**: Male and female squibbles with gender-based breeding
- **Breeding Mechanics**: 
  - 10-second breeding duration with visual love icon
  - Interruption system - other males can compete during breeding
  - Female choice - females select the most attractive male when multiple compete
  - Breeding cooldowns to prevent spam
- **Genetic Inheritance**: 
  - Offspring inherit traits from parents (color, vision, speed, attractiveness, virility)
  - Genetic variation ensures diversity
- **Attractiveness System**: 
  - Each squibble has attractiveness (0-1) and minAttractiveness threshold
  - Breeding only occurs if both partners find each other attractive enough
- **Virility Trait**: Affects breeding success probability

#### Interaction & Observation
- **Click to Select**: Click any squibble to view detailed stats
- **Camera Follow**: Automatically follows selected squibble (works even when paused/zoomed)
- **Detailed Stats Panel**: View all squibble attributes including:
  - Gender, age, health, hunger, thirst
  - Speed, vision range
  - Attractiveness, minAttractiveness, virility
  - Breeding status and cooldowns
- **Visual Indicators**:
  - Heart icon for squibbles seeking mates
  - Love icon for squibbles actively breeding
  - Health bars and status icons

### Technology Stack

- **TypeScript** - Type-safe JavaScript
- **PixiJS** - High-performance 2D rendering
- **Vite** - Fast build tool and dev server
- **Canvas API** - Terrain rendering

### Controls

#### Simulation Controls
- **SPACE** - Pause/Resume simulation
- **R** - Reset simulation
- **A** - Add a new squibble at random location
- **I** - Toggle controls help display
- **ESC** - Deselect squibble / Quit to title

#### Camera Controls
- **Arrow Keys** - Move camera manually (when not following)
- **[** - Zoom out
- **]** - Zoom in
- **Click** - Select squibble (camera automatically follows)
- **Shift + Click** - Add new squibble at mouse position

#### Breeding Requirements
Squibbles will seek mates when:
- Health ≥ 60%
- Hunger ≥ 65%
- Thirst ≥ 65%
- Breeding cooldown expired
- Not already breeding

### Breeding Mechanics

1. **Mate Seeking**: When conditions are met, squibbles actively seek opposite-gender partners
2. **Attractiveness Check**: Both partners must find each other attractive enough (based on minAttractiveness threshold)
3. **Breeding Process**: 
   - Takes 10 seconds to complete
   - Both squibbles stop moving during breeding
   - Love icon displayed above breeding pairs
4. **Interruption**: Other eligible males can approach and compete
5. **Female Choice**: If multiple males compete, the female chooses the most attractive one
6. **Offspring**: Created after 10 seconds with genetic traits inherited from both parents

### Future Enhancements

- GPU-accelerated terrain generation (WebGPU)
- Food sprite rendering (currently circles)
- More advanced creature behaviors
- Save/load simulation states
- Population statistics and evolution tracking
- Predator/prey relationships
