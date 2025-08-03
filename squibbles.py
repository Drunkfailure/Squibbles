import pygame
import random
import math
from typing import Tuple, List, TYPE_CHECKING

if TYPE_CHECKING:
    from food import Food

class Squibble:
    def __init__(self, x: float, y: float, color: Tuple[int, int, int]):
        """
        Initialize a Squibble creature
        
        Args:
            x: Initial x position
            y: Initial y position
            color: RGB color tuple for the creature
        """
        self.x = x
        self.y = y
        self.color = color
        self.radius = 10
        
        # Stats
        self.hunger = 100.0  # Starts at 100, decreases over time
        self.thirst = 100.0  # Starts at 100, decreases over time
        self.health = 100.0  # Starts at 100
        self.vision = random.uniform(50, 150)  # Vision range in pixels
        
        # Behavior thresholds
        self.hunger_threshold = 70.0  # Start seeking food when hunger drops below this
        
        # Movement
        self.speed = random.uniform(1.0, 3.0)
        self.direction = random.uniform(0, 2 * math.pi)
        self.direction_change_timer = 0
        self.direction_change_interval = random.randint(30, 120)  # frames
        
        # Speed-based consumption rates
        self.base_hunger_rate = 0.5  # Base hunger depletion per second
        self.base_thirst_rate = 0.3  # Base thirst depletion per second
        
        # State
        self.alive = True
        self.age = 0
        
    def update(self, dt: float, screen_width: int, screen_height: int, food_manager=None):
        """
        Update the squibble's state
        
        Args:
            dt: Delta time in seconds
            screen_width: Screen width for boundary checking
            screen_height: Screen height for boundary checking
            food_manager: Optional food manager for eating food
        """
        if not self.alive:
            return
            
        self.age += 1
        
        # Decrease stats over time (speed affects consumption rate)
        speed_multiplier = 1.0 + (self.speed - 1.0) * 0.5  # Speed affects consumption
        self.hunger -= self.base_hunger_rate * speed_multiplier * dt
        self.thirst -= self.base_thirst_rate * speed_multiplier * dt
        
        # Die if stats reach 0
        if self.hunger <= 0 or self.thirst <= 0 or self.health <= 0:
            self.alive = False
            return
            
        # Try to eat food if available and hungry
        if food_manager and self.hunger < self.hunger_threshold:
            if food_manager.eat_food_at_position(self.x, self.y, self.radius + 5):
                self.hunger = min(100, self.hunger + 20)  # Restore hunger when eating
        
        # Check if we need to seek food
        seeking_food = self.hunger < self.hunger_threshold
        
        # Continuous food seeking behavior (more responsive)
        if seeking_food and food_manager:
            nearest_food = self.find_nearest_food(food_manager)
            if nearest_food:
                # Move towards the food immediately
                dx = nearest_food.x - self.x
                dy = nearest_food.y - self.y
                self.direction = math.atan2(dy, dx)
                # Reset timer to allow for more frequent direction updates when pursuing food
                self.direction_change_timer = 0
        
        # Change direction based on behavior (only when not actively pursuing food)
        self.direction_change_timer += 1
        if self.direction_change_timer >= self.direction_change_interval:
            if seeking_food and food_manager:
                # Check if we can see food
                nearest_food = self.find_nearest_food(food_manager)
                if nearest_food:
                    # Move towards the food
                    dx = nearest_food.x - self.x
                    dy = nearest_food.y - self.y
                    self.direction = math.atan2(dy, dx)
                    # Shorter intervals when moving towards food for more responsive movement
                    self.direction_change_interval = random.randint(15, 60)
                else:
                    # No food found, wander randomly with occasional direction changes
                    if random.random() < 0.3:  # 30% chance to change direction when wandering
                        self.direction = random.uniform(0, 2 * math.pi)
                    # Longer intervals when wandering
                    self.direction_change_interval = random.randint(60, 180)
            else:
                # Normal random movement when not hungry
                self.direction = random.uniform(0, 2 * math.pi)
                self.direction_change_interval = random.randint(30, 120)
            
            self.direction_change_timer = 0
        
        # Move
        self.x += math.cos(self.direction) * self.speed
        self.y += math.sin(self.direction) * self.speed
        
        # Bounce off boundaries
        if self.x - self.radius <= 0 or self.x + self.radius >= screen_width:
            self.direction = math.pi - self.direction
            self.x = max(self.radius, min(screen_width - self.radius, self.x))
            
        if self.y - self.radius <= 0 or self.y + self.radius >= screen_height:
            self.direction = -self.direction
            self.y = max(self.radius, min(screen_height - self.radius, self.y))
    
    def draw(self, screen: pygame.Surface):
        """
        Draw the squibble on the screen
        
        Args:
            screen: Pygame surface to draw on
        """
        if not self.alive:
            return
        
        # Draw the main body
        pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), self.radius)
        
        # Draw direction indicator
        end_x = self.x + math.cos(self.direction) * (self.radius + 5)
        end_y = self.y + math.sin(self.direction) * (self.radius + 5)
        pygame.draw.line(screen, (255, 255, 255), (self.x, self.y), (end_x, end_y), 2)
        
        # Draw health bar
        self.draw_health_bar(screen)
        
        # Draw status icons
        self.draw_status_icons(screen)
    
    def get_stats(self) -> dict:
        """Get current stats as a dictionary"""
        return {
            'hunger': self.hunger,
            'thirst': self.thirst,
            'health': self.health,
            'vision': self.vision,
            'speed': self.speed,
            'speed_multiplier': 1.0 + (self.speed - 1.0) * 0.5,
            'age': self.age,
            'alive': self.alive,
            'seeking_food': self.hunger < self.hunger_threshold
        }
    
    def can_see(self, other_x: float, other_y: float) -> bool:
        """
        Check if this squibble can see another object at the given coordinates
        
        Args:
            other_x: X coordinate of the object to check
            other_y: Y coordinate of the object to check
            
        Returns:
            True if the object is within vision range
        """
        distance = math.sqrt((self.x - other_x) ** 2 + (self.y - other_y) ** 2)
        return distance <= self.vision
    
    def find_nearest_food(self, food_manager) -> 'Food':
        """
        Find the nearest available food within vision range
        
        Args:
            food_manager: The food manager to search through
            
        Returns:
            The nearest food item if found, None otherwise
        """
        nearest_food = None
        nearest_distance = float('inf')
        
        for food in food_manager.get_available_food():
            distance = math.sqrt((self.x - food.x) ** 2 + (self.y - food.y) ** 2)
            if distance <= self.vision and distance < nearest_distance:
                nearest_food = food
                nearest_distance = distance
        
        return nearest_food
    
    def draw_health_bar(self, screen: pygame.Surface):
        """Draw the health bar above the squibble"""
        bar_width = 20
        bar_height = 3
        bar_x = int(self.x - bar_width // 2)
        bar_y = int(self.y - self.radius - 15)
        
        # Background (gray)
        pygame.draw.rect(screen, (100, 100, 100), (bar_x, bar_y, bar_width, bar_height))
        
        # Health bar (green to red based on health)
        health_width = int((self.health / 100.0) * bar_width)
        if health_width > 0:
            # Color from green (good health) to red (low health)
            if self.health > 50:
                # Green to yellow
                green = 255
                red = int(255 * (1 - (self.health - 50) / 50))
            else:
                # Yellow to red
                red = 255
                green = int(255 * (self.health / 50))
            
            health_color = (red, green, 0)
            pygame.draw.rect(screen, health_color, (bar_x, bar_y, health_width, bar_height))
    
    def draw_status_icons(self, screen: pygame.Surface):
        """Draw status icons above the squibble"""
        icon_size = 12
        icon_y = int(self.y - self.radius - 25)
        
        # Load icons if not already loaded
        if not hasattr(self, '_hunger_icon'):
            try:
                self._hunger_icon = pygame.image.load('Assets/hunger.png').convert_alpha()
                self._hunger_icon = pygame.transform.scale(self._hunger_icon, (icon_size, icon_size))
            except:
                self._hunger_icon = None
        
        if not hasattr(self, '_health_icon'):
            try:
                self._health_icon = pygame.image.load('Assets/health.png').convert_alpha()
                self._health_icon = pygame.transform.scale(self._health_icon, (icon_size, icon_size))
            except:
                self._health_icon = None
        
        # Draw hunger icon if hungry
        if self.hunger < self.hunger_threshold and self._hunger_icon:
            icon_x = int(self.x - icon_size // 2)
            screen.blit(self._hunger_icon, (icon_x, icon_y))
        
        # Draw health icon if health is low (below 50)
        if self.health < 50 and self._health_icon:
            icon_x = int(self.x - icon_size // 2)
            screen.blit(self._health_icon, (icon_x, icon_y - icon_size - 2))

class SquibbleManager:
    def __init__(self):
        """Manager class for handling multiple squibbles"""
        self.squibbles: List[Squibble] = []
        
    def add_squibble(self, x: float, y: float, color: Tuple[int, int, int] = None):
        """Add a new squibble to the simulation"""
        if color is None:
            # Generate random color
            color = (
                random.randint(50, 255),
                random.randint(50, 255),
                random.randint(50, 255)
            )
        
        self.squibbles.append(Squibble(x, y, color))
    
    def update_all(self, dt: float, screen_width: int, screen_height: int, food_manager=None):
        """Update all squibbles"""
        for squibble in self.squibbles:
            squibble.update(dt, screen_width, screen_height, food_manager)
        
        # Remove dead squibbles
        self.squibbles = [s for s in self.squibbles if s.alive]
    
    def draw_all(self, screen: pygame.Surface):
        """Draw all squibbles"""
        for squibble in self.squibbles:
            squibble.draw(screen)
    
    def get_stats(self) -> dict:
        """Get statistics about all squibbles"""
        if not self.squibbles:
            return {'count': 0, 'alive': 0}
        
        alive_count = sum(1 for s in self.squibbles if s.alive)
        avg_hunger = sum(s.hunger for s in self.squibbles) / len(self.squibbles)
        avg_thirst = sum(s.thirst for s in self.squibbles) / len(self.squibbles)
        avg_health = sum(s.health for s in self.squibbles) / len(self.squibbles)
        avg_speed = sum(s.speed for s in self.squibbles) / len(self.squibbles)
        seeking_food_count = sum(1 for s in self.squibbles if s.alive and s.hunger < s.hunger_threshold)
        
        return {
            'count': len(self.squibbles),
            'alive': alive_count,
            'avg_hunger': avg_hunger,
            'avg_thirst': avg_thirst,
            'avg_health': avg_health,
            'avg_speed': avg_speed,
            'seeking_food_count': seeking_food_count
        } 