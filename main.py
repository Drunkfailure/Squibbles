import pygame
import sys
import random
from squibbles import SquibbleManager
from title_screen import show_title_screen
from GUI import SimulationUI
from food import FoodManager
from loading_screen import show_loading_screen

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
            self.squibble_manager.update_all(dt, self.map_width, self.map_height, self.food_manager)
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
        
        # Create a surface for the map area
        map_surface = pygame.Surface((self.map_width, self.map_height))
        map_surface.fill(BACKGROUND_COLOR)
        
        # Draw food on map surface
        self.food_manager.draw_all(map_surface)
        
        # Draw squibbles on map surface
        self.squibble_manager.draw_all(map_surface)
        
        # Apply zoom to map surface
        if self.zoom_level != 1.0:
            zoomed_width = int(self.map_width * self.zoom_level)
            zoomed_height = int(self.map_height * self.zoom_level)
            zoomed_surface = pygame.transform.scale(map_surface, (zoomed_width, zoomed_height))
        else:
            zoomed_surface = map_surface
        
        # Draw map surface to screen with camera offset
        self.screen.blit(zoomed_surface, (self.camera_x, self.camera_y))
        
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