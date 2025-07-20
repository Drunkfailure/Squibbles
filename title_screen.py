import pygame
import pygame_gui
import sys
from pygame_gui.elements import UIButton, UILabel, UIPanel, UITextEntryLine, UISelectionList

class TitleScreen:
    def __init__(self, screen_width=1000, screen_height=800):
        self.screen_width = screen_width
        self.screen_height = screen_height
        
        # Only set display mode if not already set
        if pygame.display.get_surface() is None:
            self.screen = pygame.display.set_mode((screen_width, screen_height))
        else:
            self.screen = pygame.display.get_surface()
        
        pygame.display.set_caption("Squibbles - Evolution Simulation")
        
        # Initialize UI manager
        self.ui_manager = pygame_gui.UIManager((screen_width, screen_height))
        
        # Load title screen asset
        try:
            self.title_image = pygame.image.load('Assets/squibbles.png')
            # Scale image to fill entire screen
            self.title_image = pygame.transform.smoothscale(self.title_image, (screen_width, screen_height))
        except pygame.error:
            print("Warning: Could not load Assets/squibbles.png")
            self.title_image = None
        
        # Default values
        self.creature_count = 300
        self.food_count = 500
        self.map_width = 1000
        self.map_height = 1000
        
        # UI elements
        self.creature_entry = None
        self.food_entry = None
        self.width_entry = None
        self.height_entry = None
        self.start_button = None
        self.title_label = None
        self.subtitle_label = None
        
        # State tracking
        self.current_screen = "title"  # "title" or "customization"
        
        # Font for blinking text - use Minecraft font
        try:
            self.font = pygame.font.Font('Assets/Minecraft.ttf', 36)
            print("Using Minecraft font")
        except:
            # Fallback to system font if Minecraft font not found
            self.font = pygame.font.SysFont('arial', 36)
            print("Using fallback font: arial")
    
    def setup_customization_screen(self):
        """Setup the customization screen UI elements"""
        # Clear existing UI elements
        self.ui_manager.clear_and_reset()
        
        # Title label
        self.title_label = UILabel(
            relative_rect=pygame.Rect((self.screen_width // 2 - 200, 50), (400, 50)),
            text="Simulation Settings",
            manager=self.ui_manager
        )
        
        # Settings panel
        settings_panel = UIPanel(
            relative_rect=pygame.Rect((self.screen_width // 2 - 250, 150), (500, 400)),
            manager=self.ui_manager
        )
        
        # Creature count
        creature_label = UILabel(
            relative_rect=pygame.Rect((20, 20), (200, 30)),
            text="Number of Creatures (1-1000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.creature_entry = UITextEntryLine(
            relative_rect=pygame.Rect((220, 20), (100, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.creature_entry.set_text(str(self.creature_count))
        
        # Food count
        food_label = UILabel(
            relative_rect=pygame.Rect((20, 70), (200, 30)),
            text="Food Spawns (1-500):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.food_entry = UITextEntryLine(
            relative_rect=pygame.Rect((220, 70), (100, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.food_entry.set_text(str(self.food_count))
        
        # Map width
        width_label = UILabel(
            relative_rect=pygame.Rect((20, 120), (200, 30)),
            text="Map Width (500-2000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.width_entry = UITextEntryLine(
            relative_rect=pygame.Rect((220, 120), (100, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.width_entry.set_text(str(self.map_width))
        
        # Map height
        height_label = UILabel(
            relative_rect=pygame.Rect((20, 170), (200, 30)),
            text="Map Height (500-2000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.height_entry = UITextEntryLine(
            relative_rect=pygame.Rect((220, 170), (100, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.height_entry.set_text(str(self.map_height))
        
        # Instructions label
        instructions_label = UILabel(
            relative_rect=pygame.Rect((20, 220), (460, 80)),
            text="Modify the settings above or press Enter for default values.\nClick 'Start Simulation' to begin!",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        # Start button
        self.start_button = UIButton(
            relative_rect=pygame.Rect((self.screen_width // 2 - 100, self.screen_height - 100), (200, 50)),
            text="Start Simulation",
            manager=self.ui_manager
        )
    
    def validate_input(self, value, min_val, max_val, default):
        """Validate input and return a valid value"""
        try:
            val = int(value)
            return max(min_val, min(max_val, val))
        except ValueError:
            return default
    
    def get_settings(self):
        """Get the current settings from the UI"""
        creature_count = self.validate_input(
            self.creature_entry.get_text(), 1, 1000, 300
        )
        food_count = self.validate_input(
            self.food_entry.get_text(), 1, 500, 500
        )
        map_width = self.validate_input(
            self.width_entry.get_text(), 500, 2000, 1000
        )
        map_height = self.validate_input(
            self.height_entry.get_text(), 500, 2000, 1000
        )
        
        return {
            'creature_count': creature_count,
            'food_count': food_count,
            'map_width': map_width,
            'map_height': map_height
        }
    
    def run(self):
        """Run the title screen and return settings when user starts simulation"""
        clock = pygame.time.Clock()
        blink_timer = 0
        blink_visible = True
        
        while True:
            time_delta = clock.tick(60) / 1000.0
            blink_timer += time_delta
            
            # Blink every 0.5 seconds
            if blink_timer >= 0.5:
                blink_visible = not blink_visible
                blink_timer = 0
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return None
                
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_RETURN:
                        if self.current_screen == "title":
                            # Switch to customization screen
                            self.current_screen = "customization"
                            self.setup_customization_screen()
                        elif self.current_screen == "customization":
                            # Return default settings
                            return {
                                'creature_count': 300,
                                'food_count': 500,
                                'map_width': 1000,
                                'map_height': 1000
                            }
                
                if self.current_screen == "customization":
                    self.ui_manager.process_events(event)
                    
                    if event.type == pygame.USEREVENT:
                        if event.user_type == pygame_gui.UI_BUTTON_PRESSED:
                            if event.ui_element == self.start_button:
                                return self.get_settings()
            
            if self.current_screen == "customization":
                self.ui_manager.update(time_delta)
            
            # Draw
            self.screen.fill((0, 0, 0))  # Black background
            
            if self.current_screen == "title":
                # Draw title screen - full screen image
                if self.title_image:
                    self.screen.blit(self.title_image, (0, 0))
                
                # Draw blinking "Press Enter" text overlaid on the image
                if blink_visible:
                    # Use the pixel art font directly
                    text_surface = self.font.render("Press Enter", True, (255, 255, 255))
                    text_rect = text_surface.get_rect()
                    # Center both horizontally and vertically
                    text_rect.centerx = self.screen_width // 2
                    text_rect.centery = self.screen_height // 2 + 250  # Position in lower center area
                    self.screen.blit(text_surface, text_rect)
            
            if self.current_screen == "customization":
                self.ui_manager.draw_ui(self.screen)
            
            pygame.display.flip()
        
        return None

def show_title_screen():
    """Show the title screen and return simulation settings"""
    print("Title screen starting...")
    title_screen = TitleScreen()
    result = title_screen.run()
    print(f"Title screen finished, returning: {result}")
    return result

if __name__ == "__main__":
    # Only initialize pygame if not already initialized
    if not pygame.get_init():
        pygame.init()
    settings = show_title_screen()
    if settings:
        print("Settings:", settings)
    pygame.quit() 