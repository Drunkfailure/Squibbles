import pygame
import pygame_gui
import sys
from pygame_gui.elements import UIButton, UILabel, UIPanel, UITextEntryLine, UISelectionList
import os
import random

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
        
        # --- Load all title backgrounds from Assets/Title Screen ---
        self.title_bg_images = []
        bg_dir = os.path.join('Assets', 'Title Screen')
        for fname in os.listdir(bg_dir):
            if fname.lower().endswith('.png') and fname != 'squibbles.png':
                try:
                    img = pygame.image.load(os.path.join(bg_dir, fname)).convert_alpha()
                    img = pygame.transform.smoothscale(img, (screen_width, screen_height))
                    self.title_bg_images.append(img)
                except Exception as e:
                    print(f"Warning: Could not load {fname}: {e}")
        if self.title_bg_images:
            self.selected_bg = random.choice(self.title_bg_images)
        else:
            self.selected_bg = None
        # --- Load squibbles foreground image from Title Screen folder ---
        try:
            self.squibbles_fg = pygame.image.load(os.path.join(bg_dir, 'squibbles.png')).convert_alpha()
            # Scale to larger size (e.g., 80% of screen width, keep aspect)
            fg_width = int(screen_width * 0.8)
            aspect = self.squibbles_fg.get_height() / self.squibbles_fg.get_width()
            fg_height = int(fg_width * aspect)
            self.squibbles_fg = pygame.transform.smoothscale(self.squibbles_fg, (fg_width, fg_height))
        except Exception as e:
            print(f"Warning: Could not load squibbles.png foreground: {e}")
            self.squibbles_fg = None
        
        # Default values (will be overridden by size preset selection)
        self.creature_count = 200
        self.food_count = 600
        self.map_width = 6000
        self.map_height = 6000

        # Terrain defaults
        self.biome_scale = 5
        self.biome_weights = {'plains': 45, 'forest': 25, 'desert': 20, 'tundra': 10}
        self.pond_chance = 15  # percent
        self.river_chance = 60  # percent
        self.river_width = 0    # 0 = auto
        
        # UI elements
        self.creature_entry = None
        self.food_entry = None
        self.width_entry = None
        self.height_entry = None
        self.start_button = None
        self.back_button = None
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
            relative_rect=pygame.Rect((self.screen_width // 2 - 250, 150), (500, 520)),
            manager=self.ui_manager
        )
        
        # --- Map size preset selector ---
        size_label = UILabel(
            relative_rect=pygame.Rect((20, -20), (200, 30)),
            text="Map Size:",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.size_list = UISelectionList(
            relative_rect=pygame.Rect((20, 10), (180, 90)),
            item_list=["Small", "Medium", "Large"],
            manager=self.ui_manager,
            container=settings_panel
        )
        # Default values already set above; selection will change when user clicks

        # Creature count
        creature_label = UILabel(
            relative_rect=pygame.Rect((220, 20), (200, 30)),
            text="Number of Creatures (1-1000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.creature_entry = UITextEntryLine(
            relative_rect=pygame.Rect((420, 20), (60, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.creature_entry.set_text(str(self.creature_count))
        
        # Food count
        food_label = UILabel(
            relative_rect=pygame.Rect((220, 70), (200, 30)),
            text="Food Spawns (1-1000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.food_entry = UITextEntryLine(
            relative_rect=pygame.Rect((420, 70), (60, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.food_entry.set_text(str(self.food_count))
        
        # Map width
        width_label = UILabel(
            relative_rect=pygame.Rect((20, 120), (200, 30)),
            text="Map Width (1000-10000):",
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
            text="Map Height (1000-10000):",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        self.height_entry = UITextEntryLine(
            relative_rect=pygame.Rect((220, 170), (100, 30)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.height_entry.set_text(str(self.map_height))

        # --- Terrain controls ---
        terrain_label = UILabel(
            relative_rect=pygame.Rect((20, 210), (460, 25)),
            text="Terrain Generation",
            manager=self.ui_manager,
            container=settings_panel
        )

        # Biome scale (1-10)
        biome_scale_label = UILabel(
            relative_rect=pygame.Rect((20, 240), (160, 25)),
            text="Biome Scale (1-10):",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.biome_scale_entry = UITextEntryLine(
            relative_rect=pygame.Rect((180, 240), (60, 25)),
            manager=self.ui_manager,
            container=settings_panel
        )
        self.biome_scale_entry.set_text(str(self.biome_scale))

        # Biome weights
        weights_label = UILabel(
            relative_rect=pygame.Rect((260, 240), (220, 25)),
            text="Weights % P/F/D/T:",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.weight_plains_entry = UITextEntryLine(
            relative_rect=pygame.Rect((260, 270), (40, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.weight_plains_entry.set_text(str(self.biome_weights['plains']))
        self.weight_forest_entry = UITextEntryLine(
            relative_rect=pygame.Rect((305, 270), (40, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.weight_forest_entry.set_text(str(self.biome_weights['forest']))
        self.weight_desert_entry = UITextEntryLine(
            relative_rect=pygame.Rect((350, 270), (40, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.weight_desert_entry.set_text(str(self.biome_weights['desert']))
        self.weight_tundra_entry = UITextEntryLine(
            relative_rect=pygame.Rect((395, 270), (40, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.weight_tundra_entry.set_text(str(self.biome_weights['tundra']))

        # Water chances
        pond_label = UILabel(
            relative_rect=pygame.Rect((20, 300), (160, 25)),
            text="Ponds %:",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.pond_entry = UITextEntryLine(
            relative_rect=pygame.Rect((180, 300), (60, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.pond_entry.set_text(str(self.pond_chance))

        river_label = UILabel(
            relative_rect=pygame.Rect((20, 330), (160, 25)),
            text="River %:",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.river_entry = UITextEntryLine(
            relative_rect=pygame.Rect((180, 330), (60, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.river_entry.set_text(str(self.river_chance))

        river_w_label = UILabel(
            relative_rect=pygame.Rect((260, 330), (120, 25)),
            text="River Width:",
            manager=self.ui_manager,
            container=settings_panel
        )
        self.river_w_entry = UITextEntryLine(
            relative_rect=pygame.Rect((380, 330), (55, 25)),
            manager=self.ui_manager,
            container=settings_panel
        ); self.river_w_entry.set_text(str(self.river_width))
        
        # Instructions label
        instructions_label = UILabel(
            relative_rect=pygame.Rect((20, 380), (460, 100)),
            text="Modify the settings above or press Enter for default values.\nClick 'Start Simulation' to begin!\n\nNote: Higher values may affect performance. The simulation will use exactly what you enter.",
            manager=self.ui_manager,
            container=settings_panel
        )
        
        # Back button
        self.back_button = UIButton(
            relative_rect=pygame.Rect((50, self.screen_height - 100), (150, 50)),
            text="Back to Title",
            manager=self.ui_manager
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

    def validate_percent(self, value, default):
        try:
            val = float(value)
            return max(0.0, min(100.0, val))
        except ValueError:
            return float(default)
    
    def get_settings(self):
        """Get the current settings from the UI"""
        creature_count = self.validate_input(
            self.creature_entry.get_text(), 1, 1000, self.creature_count
        )
        food_count = self.validate_input(
            self.food_entry.get_text(), 1, 1000, self.food_count
        )
        map_width = self.validate_input(
            self.width_entry.get_text(), 1000, 10000, self.map_width
        )
        map_height = self.validate_input(
            self.height_entry.get_text(), 1000, 10000, self.map_height
        )
        
        return {
            'creature_count': creature_count,
            'food_count': food_count,
            'map_width': map_width,
            'map_height': map_height,
            'terrain': {
                'biome_scale': self.validate_input(self.biome_scale_entry.get_text(), 1, 10, self.biome_scale),
                'biome_weights': {
                    'plains': self.validate_input(self.weight_plains_entry.get_text(), 0, 1000, self.biome_weights['plains']),
                    'forest': self.validate_input(self.weight_forest_entry.get_text(), 0, 1000, self.biome_weights['forest']),
                    'desert': self.validate_input(self.weight_desert_entry.get_text(), 0, 1000, self.biome_weights['desert']),
                    'tundra': self.validate_input(self.weight_tundra_entry.get_text(), 0, 1000, self.biome_weights['tundra']),
                },
                'pond_chance': self.validate_percent(self.pond_entry.get_text(), self.pond_chance),
                'river_chance': self.validate_percent(self.river_entry.get_text(), self.river_chance),
                'river_width': self.validate_input(self.river_w_entry.get_text(), 0, 9999, self.river_width),
            }
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
                            # Quick start with current entries
                            return self.get_settings()
                
                if self.current_screen == "customization":
                    self.ui_manager.process_events(event)
                    
                    if event.type == pygame.USEREVENT:
                        if event.user_type == pygame_gui.UI_BUTTON_PRESSED:
                            if event.ui_element == self.start_button:
                                return self.get_settings()
                            elif event.ui_element == self.back_button:
                                # Go back to title screen
                                self.current_screen = "title"
                                self.ui_manager.clear_and_reset()
                        elif event.user_type == pygame_gui.UI_SELECTION_LIST_NEW_SELECTION:
                            # Map size preset changed
                            selected = event.text
                            presets = {
                                'Small': {'w': 6000, 'h': 6000, 'c': 200, 'f': 600},
                                'Medium': {'w': 7000, 'h': 7000, 'c': 300, 'f': 800},
                                'Large': {'w': 8000, 'h': 8000, 'c': 400, 'f': 1000},
                            }
                            if selected in presets:
                                p = presets[selected]
                                self.map_width, self.map_height = p['w'], p['h']
                                self.creature_count, self.food_count = p['c'], p['f']
                                self.width_entry.set_text(str(self.map_width))
                                self.height_entry.set_text(str(self.map_height))
                                self.creature_entry.set_text(str(self.creature_count))
                                self.food_entry.set_text(str(self.food_count))
            
            if self.current_screen == "customization":
                self.ui_manager.update(time_delta)
            
            # Draw
            self.screen.fill((0, 0, 0))  # Black background
            
            if self.current_screen == "title":
                # Draw random background
                if self.selected_bg:
                    self.screen.blit(self.selected_bg, (0, 0))
                # Draw squibbles foreground image, slightly above vertical center
                if self.squibbles_fg:
                    fg_rect = self.squibbles_fg.get_rect()
                    fg_rect.centerx = self.screen_width // 2
                    fg_rect.centery = int(self.screen_height * 0.30)  # Move to upper part of the screen
                    self.screen.blit(self.squibbles_fg, fg_rect)
                # Draw blinking "Press Enter" text overlaid on the image
                if blink_visible:
                    text_surface = self.font.render("Press Enter", True, (255, 255, 255))
                    text_rect = text_surface.get_rect()
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