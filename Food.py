import random
import pygame

# Respawnable base class for food and similar entities
class Respawnable:
    def __init__(self, MAP_WIDTH, MAP_HEIGHT):
        self.spawn_x = random.randint(0, MAP_WIDTH)
        self.spawn_y = random.randint(0, MAP_HEIGHT)
        self.x, self.y = self.spawn_x, self.spawn_y
        self.active = True
        self.respawn_timer = 0

    def consume(self):
        self.active = False
        self.respawn_timer = pygame.time.get_ticks() + self.get_respawn_delay()

    def get_respawn_delay(self):
        return random.randint(10000, 15000)

    def update(self):
        if not self.active and pygame.time.get_ticks() >= self.respawn_timer:
            self.active = True
            self.x, self.y = self.spawn_x, self.spawn_y

# Food entity
class Food(Respawnable):
    def __init__(self, MAP_WIDTH, MAP_HEIGHT, get_biome):
        super().__init__(MAP_WIDTH, MAP_HEIGHT)
        placed = False
        for _ in range(10):
            x = random.randint(0, MAP_WIDTH)
            y = random.randint(0, MAP_HEIGHT)
            biome = get_biome(x, y)
            if biome == 'DESERT' and random.random() < 0.7:
                continue
            if biome == 'RAINFOREST' and random.random() < 0.7:
                continue
            if biome == 'TUNDRA' and random.random() < 0.4:
                continue
            self.x, self.y = x, y
            self.spawn_x, self.spawn_y = x, y
            placed = True
            break
        if not placed:
            self.x, self.y = random.randint(0, MAP_WIDTH), random.randint(0, MAP_HEIGHT)
            self.spawn_x, self.spawn_y = self.x, self.y
    def draw(self, screen, world_to_screen, zoom):
        if self.active:
            pos = world_to_screen(self.x, self.y)
            size = max(2, int(2 * zoom))
            if -size <= pos[0] <= screen.get_width() + size and -size <= pos[1] <= screen.get_height() + size:
                pygame.draw.rect(screen, (0, 255, 0), (pos[0] - size//2, pos[1] - size//2, size, size))

# FoodManager for handling all food entities
class FoodManager:
    def __init__(self, food_count, map_width, map_height, get_biome, world_to_screen):
        self.foods = [Food(map_width, map_height, get_biome) for _ in range(food_count)]
        self.map_width = map_width
        self.map_height = map_height
        self.get_biome = get_biome
        self.world_to_screen = world_to_screen
    def update(self):
        for food in self.foods:
            food.update()
    def draw(self, screen, zoom):
        for food in self.foods:
            food.draw(screen, self.world_to_screen, zoom)
    def get_active_foods(self):
        return [f for f in self.foods if f.active]
    def __iter__(self):
        return iter(self.foods) 