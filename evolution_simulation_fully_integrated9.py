# Evolution Simulation: Fixed Version
# Features:
# - Setup menu (creature count, food, water, map size)
# - HSV-based rainbow color inheritance
# - Click to view creature stats in real time
# - Camera follow on selected creature
# - Zoom and pan controls
# - Reproduction, gestation, hunger/thirst, and mutation

import pygame
import random
import math
import colorsys
import sys

# Constants
FPS = 60
CREATURE_RADIUS = 6
GESTATION_TIME = 10000  # ms
FOOD_VALUE = 30
WATER_VALUE = 30

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
CYAN = (0, 255, 255)

pygame.init()
FONT = pygame.font.SysFont(None, 24)
BIG_FONT = pygame.font.SysFont(None, 36)

# Setup window
DEFAULT_WIDTH, DEFAULT_HEIGHT = 1000, 800

# Camera
camera_offset = [0, 0]
camera_follow = None
zoom = 1.0
zoom_step = 0.1

# Global variables - initialize with defaults
CREATURE_COUNT = 50
FOOD_COUNT = 30
WATER_COUNT = 30
MAP_WIDTH = 1000
MAP_HEIGHT = 800


# Setup menu values (modifies globals)
def show_setup_menu():
    global CREATURE_COUNT, FOOD_COUNT, WATER_COUNT, MAP_WIDTH, MAP_HEIGHT
    print("Evolution Simulation Setup")
    print("(Press Enter for default values)")

    try:
        user_input = input("Number of creatures (1-1000) [50]: ").strip()
        CREATURE_COUNT = max(1, min(1000, int(user_input))) if user_input else 50
    except ValueError:
        CREATURE_COUNT = 50

    try:
        user_input = input("Number of food spawns (1-500) [30]: ").strip()
        FOOD_COUNT = max(1, min(500, int(user_input))) if user_input else 30
    except ValueError:
        FOOD_COUNT = 30

    try:
        user_input = input("Number of water spawns (1-500) [30]: ").strip()
        WATER_COUNT = max(1, min(500, int(user_input))) if user_input else 30
    except ValueError:
        WATER_COUNT = 30

    try:
        user_input = input("Map width (500-2000) [1000]: ").strip()
        MAP_WIDTH = max(500, min(2000, int(user_input))) if user_input else 1000
    except ValueError:
        MAP_WIDTH = 1000

    try:
        user_input = input("Map height (500-2000) [800]: ").strip()
        MAP_HEIGHT = max(500, min(2000, int(user_input))) if user_input else 800
    except ValueError:
        MAP_HEIGHT = 800

    # Reset global kill counter on new simulation
    # Set global_total_kills = 0 at the module level after this function


show_setup_menu()

# Always use default window size
screen = pygame.display.set_mode((DEFAULT_WIDTH, DEFAULT_HEIGHT))
pygame.display.set_caption("Evolution Simulation")
clock = pygame.time.Clock()


# Utilities
def hsv_to_rgb_tuple(h, s=1, v=1):
    # Ensure hue is in valid range [0, 1]
    h = h % 1.0
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return int(r * 255), int(g * 255), int(b * 255)


# Coordinate transform
def world_to_screen(x, y):
    screen_x = int((x - camera_offset[0]) * zoom)
    screen_y = int((y - camera_offset[1]) * zoom)
    return screen_x, screen_y


# Entities
class Respawnable:
    def __init__(self):
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


class Food(Respawnable):
    def draw(self):
        if self.active:
            pos = world_to_screen(self.x, self.y)
            pygame.draw.circle(screen, (0, 255, 0), pos, 3)


class Water(Respawnable):
    def get_respawn_delay(self):
        return 5000  # faster respawn for water

    def draw(self):
        if self.active:
            pos = world_to_screen(self.x, self.y)
            pygame.draw.circle(screen, (0, 0, 255), pos, 3)


