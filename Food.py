import pygame
import random
import math
from typing import List, Tuple

class Food:
    def __init__(self, x: float, y: float):
        """
        Initialize a food item
        
        Args:
            x: X position of the food
            y: Y position of the food
        """
        self.x = x
        self.y = y
        self.radius = 5
        self.color = (0, 255, 0)  # Green color for food
        self.eaten = False
        self.eaten_time = 0  # Time when food was eaten
        self.respawn_delay = 15.0  # Seconds to wait before respawning
        
    def draw(self, screen: pygame.Surface):
        """
        Draw the food on the screen
        
        Args:
            screen: Pygame surface to draw on
        """
        if not self.eaten:
            pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), self.radius)
    
    def get_position(self) -> Tuple[float, float]:
        """Get the current position of the food"""
        return (self.x, self.y)
    
    def is_eaten(self) -> bool:
        """Check if the food has been eaten"""
        return self.eaten
    
    def eat(self, current_time: float):
        """Mark the food as eaten"""
        self.eaten = True
        self.eaten_time = current_time

class FoodManager:
    def __init__(self, map_width: int, map_height: int, food_count: int = 100):
        """
        Initialize the food manager
        
        Args:
            map_width: Width of the map
            map_height: Height of the map
            food_count: Number of food items to spawn
        """
        self.map_width = map_width
        self.map_height = map_height
        self.food_count = food_count
        self.foods: List[Food] = []
        self.current_time = 0.0
        
        # Spawn initial food
        self.spawn_food()
    
    def spawn_food(self):
        """Spawn food items at random locations"""
        # Clear existing food
        self.foods.clear()
        
        # Spawn new food items
        for _ in range(self.food_count):
            x = random.randint(50, self.map_width - 50)
            y = random.randint(50, self.map_height - 50)
            self.foods.append(Food(x, y))
    
    def respawn_food(self, food: Food):
        """Respawn a single food item at a new random location"""
        food.x = random.randint(50, self.map_width - 50)
        food.y = random.randint(50, self.map_height - 50)
        food.eaten = False
        food.eaten_time = 0
    
    def update(self, dt: float):
        """
        Update the food manager
        
        Args:
            dt: Delta time in seconds
        """
        # Update current time
        self.current_time += dt
        
        # Check each food item for respawning
        for food in self.foods:
            if food.eaten and (self.current_time - food.eaten_time) >= food.respawn_delay:
                self.respawn_food(food)
    
    def draw_all(self, screen: pygame.Surface):
        """
        Draw all food items
        
        Args:
            screen: Pygame surface to draw on
        """
        for food in self.foods:
            food.draw(screen)
    
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
        for food in self.foods:
            if not food.eaten:
                distance = math.sqrt((food.x - x) ** 2 + (food.y - y) ** 2)
                if distance <= radius:
                    return food
        return None
    
    def get_available_food(self) -> List[Food]:
        """Get all available (uneaten) food items"""
        return [food for food in self.foods if not food.eaten]
    
    def get_food_count(self) -> int:
        """Get the current number of available food items"""
        return len(self.get_available_food())
    
    def get_total_food_count(self) -> int:
        """Get the total number of food items (including eaten ones)"""
        return len(self.foods)
    
    def eat_food_at_position(self, x: float, y: float, radius: float = 10) -> bool:
        """
        Eat food at a specific position
        
        Args:
            x: X position to check
            y: Y position to check
            radius: Radius to check around the position
            
        Returns:
            True if food was eaten, False otherwise
        """
        food = self.get_food_at_position(x, y, radius)
        if food:
            food.eat(self.current_time)
            return True
        return False
    
    def get_stats(self) -> dict:
        """Get statistics about the food"""
        available = self.get_food_count()
        total = self.get_total_food_count()
        
        # Count food that will respawn soon (within 5 seconds)
        respawning_soon = sum(1 for food in self.foods 
                            if food.eaten and (self.current_time - food.eaten_time) >= 10.0)
        
        return {
            'available_food': available,
            'total_food': total,
            'eaten_food': total - available,
            'respawning_soon': respawning_soon
        } 