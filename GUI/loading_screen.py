import pygame
import sys
import time

class LoadingScreen:
    def __init__(self, screen_width, screen_height, settings):
        """
        Initialize the loading screen
        
        Args:
            screen_width: Width of the screen
            screen_height: Height of the screen
            settings: Simulation settings from title screen
        """
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.settings = settings
        
        # Use existing display surface
        self.screen = pygame.display.get_surface()
        pygame.display.set_caption("Loading Squibbles Simulation...")
        
        # Load Minecraft font
        try:
            self.font = pygame.font.Font('Assets/Minecraft.ttf', 36)
            self.small_font = pygame.font.Font('Assets/Minecraft.ttf', 18)
            print("Using Minecraft font for loading screen")
        except:
            # Fallback to system font if Minecraft font not found
            self.font = pygame.font.SysFont('arial', 36)
            self.small_font = pygame.font.SysFont('arial', 18)
            print("Using fallback font for loading screen")
        
        # Colors
        self.background_color = (20, 30, 40)
        self.text_color = (255, 255, 255)
        self.progress_color = (0, 255, 0)
        self.progress_bg_color = (50, 50, 50)
        
        # Progress tracking
        self.progress = 0
        self.max_progress = 100
        self.current_task = "Initializing..."
        
        # Loading tasks
        self.tasks = [
            ("Setting up simulation environment", 10),
            ("Creating squibble population", 30),
            ("Spawning food items", 50),
            ("Initializing UI components", 70),
            ("Preparing simulation engine", 90),
            ("Starting simulation", 100)
        ]
    
    def update_progress(self, task_name, progress):
        """Update the current progress"""
        self.current_task = task_name
        self.progress = progress
    
    def draw(self):
        """Draw the loading screen"""
        # Clear screen
        self.screen.fill(self.background_color)
        
        # Draw title
        title_text = self.font.render("Loading Simulation", True, self.text_color)
        title_rect = title_text.get_rect(center=(self.screen_width // 2, self.screen_height // 2 - 100))
        self.screen.blit(title_text, title_rect)
        
        # Draw current task
        task_text = self.small_font.render(self.current_task, True, self.text_color)
        task_rect = task_text.get_rect(center=(self.screen_width // 2, self.screen_height // 2 - 50))
        self.screen.blit(task_text, task_rect)
        
        # Draw progress bar
        bar_width = 400
        bar_height = 20
        bar_x = (self.screen_width - bar_width) // 2
        bar_y = self.screen_height // 2
        
        # Background
        pygame.draw.rect(self.screen, self.progress_bg_color, (bar_x, bar_y, bar_width, bar_height))
        
        # Progress fill
        progress_width = int((self.progress / self.max_progress) * bar_width)
        if progress_width > 0:
            pygame.draw.rect(self.screen, self.progress_color, (bar_x, bar_y, progress_width, bar_height))
        
        # Progress border
        pygame.draw.rect(self.screen, self.text_color, (bar_x, bar_y, bar_width, bar_height), 2)
        
        # Progress percentage
        percent_text = self.small_font.render(f"{self.progress}%", True, self.text_color)
        percent_rect = percent_text.get_rect(center=(self.screen_width // 2, bar_y + bar_height + 30))
        self.screen.blit(percent_text, percent_rect)
        
        # Draw settings info
        settings_text = [
            f"Map Size: {self.settings['map_width']} x {self.settings['map_height']}",
            f"Creatures: {self.settings['creature_count']}",
            f"Food Items: {self.settings['food_count']}"
        ]
        
        y_offset = self.screen_height // 2 + 100
        for text in settings_text:
            text_surface = self.small_font.render(text, True, self.text_color)
            text_rect = text_surface.get_rect(center=(self.screen_width // 2, y_offset))
            self.screen.blit(text_surface, text_rect)
            y_offset += 25
        
        # Update display
        pygame.display.flip()
    
    def run_loading_sequence(self):
        """Run the loading sequence with progress updates"""
        clock = pygame.time.Clock()
        
        for task_name, target_progress in self.tasks:
            # Update progress
            self.update_progress(task_name, target_progress)
            self.draw()
            
            # Small delay to show progress
            time.sleep(0.1)
            
            # Handle events (allow user to quit during loading)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
            
            clock.tick(60)
        
        # Final delay
        time.sleep(0.2)

def show_loading_screen(settings):
    """
    Show the loading screen and return when complete
    
    Args:
        settings: Simulation settings from title screen
    """
    print("Starting loading screen...")
    
    # Get monitor size for loading screen
    try:
        info = pygame.display.Info()
        monitor_width, monitor_height = info.current_w, info.current_h
    except:
        monitor_width, monitor_height = 1920, 1080  # Fallback
    
    # Create loading screen using monitor size
    loading_screen = LoadingScreen(monitor_width, monitor_height, settings)
    
    # Run loading sequence
    loading_screen.run_loading_sequence()
    
    print("Loading screen complete!")
    return loading_screen.screen 