class Creature:
    def __init__(self, x=None, y=None, hue=None, max_health=None):
        self.kill_count = 0
        # Position - random within map bounds
        self.x = x if x is not None else random.randint(0, MAP_WIDTH)
        self.y = y if y is not None else random.randint(0, MAP_HEIGHT)
        # Movement and perception stats - all randomly assigned
        self.speed = random.uniform(0.5, 2.0)
        self.vision = random.randint(1, 120)
        # Survival stats - random starting values
        self.hunger = random.uniform(50, 100)
        self.thirst = random.uniform(50, 100)
        # Max health: random 1-100 for first gen, inherited for offspring
        self.max_health = max_health if max_health is not None else random.randint(1, 100)
        self.health = self.max_health  # Start at max health
        # Reproduction stats - all random
        self.offspring_count = random.randint(1, 5)
        self.sex = random.choice(['M', 'F'])
        self.attractiveness = random.uniform(0.3, 1.0)
        self.threshold = random.uniform(0.2, 1.0)
        self.gestation_timer = 0
        self.gestation_duration = random.randint(30000, 60000)  # ms, 30-60 seconds per creature
        self.infertility = random.randint(1, 100)  # 1-100, higher = more likely to fail
        # Age attributes
        self.max_age = random.randint(120000, 360000)  # ms, 2-6 minutes
        self.maturity_age = int(self.max_age * 0.25)
        self.age = self.maturity_age  # First gen spawns at start of maturity
        # Visual appearance - random hue
        self.hue = hue if hue is not None else random.random()
        self.color = hsv_to_rgb_tuple(self.hue)
        # Combat stats - all randomly assigned
        self.attack = random.uniform(1, 5)
        self.defense = random.uniform(1, 5)
        self.aggression = random.uniform(0, 1)
        self.pending_offspring = []  # List of (father, offspring_count) tuples

    def update(self, foods, waters, creatures):
        global global_total_kills
        # Age update
        self.age += clock.get_time()  # ms per frame
        # Age scaling factor
        if self.age < self.maturity_age:
            age_factor = 0.75 + 0.25 * (self.age / self.maturity_age)
        else:
            age_factor = 1.0 - 0.5 * ((self.age - self.maturity_age) / (self.max_age - self.maturity_age))
            age_factor = max(0.5, age_factor)
        # Pregnant check
        is_pregnant = self.sex == 'F' and pygame.time.get_ticks() < self.gestation_timer
        # Handle birth if gestation is over and there are pending offspring
        if self.sex == 'F' and not is_pregnant and self.pending_offspring:
            for father, count in self.pending_offspring:
                for _ in range(count):
                    child = self.make_offspring(father)
                    child.age = 0  # Spawn at age 0
                    creatures.append(child)
            self.pending_offspring.clear()
        # Drain hunger and thirst
        drain_multiplier = 1.0
        speed_modifier = 1.0
        if is_pregnant:
            drain_multiplier = 1.3  # 30% faster drain when pregnant
            speed_modifier = 1/1.5  # 1.5x slower
        # Apply age scaling to stats
        effective_speed = self.speed * age_factor * speed_modifier
        effective_vision = self.vision * age_factor
        effective_attack = self.attack * age_factor
        effective_defense = self.defense * age_factor
        effective_attractiveness = self.attractiveness * age_factor
        self.hunger -= self.speed * 0.02 * drain_multiplier
        self.thirst -= self.speed * 0.02 * drain_multiplier
        # Die if hunger or thirst reaches 0 or age exceeds max_age
        if self.hunger <= 0 or self.thirst <= 0 or self.age >= self.max_age:
            return False
        # Find targets (use effective_vision)
        food_target = self.find_nearest(foods, vision_override=effective_vision)
        water_target = self.find_nearest(waters, vision_override=effective_vision)
        target = None
        if self.hunger < 70 or self.thirst < 70:
            if self.hunger < self.thirst and food_target:
                target = food_target
            elif water_target:
                target = water_target
            elif food_target:
                target = food_target
        # Handle combat
        contested = False
        for c in creatures:
            if c is not self and target and math.hypot(c.x - target.x, c.y - target.y) < CREATURE_RADIUS * 2:
                # Pregnant creatures always flee from combat
                if is_pregnant:
                    dx, dy = self.x - c.x, self.y - c.y
                    dist = math.hypot(dx, dy)
                    if dist > 0:
                        self.x += (dx / dist) * effective_speed
                        self.y += (dy / dist) * effective_speed
                    contested = True
                    break
                # Child creatures are much more likely to flee and less likely to be aggressive
                if self.age < self.maturity_age:
                    dx, dy = self.x - c.x, self.y - c.y
                    dist = math.hypot(dx, dy)
                    if dist > 0:
                        self.x += (dx / dist) * effective_speed
                        self.y += (dy / dist) * effective_speed
                    contested = True
                    break
                effective_aggression = self.aggression
                if self.age < self.maturity_age:
                    effective_aggression *= 0.3  # 70% less likely to be aggressive
                if self.hunger > 10 and self.thirst > 10:
                    if random.random() < effective_aggression:
                        damage = max(0, effective_attack - c.defense)
                        if damage > 0:
                            c.health -= damage
                            if c.health <= 0:
                                self.kill_count += 1
                                global_total_kills += 1
                    else:
                        if random.random() < c.aggression:
                            retaliation = max(0, c.attack - effective_defense)
                            if retaliation > 0:
                                self.health -= retaliation
                                if self.health <= 0:
                                    c.kill_count += 1
                                    global_total_kills += 1
                        contested = True
        # Die if health reaches 0
        if self.health <= 0:
            return False
        # Movement
        if target and not contested:
            self.move_toward(target, speed_override=effective_speed)
        elif not contested:
            self.move_random(speed_override=effective_speed)
        # Keep creature within bounds
        self.x = max(0, min(MAP_WIDTH, self.x))
        self.y = max(0, min(MAP_HEIGHT, self.y))
        # Eat and reproduce
        self.eat(foods, waters)
        self.reproduce(creatures, age_factor=age_factor)
        return True

    def move_random(self, speed_override=None):
        angle = random.uniform(0, 2 * math.pi)
        speed_mod = speed_override if speed_override is not None else self.speed
        self.x += math.cos(angle) * speed_mod
        self.y += math.sin(angle) * speed_mod

    def move_toward(self, target, speed_override=None):
        dx, dy = target.x - self.x, target.y - self.y
        dist = math.hypot(dx, dy)
        if dist > 0:
            speed_mod = speed_override if speed_override is not None else self.speed
            self.x += (dx / dist) * speed_mod
            self.y += (dy / dist) * speed_mod

    def find_nearest(self, items, vision_override=None):
        vision = vision_override if vision_override is not None else self.vision
        visible = [i for i in items if i.active and math.hypot(i.x - self.x, i.y - self.y) <= vision]
        return min(visible, key=lambda i: math.hypot(i.x - self.x, i.y - self.y), default=None)

    def eat(self, foods, waters):
        for food in foods:
            if food.active and math.hypot(food.x - self.x, food.y - self.y) < CREATURE_RADIUS:
                self.hunger = min(100, self.hunger + FOOD_VALUE)
                self.health = min(self.max_health, self.health + 5)
                food.consume()
                break
        for water in waters:
            if water.active and math.hypot(water.x - self.x, water.y - self.y) < CREATURE_RADIUS:
                self.thirst = min(100, self.thirst + WATER_VALUE)
                self.health = min(self.max_health, self.health + 5)
                water.consume()
                break

    def reproduce(self, creatures, age_factor=1.0):
        # Prevent reproduction for bottom/top 25% of age
        age_pct = self.age / self.max_age
        if age_pct < 0.25 or age_pct > 0.75:
            return
        if self.sex == 'F' and (pygame.time.get_ticks() < self.gestation_timer or self.pending_offspring):
            return
        # Prevent pregnancy if gestation duration is longer than remaining lifespan after maturity
        if self.sex == 'F':
            time_left = self.max_age - self.age
            if self.gestation_duration > time_left:
                return
        if self.hunger < 70 or self.thirst < 70:
            return
        for other in creatures:
            if other is self or {self.sex, other.sex} != {'M', 'F'}:
                continue
            if other.hunger < 70 or other.thirst < 70:
                continue
            if self.attractiveness * age_factor < other.threshold or other.attractiveness * age_factor < self.threshold:
                continue
            other_age_pct = other.age / other.max_age
            if other_age_pct < 0.25 or other_age_pct > 0.75:
                continue
            if math.hypot(other.x - self.x, other.y - self.y) < CREATURE_RADIUS * 2:
                mother, father = (self, other) if self.sex == 'F' else (other, self)
                # Infertility check
                infertility_chance = (mother.infertility + father.infertility) / 2
                if random.uniform(0, 100) < infertility_chance:
                    # Mating fails
                    return
                # Store pending offspring for birth after gestation
                mother.pending_offspring.append((father, mother.offspring_count))
                # Cost scales with offspring count, applied to both parents
                cost = mother.offspring_count * 10  # 10 units per offspring (adjust as needed)
                mother.hunger = max(0, mother.hunger - cost)
                mother.thirst = max(0, mother.thirst - cost)
                father.hunger = max(0, father.hunger - cost)
                father.thirst = max(0, father.thirst - cost)
                mother.gestation_timer = pygame.time.get_ticks() + mother.gestation_duration
                break

    def make_offspring(self, partner):
        def mutate(val, pct):
            return max(0.1, val * (1 + random.uniform(-pct, pct)))

        # Average parents' hue and mutate
        hue_avg = (self.hue + partner.hue) / 2
        if abs(self.hue - partner.hue) > 0.5:  # Handle hue wraparound
            hue_avg = (hue_avg + 0.5) % 1.0

        # Average parents' max_health and mutate, clamp to 1-100
        max_health_avg = (self.max_health + partner.max_health) / 2
        child_max_health = int(max(1, min(100, mutate(max_health_avg, 0.1))))

        child = Creature(x=self.x, y=self.y, hue=mutate(hue_avg, 0.1), max_health=child_max_health)
        child.speed = mutate((self.speed + partner.speed) / 2, 0.1)
        child.vision = max(1, int(mutate((self.vision + partner.vision) / 2, 0.1)))
        child.offspring_count = max(1, min(5, int(mutate((self.offspring_count + partner.offspring_count) / 2, 0.1))))
        child.attractiveness = mutate((self.attractiveness + partner.attractiveness) / 2, 0.3)
        child.threshold = random.uniform(0.2, 1.0)
        child.sex = random.choice(['M', 'F'])
        child.attack = mutate((self.attack + partner.attack) / 2, 0.1)
        child.defense = mutate((self.defense + partner.defense) / 2, 0.1)
        child.aggression = max(0, min(1, mutate((self.aggression + partner.aggression) / 2, 0.1)))
        child.health = child.max_health  # Start at max health
        child.gestation_duration = random.randint(30000, 60000)  # Inherit random gestation duration
        # Clamp gestation duration to be no longer than child's adult lifespan
        max_gestation = max(1000, child.max_age - child.maturity_age)
        child.gestation_duration = min(child.gestation_duration, max_gestation)
        child.max_age = int((self.max_age + partner.max_age) / 2 * random.uniform(0.95, 1.05))
        child.max_age = max(120000, min(360000, child.max_age))  # Clamp to 2-6 minutes
        child.maturity_age = int(child.max_age * 0.25)
        child.infertility = max(1, min(100, int(mutate((self.infertility + partner.infertility) / 2, 0.1))))
        return child

    def draw(self):
        pos = world_to_screen(self.x, self.y)
        # Only draw if on screen
        if -CREATURE_RADIUS <= pos[0] <= screen.get_width() + CREATURE_RADIUS and \
                -CREATURE_RADIUS <= pos[1] <= screen.get_height() + CREATURE_RADIUS:
            pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * zoom))

            # Draw health bar
            bar_width = int(20 * zoom)
            bar_height = max(1, int(3 * zoom))

            # Health bar (green to red gradient based on health)
            health_ratio = self.health / self.max_health if self.max_health > 0 else 0
            health_width = int(bar_width * health_ratio)

            # Color gradient: green at full health, yellow at half, red at low
            if health_ratio > 0.6:
                health_color = (int(255 * (1 - health_ratio) * 2.5), 255, 0)  # Green to yellow
            else:
                health_color = (255, int(255 * health_ratio * 1.67), 0)  # Yellow to red

            pygame.draw.rect(screen, health_color,
                             (pos[0] - bar_width // 2, pos[1] - int(10 * zoom), health_width, bar_height))

            # Draw pink dot if pregnant
            dot_offset = 0
            if self.sex == 'F' and pygame.time.get_ticks() < self.gestation_timer:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (255, 105, 180), (dot_x, dot_y), max(2, int(2 * zoom)))
                dot_offset += 8  # space for next dot
            # Draw light blue dot if child (age < 25% max_age)
            if self.age < self.maturity_age:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (135, 206, 250), (dot_x, dot_y), max(2, int(2 * zoom)))
                dot_offset += 8
            # Draw grey dot if geriatric (age > 75% max_age)
            if self.age > self.max_age * 0.75:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (180, 180, 180), (dot_x, dot_y), max(2, int(2 * zoom)))
                dot_offset += 8


