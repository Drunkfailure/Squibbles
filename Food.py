import pygame
import random
import math
import os
from typing import List, Tuple, Optional

class Food:
    """Sprite-based food with three consumable slots and stage images.

    Stage mapping (by remaining slots):
    - 3 slots -> stage 4 image (full)
    - 2 slots -> stage 3 image
    - 1 slot  -> stage 2 image
    - 0 slots -> stage 1 image (empty but visible until respawn)
    """

    # Cache per-species stage images so we only load once
    _species_images: dict = {}

    # Static configuration for regeneration and nutrition per species
    _species_config: dict = {
        # Fastest regen, least hunger
        'plainsshrub': {'regen_delay': 5.0, 'hunger_gain': 10.0, 'thirst_gain': 0.0},
        # Medium regen
        'foresttree': {'regen_delay': 10.0, 'hunger_gain': 20.0, 'thirst_gain': 0.0},
        # Very slow regen, minor hunger and thirst
        'cactus': {'regen_delay': 20.0, 'hunger_gain': 8.0, 'thirst_gain': 8.0},
        # Medium regen
        'tundrabush': {'regen_delay': 10.0, 'hunger_gain': 15.0, 'thirst_gain': 0.0},
    }

    @classmethod
    def _load_species_images(cls) -> dict:
        if cls._species_images:
            return cls._species_images

        base = os.path.join('Assets', 'Tilesets for Terrain')
        # Define species with their folder and stage-ordered filenames.
        # Filenames reflect the repo's mixed capitalization.
        species_defs = {
            'cactus': (
                'Desert',
                {4: 'Desertcactus4.png', 3: 'Desertcactus3.png', 2: 'desertcactus2.png', 1: 'desertcactus1.png'},
            ),
            'foresttree': (
                'Forest',
                {4: 'ForestTree4.png', 3: 'ForestTree3.png', 2: 'Foresttree2.png', 1: 'ForestTree1.png'},
            ),
            'plainsshrub': (
                'Plains',
                {4: 'PlainsShrub4.png', 3: 'PlainsShrub3.png', 2: 'PlainsShrub2.png', 1: 'PlainsShrub1.png'},
            ),
            'tundrabush': (
                'Tundra',
                {4: 'TundraBush4.png', 3: 'TundraBush3.png', 2: 'TundraBush2.png', 1: 'TundraBush1.png'},
            ),
        }

        result = {}
        for species, (folder, stage_files) in species_defs.items():
            stage_images = {}
            for stage, fname in stage_files.items():
                path = os.path.join(base, folder, fname)
                try:
                    img = pygame.image.load(path).convert_alpha()
                    img = pygame.transform.smoothscale(img, (32, 32))
                    stage_images[stage] = img
                except Exception:
                    # If a particular stage is missing, skip it
                    pass
            if stage_images:
                result[species] = stage_images

        cls._species_images = result
        return cls._species_images

    def __init__(self, x: float, y: float, species: Optional[str] = None):
        """Initialize a food sprite at a position.

        species: optional explicit species key ('plainsshrub','foresttree','cactus','tundrabush').
        If None, a random available species is chosen.
        """
        self.x = x
        self.y = y

        species_images = self._load_species_images()
        # Choose a species that has at least one stage loaded
        self.species: Optional[str] = None
        if species_images:
            if species in species_images:
                self.species = species
            else:
                self.species = random.choice(list(species_images.keys()))
        self.image: Optional[pygame.Surface] = None
        # Interaction radius set after first image selection
        self.radius = 12

        # Slot-based consumption
        self.max_slots = 3
        self.remaining_slots = self.max_slots

        self.eaten = False
        self.eaten_time = 0  # Time when fully eaten
        # Regeneration properties (configured per species below)
        self.regen_delay = 12.0
        self.last_regen_time = 0.0

        # Nutrition values per bite
        self.hunger_gain = 15.0
        self.thirst_gain = 0.0

        # Initialize current image based on slots
        self._update_image_by_slots()

        # Apply species-specific config
        if self.species and self.species in self._species_config:
            cfg = self._species_config[self.species]
            self.regen_delay = cfg['regen_delay']
            self.hunger_gain = cfg['hunger_gain']
            self.thirst_gain = cfg['thirst_gain']

    def _update_image_by_slots(self):
        """Pick the correct stage image for the current remaining slots."""
        # Stage is remaining_slots + 1 (3->4, 2->3, 1->2, 0->1)
        stage = self.remaining_slots + 1
        self.image = None
        if self.species and self.species in self._species_images:
            stage_map = self._species_images[self.species]
            # Prefer exact stage, otherwise fallback to the highest available
            if stage in stage_map:
                self.image = stage_map[stage]
            elif stage_map:
                # Choose the closest lower stage, else highest
                available_stages = sorted(stage_map.keys())
                closest = max([s for s in available_stages if s <= stage] or available_stages)
                self.image = stage_map[closest]

        # Update radius based on image if available
        if self.image:
            self.radius = max(self.image.get_width(), self.image.get_height()) // 2

    def draw(self, screen: pygame.Surface):
        """Always draw the current stage image; empty sprites remain visible until respawn."""
        if self.image:
            rect = self.image.get_rect(center=(int(self.x), int(self.y)))
            screen.blit(self.image, rect)
        else:
            pygame.draw.circle(screen, (0, 255, 0), (int(self.x), int(self.y)), self.radius)

    def get_position(self) -> Tuple[float, float]:
        """Get the current position of the food."""
        return (self.x, self.y)

    def is_eaten(self) -> bool:
        """Check if the sprite has been fully consumed."""
        return self.eaten

    def eat(self, current_time: float):
        """Consume one slot. Returns (hunger_gain, thirst_gain) if consumed.

        Fully eaten when slots reach zero; starts regeneration countdowns.
        """
        if self.eaten or self.remaining_slots <= 0:
            return None
        self.remaining_slots = max(0, self.remaining_slots - 1)
        self.last_regen_time = current_time
        # Update stage image immediately
        self._update_image_by_slots()
        if self.remaining_slots == 0:
            self.eaten = True
            self.eaten_time = current_time
        return (self.hunger_gain, self.thirst_gain)

