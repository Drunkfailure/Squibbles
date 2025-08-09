import pygame

class SimulationUI:
    def __init__(self, screen_width, screen_height):
        """Initialize the simulation UI components"""
        self.screen_width = screen_width
        self.screen_height = screen_height
        
        # Fonts for UI
        self.font = pygame.font.Font(None, 24)
        self.small_font = pygame.font.Font(None, 18)
        
        # Colors
        self.text_color = (255, 255, 255)
        self.panel_color = (0, 0, 0)
        self.panel_alpha = 200
        self.pause_color = (255, 255, 0)
        
        # Controls visibility
        self.show_controls = False
    
    def draw_stats_panel(self, screen, stats, food_stats, zoom_level=1.0):
        """Draw the statistics panel"""
        # Calculate panel height based on content
        panel_height = 250
        if self.show_controls:
            panel_height = 450  # Taller when controls are visible
        
        # Draw stats panel
        panel_surface = pygame.Surface((300, panel_height))
        panel_surface.set_alpha(self.panel_alpha)
        panel_surface.fill(self.panel_color)
        screen.blit(panel_surface, (10, 10))
        
        # Stats text
        y_offset = 20
        texts = [
            f"Squibbles: {stats['alive']}/{stats['count']}",
            f"Avg Hunger: {stats['avg_hunger']:.1f}",
            f"Avg Thirst: {stats['avg_thirst']:.1f}",
            f"Avg Health: {stats['avg_health']:.1f}",
            f"Avg Speed: {stats['avg_speed']:.1f}",
            f"Food: {food_stats['available_food']}/{food_stats['total_food']}",
            f"Respawning: {food_stats['respawning_soon']}",
            f"Seeking Food: {stats.get('seeking_food_count', 0)}",
            f"Zoom: {zoom_level:.1f}x"
        ]
        
        # Add controls if visible
        if self.show_controls:
            texts.extend([
                "",
                "Controls:",
                "SPACE - Pause/Resume",
                "R - Reset",
                "A - Add Squibble",
                "Click - Add at mouse",
                "I - Toggle Controls",
                "ESC - Quit",
                "",
                "Camera:",
                "Arrow Keys - Move camera",
                "[ - Zoom out",
                "] - Zoom in"
            ])
        
        for text in texts:
            if text:
                text_surface = self.font.render(text, True, self.text_color)
                screen.blit(text_surface, (20, y_offset))
            y_offset += 25
    
    def draw_pause_indicator(self, screen, paused):
        """Draw pause indicator if simulation is paused"""
        if paused:
            pause_text = self.font.render("PAUSED", True, self.pause_color)
            text_rect = pause_text.get_rect(center=(self.screen_width // 2, 30))
            screen.blit(pause_text, text_rect)
    
    def toggle_controls(self):
        """Toggle the controls visibility"""
        self.show_controls = not self.show_controls 