# Simple stats display function
def draw_stats(creatures):
    if not creatures:
        return

    # Calculate averages and ranges
    total = len(creatures)
    avg_speed = sum(c.speed for c in creatures) / total
    min_speed = min(c.speed for c in creatures)
    max_speed = max(c.speed for c in creatures)
    avg_vision = sum(c.vision for c in creatures) / total
    min_vision = min(c.vision for c in creatures)
    max_vision = max(c.vision for c in creatures)
    avg_hunger = sum(c.hunger for c in creatures) / total
    min_hunger = min(c.hunger for c in creatures)
    max_hunger = max(c.hunger for c in creatures)
    avg_thirst = sum(c.thirst for c in creatures) / total
    min_thirst = min(c.thirst for c in creatures)
    max_thirst = max(c.thirst for c in creatures)
    avg_health = sum(c.health for c in creatures) / total
    min_health = min(c.health for c in creatures)
    max_health = max(c.health for c in creatures)
    avg_attractiveness = sum(c.attractiveness for c in creatures) / total
    min_attractiveness = min(c.attractiveness for c in creatures)
    max_attractiveness = max(c.attractiveness for c in creatures)
    avg_offspring = sum(c.offspring_count for c in creatures) / total
    min_offspring = min(c.offspring_count for c in creatures)
    max_offspring = max(c.offspring_count for c in creatures)
    avg_aggression = sum(c.aggression for c in creatures) / total
    min_aggression = min(c.aggression for c in creatures)
    max_aggression = max(c.aggression for c in creatures)
    avg_attack = sum(c.attack for c in creatures) / total
    min_attack = min(c.attack for c in creatures)
    max_attack = max(c.attack for c in creatures)
    avg_defense = sum(c.defense for c in creatures) / total
    min_defense = min(c.defense for c in creatures)
    max_defense = max(c.defense for c in creatures)
    # Use global_total_kills instead of recalculating
    total_kills = global_total_kills
    # Average total lifespan and age (in seconds)
    avg_lifespan = sum(c.max_age for c in creatures) / total / 1000
    avg_age = sum(c.age for c in creatures) / total / 1000
    avg_infertility = sum(c.infertility for c in creatures) / total

    # Create stats panel
    stats_text = [
        f"Population: {total}",
        f"Total Kills: {total_kills}",
        f"Avg Lifespan: {avg_lifespan:.1f}s",
        f"Avg Age: {avg_age:.1f}s",
        f"Avg Infertility: {avg_infertility:.1f}",
        f"Avg Speed: {avg_speed:.2f}  (min: {min_speed:.2f}, max: {max_speed:.2f})",
        f"Avg Vision: {avg_vision:.1f}  (min: {min_vision}, max: {max_vision})",
        f"Avg Hunger: {avg_hunger:.1f}  (min: {min_hunger:.1f}, max: {max_hunger:.1f})",
        f"Avg Thirst: {avg_thirst:.1f}  (min: {min_thirst:.1f}, max: {max_thirst:.1f})",
        f"Avg Health: {avg_health:.1f}  (min: {min_health:.1f}, max: {max_health:.1f})",
        f"Avg Attack: {avg_attack:.2f}  (min: {min_attack:.2f}, max: {max_attack:.2f})",
        f"Avg Defense: {avg_defense:.2f}  (min: {min_defense:.2f}, max: {max_defense:.2f})",
        f"Avg Attractiveness: {avg_attractiveness:.2f}  (min: {min_attractiveness:.2f}, max: {max_attractiveness:.2f})",
        f"Avg Offspring: {avg_offspring:.1f}  (min: {min_offspring}, max: {max_offspring})",
        f"Avg Aggression: {avg_aggression:.2f}  (min: {min_aggression:.2f}, max: {max_aggression:.2f})"
    ]
    panel_height = 20 + len(stats_text) * 20
    panel = pygame.Surface((340, panel_height))
    panel.fill((30, 30, 30))

    for i, text in enumerate(stats_text):
        label = FONT.render(text, True, WHITE)
        panel.blit(label, (10, 10 + i * 20))

    return panel


