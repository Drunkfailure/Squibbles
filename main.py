import pygame
import sys
import random
from squibbles import SquibbleManager
from GUI import show_title_screen
from GUI import SimulationUI
from Food import FoodManager
from GUI import show_loading_screen
from terrain import (
    GpuContext,
    generate_world,
    render_biome_floor_surface,
    WaterMap,
)
import math

# Initialize pygame
pygame.init()

# Default constants (will be overridden by title screen settings)
SCREEN_WIDTH = 1200
SCREEN_HEIGHT = 800
FPS = 60
BACKGROUND_COLOR = (20, 30, 40)
TEXT_COLOR = (255, 255, 255)

# Get monitor size
def get_monitor_size():
    """Get the primary monitor size"""
    try:
        info = pygame.display.Info()
        return info.current_w, info.current_h
    except:
        return 1920, 1080  # Fallback to common resolution

class Simulation:
    def __init__(self, settings=None):
        """Initialize the simulation with optional settings from title screen"""
        # Get monitor size for screen dimensions
        monitor_width, monitor_height = get_monitor_size()
        
        # Use settings from title screen if provided, otherwise use defaults
        if settings:
            self.map_width = settings.get('map_width', SCREEN_WIDTH)
            self.map_height = settings.get('map_height', SCREEN_HEIGHT)
            self.screen_width = monitor_width
            self.screen_height = monitor_height
            self.creature_count = settings.get('creature_count', 10)
            self.food_count = settings.get('food_count', 0)
            print(f"DEBUG: Using settings - Creatures: {self.creature_count}, Food: {self.food_count}")
            print(f"DEBUG: Map size: {self.map_width}x{self.map_height}, Screen size: {self.screen_width}x{self.screen_height}")
        else:
            self.map_width = SCREEN_WIDTH
            self.map_height = SCREEN_HEIGHT
            self.screen_width = monitor_width
            self.screen_height = monitor_height
            self.creature_count = 10
            self.food_count = 0
            print("DEBUG: Using default settings")
        # Keep original settings for terrain config access
        self.settings_ref = settings
        
        # Use existing screen from loading screen
        self.screen = pygame.display.get_surface()
        pygame.display.set_caption("Squibbles Simulation")
        self.clock = pygame.time.Clock()
        
        # Initialize squibble manager
        self.squibble_manager = SquibbleManager()
        
        # Initialize food manager
        self.food_manager = FoodManager(self.map_width, self.map_height, self.food_count)
        
        # Initialize UI
        self.ui = SimulationUI(self.screen_width, self.screen_height)
        
        # Calculate camera offset to center the map on screen
        self.camera_x = (self.screen_width - self.map_width) // 2
        self.camera_y = (self.screen_height - self.map_height) // 2
        
        # Camera movement and zoom
        self.camera_move_speed = 10
        self.zoom_level = 1.0
        self.min_zoom = 0.5
        self.max_zoom = 2.0
        self.zoom_speed = 0.1
        
        # Simulation state
        self.running = True
        self.paused = False
        
        # Spawn initial squibbles based on settings
        self.spawn_initial_squibbles()

        # Generate terrain background (GPU if available)
        self._init_terrain()

    def _init_terrain(self):
        ctx = GpuContext.detect()
        print(f"Terrain backend: {ctx.vendor} (GPU={ctx.is_gpu})")
        # Generate multi-biome world + water
        # Terrain generation settings can later be sourced from UI
        # Pull terrain settings from title screen if provided
        if hasattr(self, 'settings_ref') and self.settings_ref and 'terrain' in self.settings_ref:
            tg_settings = dict(self.settings_ref['terrain'])
        else:
            tg_settings = {
                'biome_scale': 5,
                'biome_weights': {
                    'plains': 45,
                    'forest': 25,
                    'desert': 20,
                    'tundra': 10,
                },
                'pond_chance': 15.0,
                'river_chance': 60.0,
                'river_width': max(1, (self.map_height // 32) // 120),
            }
        biome_grid, water_mask, tile_size = generate_world(self.map_width, self.map_height, ctx, settings=tg_settings)
        self.terrain_surface = render_biome_floor_surface(biome_grid, tile_size, water_mask)
        # Build water map helper for thirst logic
        self.water_map = WaterMap(water_mask, tile_size)
        # Recreate food manager using biome grid so foods match biomes
        self.food_manager = FoodManager(self.map_width, self.map_height, self.food_count)
        # Respawn foods with biome-aware species assignment
        self.food_manager.spawn_food(biome_grid=biome_grid, tile_size=tile_size)
    
    def spawn_initial_squibbles(self, count: int = None):
        """Spawn initial squibbles randomly across the map area"""
        if count is None:
            count = self.creature_count
        
        print(f"DEBUG: Spawning {count} squibbles")
        for i in range(count):
            x = random.randint(50, self.map_width - 50)
            y = random.randint(50, self.map_height - 50)
            self.squibble_manager.add_squibble(x, y)
            if i % 100 == 0:  # Print progress every 100 squibbles
                print(f"DEBUG: Spawned {i+1}/{count} squibbles")
        print(f"DEBUG: Finished spawning {count} squibbles")
    
    def handle_camera_movement(self):
        """Handle camera movement with arrow keys"""
        keys = pygame.key.get_pressed()
        
        if keys[pygame.K_LEFT]:
            self.camera_x += self.camera_move_speed
        if keys[pygame.K_RIGHT]:
            self.camera_x -= self.camera_move_speed
        if keys[pygame.K_UP]:
            self.camera_y += self.camera_move_speed
        if keys[pygame.K_DOWN]:
            self.camera_y -= self.camera_move_speed
    
    def handle_zoom(self, event):
        """Handle zoom with [ and ] keys"""
        if event.key == pygame.K_LEFTBRACKET:  # [
            self.zoom_level = max(self.min_zoom, self.zoom_level - self.zoom_speed)
        elif event.key == pygame.K_RIGHTBRACKET:  # ]
            self.zoom_level = min(self.max_zoom, self.zoom_level + self.zoom_speed)
    
    def handle_events(self):
        """Handle pygame events"""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    self.running = False
                elif event.key == pygame.K_SPACE:
                    self.paused = not self.paused
                elif event.key == pygame.K_r:
                    # Reset simulation
                    self.squibble_manager = SquibbleManager()
                    self.food_manager = FoodManager(self.map_width, self.map_height, self.food_count)
                    self.spawn_initial_squibbles()
                elif event.key == pygame.K_a:
                    # Add a new squibble
                    x = random.randint(50, self.map_width - 50)
                    y = random.randint(50, self.map_height - 50)
                    self.squibble_manager.add_squibble(x, y)
                elif event.key == pygame.K_i:
                    # Toggle controls
                    self.ui.toggle_controls()
                else:
                    # Handle zoom
                    self.handle_zoom(event)
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # Left click
                    # Add squibble at mouse position
                    x, y = pygame.mouse.get_pos()
                    self.squibble_manager.add_squibble(x, y)
    
    def update(self, dt: float):
        """Update simulation state"""
        # Handle camera movement
        self.handle_camera_movement()
        
        if not self.paused:
            self.squibble_manager.update_all(dt, self.map_width, self.map_height, self.food_manager, getattr(self, 'water_map', None))
            self.food_manager.update(dt)
    
    def draw_ui(self):
        """Draw user interface elements"""
        stats = self.squibble_manager.get_stats()
        food_stats = self.food_manager.get_stats()
        
        # Draw stats panel
        self.ui.draw_stats_panel(self.screen, stats, food_stats, self.zoom_level)
        
        # Draw pause indicator
        self.ui.draw_pause_indicator(self.screen, self.paused)
    
    def draw(self):
        """Draw everything to the screen"""
        # Clear screen
        self.screen.fill(BACKGROUND_COLOR)
        
        # Determine viewport in world coords
        screen_w, screen_h = self.screen.get_size()
        view_w = int(screen_w / self.zoom_level)
        view_h = int(screen_h / self.zoom_level)
        view_x = int(-self.camera_x / self.zoom_level)
        view_y = int(-self.camera_y / self.zoom_level)
        # Clamp
        view_x = max(0, min(self.map_width - view_w, view_x))
        view_y = max(0, min(self.map_height - view_h, view_y))

        # Blit terrain sub-rect directly to screen
        if hasattr(self, 'terrain_surface') and self.terrain_surface:
            sub = pygame.Rect(view_x, view_y, view_w, view_h)
            terrain_sub = self.terrain_surface.subsurface(sub)
            if self.zoom_level != 1.0:
                terrain_sub = pygame.transform.scale(terrain_sub, (screen_w, screen_h))
            self.screen.blit(terrain_sub, (0, 0))
        else:
            self.screen.fill(BACKGROUND_COLOR)

        # Draw visible foods and squibbles into a screen-sized overlay
        overlay = pygame.Surface((screen_w, screen_h), pygame.SRCALPHA)
        view_rect = pygame.Rect(view_x, view_y, view_w, view_h)
        scale = self.zoom_level
        # Draw foods with culling if available
        if hasattr(self.food_manager, 'draw_visible'):
            self.food_manager.draw_visible(overlay, view_rect, scale, (0, 0))
        else:
            self.food_manager.draw_all(overlay)
        # Draw squibbles (cull manually)
        for s in self.squibble_manager.squibbles:
            if not s.alive:
                continue
            if view_rect.collidepoint(s.x, s.y):
                sx = int((s.x - view_x) * scale)
                sy = int((s.y - view_y) * scale)
                # Temporarily reuse draw logic by offsetting
                # Minimal re-draw: draw circle and direction line
                pygame.draw.circle(overlay, s.color, (sx, sy), max(1, int(s.radius * scale)))
                end_x = sx + int(math.cos(s.direction) * (s.radius + 5) * scale)
                end_y = sy + int(math.sin(s.direction) * (s.radius + 5) * scale)
                pygame.draw.line(overlay, (255, 255, 255), (sx, sy), (end_x, end_y), max(1, int(2 * scale)))

        self.screen.blit(overlay, (0, 0))
        
        # Draw UI
        self.draw_ui()
        
        # Update display
        pygame.display.flip()
    
    def run(self):
        """Main game loop"""
        while self.running:
            # Handle events
            self.handle_events()
            
            # Calculate delta time
            dt = self.clock.tick(FPS) / 1000.0
            
            # Update simulation
            self.update(dt)
            
            # Draw everything
            self.draw()
        
        # Cleanup
        pygame.quit()
        sys.exit()

def main():
    """Main function"""
    # Show title screen and get settings
    print("Starting title screen...")
    settings = show_title_screen()
    
    if settings is None:
        # User closed the title screen
        print("Title screen closed, exiting...")
        pygame.quit()
        sys.exit()
    
    print(f"Starting simulation with settings: {settings}")
    print(f"DEBUG: Creature count from settings: {settings.get('creature_count', 'NOT FOUND')}")
    print(f"DEBUG: Food count from settings: {settings.get('food_count', 'NOT FOUND')}")
    print(f"DEBUG: Map size from settings: {settings.get('map_width', 'NOT FOUND')}x{settings.get('map_height', 'NOT FOUND')}")
    
    # Get monitor size and set display to full screen
    monitor_width, monitor_height = get_monitor_size()
    print(f"DEBUG: Monitor size: {monitor_width}x{monitor_height}")
    
    # Set display to monitor size
    pygame.display.set_mode((monitor_width, monitor_height))
    
    # Show loading screen
    print("Showing loading screen...")
    show_loading_screen(settings)
    
    # Create and run simulation with the settings
    simulation = Simulation(settings)
    simulation.run()

if __name__ == "__main__":
    main() 