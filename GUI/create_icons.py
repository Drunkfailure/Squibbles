import pygame
import os

# Initialize pygame
pygame.init()

# Create Assets directory if it doesn't exist
if not os.path.exists('Assets'):
    os.makedirs('Assets')

# Create hunger icon (orange/red circle)
hunger_surface = pygame.Surface((16, 16), pygame.SRCALPHA)
pygame.draw.circle(hunger_surface, (255, 165, 0), (8, 8), 6)  # Orange circle
pygame.draw.circle(hunger_surface, (255, 0, 0), (8, 8), 4)    # Red inner circle
pygame.image.save(hunger_surface, 'Assets/hunger.png')

# Create health icon (green cross)
health_surface = pygame.Surface((16, 16), pygame.SRCALPHA)
# Draw a simple cross shape
pygame.draw.rect(health_surface, (0, 255, 0), (7, 3, 2, 10))  # Vertical bar
pygame.draw.rect(health_surface, (0, 255, 0), (3, 7, 10, 2))  # Horizontal bar
pygame.image.save(health_surface, 'Assets/health.png')

print("Icons created successfully!")
print("- Assets/hunger.png (orange/red circle)")
print("- Assets/health.png (green cross)") 