# Game initialization
creatures = [Creature() for _ in range(CREATURE_COUNT)]
foods = [Food() for _ in range(FOOD_COUNT)]
waters = [Water() for _ in range(WATER_COUNT)]
selected_creature = None
show_stats = True

global_total_kills = 0

# Main loop
try:
    running = True
    while running:
        screen.fill(BLACK)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:  # Left click
                    mx, my = pygame.mouse.get_pos()
                    wx, wy = (mx / zoom + camera_offset[0], my / zoom + camera_offset[1])
                    found = False
                    for c in creatures:
                        if math.hypot(c.x - wx, c.y - wy) < CREATURE_RADIUS:
                            selected_creature = c
                            found = True
                            break
                    if not found:
                        selected_creature = None
                elif event.button == 4:  # Scroll up
                    zoom = min(2.5, zoom + zoom_step)
                elif event.button == 5:  # Scroll down
                    zoom = max(0.5, zoom - zoom_step)
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    selected_creature = None
                elif event.key == pygame.K_s:
                    show_stats = not show_stats

        # Handle continuous key presses for camera movement
        keys = pygame.key.get_pressed()
        camera_speed = 5 / zoom  # Adjust speed based on zoom level

        if keys[pygame.K_w] or keys[pygame.K_UP]:
            camera_offset[1] = int(camera_offset[1] - camera_speed)
        if keys[pygame.K_s] or keys[pygame.K_DOWN]:
            camera_offset[1] = int(camera_offset[1] + camera_speed)
        if keys[pygame.K_a] or keys[pygame.K_LEFT]:
            camera_offset[0] = int(camera_offset[0] - camera_speed)
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]:
            camera_offset[0] = int(camera_offset[0] + camera_speed)

        # Update camera to follow selected creature (only if not manually moving)
        if selected_creature and selected_creature in creatures:
            if not (keys[pygame.K_w] or keys[pygame.K_s] or keys[pygame.K_a] or keys[pygame.K_d] or
                    keys[pygame.K_UP] or keys[pygame.K_DOWN] or keys[pygame.K_LEFT] or keys[pygame.K_RIGHT]):
                camera_offset[0] = int(selected_creature.x - screen.get_width() // 2 / zoom)
                camera_offset[1] = int(selected_creature.y - screen.get_height() // 2 / zoom)

        # Update and draw food
        for f in foods:
            f.update()
            f.draw()

        # Update and draw water
        for w in waters:
            w.update()
            w.draw()

        # Update and draw creatures
        for c in creatures[:]:  # Use slice to avoid modification during iteration
            if not c.update(foods, waters, creatures):
                creatures.remove(c)
                if c == selected_creature:
                    selected_creature = None
            else:
                c.draw()

        # Draw selected creature info
        if selected_creature and selected_creature in creatures:
            lines = [
                f"Sex: {selected_creature.sex}",
                f"Age: {int(selected_creature.age/1000)}s / {int(selected_creature.max_age/1000)}s",
                f"Speed: {selected_creature.speed:.2f}",
                f"Vision: {selected_creature.vision}",
                f"Hunger: {selected_creature.hunger:.1f}",
                f"Thirst: {selected_creature.thirst:.1f}",
                f"Health: {selected_creature.health:.1f} / {selected_creature.max_health}",
                f"Attack: {selected_creature.attack:.2f}",
                f"Defense: {selected_creature.defense:.2f}",
                f"Offspring: {selected_creature.offspring_count}",
                f"Attractiveness: {selected_creature.attractiveness:.2f}",
                f"Aggression: {selected_creature.aggression:.2f}",
                f"Kills: {selected_creature.kill_count}",
                f"Infertility: {selected_creature.infertility}"
            ]
            if selected_creature.sex == 'F' and pygame.time.get_ticks() < selected_creature.gestation_timer:
                remaining = max(0, (selected_creature.gestation_timer - pygame.time.get_ticks()) // 1000)
                lines.append(f"Pregnant ({remaining}s left)")
            # Dynamically size panel or allow scrolling if too many lines
            panel_width = 250
            line_height = 15
            max_panel_height = 300
            panel_height = min(max_panel_height, 20 + len(lines) * line_height)
            panel = pygame.Surface((panel_width, panel_height))
            panel.fill((30, 30, 30))
            scroll_offset = 0
            mouse_x, mouse_y = pygame.mouse.get_pos()
            panel_x, panel_y = 10, 10
            if len(lines) * line_height + 20 > max_panel_height:
                # Allow scrolling if mouse is over panel
                if panel_x <= mouse_x <= panel_x + panel_width and panel_y <= mouse_y <= panel_y + panel_height:
                    rel_y = mouse_y - panel_y
                    scroll_area = panel_height - 40
                    if scroll_area > 0:
                        scroll_ratio = rel_y / scroll_area
                        max_scroll = len(lines) * line_height + 20 - max_panel_height
                        scroll_offset = int(scroll_ratio * max_scroll)
            for i, line in enumerate(lines):
                y = 10 + i * line_height - scroll_offset
                if 0 <= y < panel_height - 10:
                    txt = FONT.render(line, True, WHITE)
                    panel.blit(txt, (10, y))
            screen.blit(panel, (panel_x, panel_y))

        # Draw stats panel
        if show_stats:
            stats_panel = draw_stats(creatures)
            if stats_panel is not None:
                screen.blit(stats_panel, (screen.get_width() - 310, 10))

        # Draw instructions
        instructions = [
            "Click: Select creature",
            "ESC: Deselect",
            "S: Toggle stats",
            "WASD/Arrows: Move camera",
            "Mouse wheel: Zoom"
        ]
        for i, instruction in enumerate(instructions):
            text = FONT.render(instruction, True, WHITE)
            screen.blit(text, (10, screen.get_height() - 100 + i * 20))

        pygame.display.flip()
        clock.tick(FPS)
except Exception as e:
    import traceback
    print('Exception in main loop:', e)
    traceback.print_exc()
finally:
    pygame.quit()
    sys.exit()