class FoodManager:
    def __init__(self, map_width: int, map_height: int, food_count: int = 100):
        """
        Initialize the food manager
        
        Args:
            map_width: Width of the map
            map_height: Height of the map
            food_count: Total food units to spawn. Each sprite provides 3 units.
        """
        self.map_width = map_width
        self.map_height = map_height
        # Interpret incoming value as total units, not sprite count
        self.max_food_units = max(0, food_count)
        self.foods: List[Food] = []
        self.current_time = 0.0
        # Spatial index (uniform grid). Foods do not move, so we build once.
        self.cell_size = 64
        self._grid = {}
        
        # Spawn initial food
        self.spawn_food()
    
    def spawn_food(self, biome_grid=None, tile_size: int = 32):
        """Spawn food sprites at random locations.

        Number of sprites = ceil(units / 3).
        """
        # Clear existing food
        self.foods.clear()
        
        num_sprites = (self.max_food_units + 2) // 3  # ceil division by 3
        species_for_biome = {
            1: 'plainsshrub',  # Plains
            2: 'foresttree',   # Forest
            3: 'cactus',       # Desert
            4: 'tundrabush',   # Tundra
        }
        for _ in range(num_sprites):
            x = random.randint(50, self.map_width - 50)
            y = random.randint(50, self.map_height - 50)
            species = None
            if biome_grid is not None:
                # Sample biome at this position
                cx = min(max(0, x // max(1, tile_size)), biome_grid.shape[1] - 1)
                cy = min(max(0, y // max(1, tile_size)), biome_grid.shape[0] - 1)
                b = int(biome_grid[cy, cx])
                species = species_for_biome.get(b)
            self.foods.append(Food(x, y, species=species))
        self._rebuild_grid()

    def _rebuild_grid(self):
        self._grid = {}
        for food in self.foods:
            cx = int(food.x) // self.cell_size
            cy = int(food.y) // self.cell_size
            self._grid.setdefault((cx, cy), []).append(food)

    def _iter_cells_in_radius(self, x: float, y: float, radius: float):
        min_cx = int(max(0, (x - radius)) // self.cell_size)
        max_cx = int(min(self.map_width - 1, (x + radius)) // self.cell_size)
        min_cy = int(max(0, (y - radius)) // self.cell_size)
        max_cy = int(min(self.map_height - 1, (y + radius)) // self.cell_size)
        for cy in range(min_cy, max_cy + 1):
            for cx in range(min_cx, max_cx + 1):
                yield (cx, cy)
    
    def respawn_food(self, food: Food):
        """Regenerate one slot in-place rather than moving the sprite.

        When remaining_slots reaches max_slots, it's considered available again.
        """
        # Increase by one slot up to max
        food.remaining_slots = min(food.max_slots, food.remaining_slots + 1)
        food.eaten_time = 0
        # If it now has at least one slot, it's no longer considered eaten
        if food.remaining_slots > 0:
            food.eaten = False
        # Update appearance
        food._update_image_by_slots()
    
    def update(self, dt: float):
        """
        Update the food manager
        
        Args:
            dt: Delta time in seconds
        """
        # Update current time
        self.current_time += dt
        
        # Regenerate slots over time per-species
        for food in self.foods:
            # If fully empty (eaten) use eaten_time; otherwise use last_regen_time
            last_time = food.eaten_time if food.eaten else food.last_regen_time
            if (self.current_time - last_time) >= food.regen_delay and food.remaining_slots < food.max_slots:
                self.respawn_food(food)
                # Reset the regen timer baseline
                # Use current_time so next slot appears after another delay
                food.last_regen_time = self.current_time
    
    def draw_all(self, screen: pygame.Surface):
        """
        Draw all food items
        
        Args:
            screen: Pygame surface to draw on
        """
        for food in self.foods:
            food.draw(screen)

    def draw_visible(self, screen: pygame.Surface, view_rect: pygame.Rect, scale: float = 1.0, dest_xy: Tuple[int, int] = (0, 0)):
        """Draw only foods intersecting view_rect.

        - view_rect: pygame.Rect in world coordinates
        - scale: world->screen scale (1.0 means 1 px world == 1 px screen)
        - dest_xy: top-left destination on screen
        """
        ox, oy = dest_xy
        # Determine grid cells overlapping the view
        min_cx = max(0, view_rect.left // self.cell_size)
        max_cx = min((self.map_width - 1) // self.cell_size, view_rect.right // self.cell_size)
        min_cy = max(0, view_rect.top // self.cell_size)
        max_cy = min((self.map_height - 1) // self.cell_size, view_rect.bottom // self.cell_size)
        for cy in range(min_cy, max_cy + 1):
            for cx in range(min_cx, max_cx + 1):
                for food in self._grid.get((cx, cy), []):
                    # Draw even when fully eaten so stage (1) remains visible
                    if not view_rect.collidepoint(food.x, food.y):
                        continue
                    sx = int((food.x - view_rect.left) * scale) + ox
                    sy = int((food.y - view_rect.top) * scale) + oy
                    if food.image:
                        img = food.image
                        if scale != 1.0:
                            size = (max(1, int(img.get_width() * scale)), max(1, int(img.get_height() * scale)))
                            img = pygame.transform.smoothscale(img, size)
                        rect = img.get_rect(center=(sx, sy))
                        screen.blit(img, rect)
                    else:
                        pygame.draw.circle(screen, (0, 255, 0), (sx, sy), max(1, int(food.radius * scale)))
    
    def get_food_at_position(self, x: float, y: float, radius: float = 10) -> Food:
        """
        Get food at a specific position
        
        Args:
            x: X position to check
            y: Y position to check
            radius: Radius to check around the position
            
        Returns:
            Food item if found, None otherwise
        """
        for cell in self._iter_cells_in_radius(x, y, radius):
            for food in self._grid.get(cell, []):
                if not food.eaten and food.remaining_slots > 0:
                    effective_radius = max(radius, food.radius)
                    distance = math.sqrt((food.x - x) ** 2 + (food.y - y) ** 2)
                    if distance <= effective_radius:
                        return food
        return None

    def get_nearest_food(self, x: float, y: float, vision_radius: float) -> Optional[Food]:
        nearest_food = None
        nearest_distance = float('inf')
        for cell in self._iter_cells_in_radius(x, y, vision_radius):
            for food in self._grid.get(cell, []):
                if food.eaten or food.remaining_slots <= 0:
                    continue
                dx = food.x - x
                dy = food.y - y
                d2 = dx * dx + dy * dy
                if d2 <= vision_radius * vision_radius and d2 < nearest_distance:
                    nearest_distance = d2
                    nearest_food = food
        return nearest_food
    
    def get_available_food(self) -> List[Food]:
        """Get available food sprites (with at least one remaining slot)."""
        return [food for food in self.foods if not food.eaten and food.remaining_slots > 0]
    
    def get_food_count(self) -> int:
        """Get the current number of available food units across all sprites."""
        return sum(food.remaining_slots for food in self.foods if not food.eaten)
    
    def get_total_food_count(self) -> int:
        """Get the total number of food units represented by current sprites."""
        return len(self.foods) * 3
    
    def eat_food_at_position(self, x: float, y: float, radius: float = 10):
        """
        Eat a single food unit at a specific position
        
        Args:
            x: X position to check
            y: Y position to check
            radius: Radius to check around the position
            
        Returns:
            Tuple (hunger_gain, thirst_gain) if a unit was consumed, otherwise None
        """
        food = self.get_food_at_position(x, y, radius)
        if food:
            return food.eat(self.current_time)
        return None
    
    def get_stats(self) -> dict:
        """Get statistics about food units and respawns."""
        available_units = self.get_food_count()
        total_units = self.get_total_food_count()

        respawning_soon = sum(
            1 for food in self.foods if food.eaten and (self.current_time - food.eaten_time) >= 10.0
        )

        return {
            'available_food': available_units,
            'total_food': total_units,
            'eaten_food': total_units - available_units,
            'respawning_soon': respawning_soon,
        }