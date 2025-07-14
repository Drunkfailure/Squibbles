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
from enum import Enum
from mutations import MUTATIONS, apply_mutation_effect, handle_pack_mentality, handle_child_eater, handle_cannibal, handle_immortal, handle_radioactive, handle_pregnancy_hunter, handle_rage_state, handle_fragmented_dna, handle_blood_frenzy, trigger_blood_frenzy, handle_venom_glands, trigger_venom_glands, handle_howler, handle_burrower, handle_photosynthetic_skin, handle_cold_blooded, handle_thermal_core, handle_bioluminescent, handle_twin_gene, handle_loyal_mate, set_loyal_mates, handle_brood_sac, handle_springy_tendons, handle_tail_whip, handle_slippery_skin, handle_hyperaware, handle_paranoia, handle_dominant, handle_cowardly, handle_regen_core, handle_poisonous_blood

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
CREATURE_COUNT = 300
FOOD_COUNT = 500
MAP_WIDTH = 1000
MAP_HEIGHT = 1000
global_total_kills = 0

# Day/night cycle
DAY_LENGTH_MS = 30000  # 30 seconds day
NIGHT_LENGTH_MS = 30000  # 30 seconds night
is_daytime = True
last_cycle_switch = pygame.time.get_ticks()

# Track simulation start time for amnesty
SIM_START_TIME = pygame.time.get_ticks()

# --- Pack tracking ---
pack_registry = {}  # pack_id: set of living member unique_ids
pack_founders = {}  # pack_id: set of original founder unique_ids

def update_day_night():
    global is_daytime, last_cycle_switch
    now = pygame.time.get_ticks()
    if is_daytime and now - last_cycle_switch > DAY_LENGTH_MS:
        is_daytime = False
        last_cycle_switch = now
        # Instantly kill any creature in the part of a pond that overlaps tundra (precise check)
        for c in creatures[:]:
            for pond in ponds:
                if math.hypot(c.x - pond.x, c.y - pond.y) < pond.radius:
                    # Only kill if this spot is tundra
                    if get_biome(c.x, c.y) == Biome.TUNDRA:
                        c.health = 0
                        break
    elif not is_daytime and now - last_cycle_switch > NIGHT_LENGTH_MS:
        is_daytime = True
        last_cycle_switch = now


# Setup menu values (modifies globals)
def show_setup_menu():
    global CREATURE_COUNT, FOOD_COUNT, MAP_WIDTH, MAP_HEIGHT
    print("Evolution Simulation Setup")
    print("(Press Enter for default values)")

    try:
        user_input = input("Number of creatures (1-1000) [300]: ").strip()
        CREATURE_COUNT = max(1, min(1000, int(user_input))) if user_input else 300
    except ValueError:
        CREATURE_COUNT = 300

    try:
        user_input = input("Number of food spawns (1-500) [500]: ").strip()
        FOOD_COUNT = max(1, min(500, int(user_input))) if user_input else 500
    except ValueError:
        FOOD_COUNT = 500

    try:
        user_input = input("Map width (500-2000) [1000]: ").strip()
        MAP_WIDTH = max(500, min(2000, int(user_input))) if user_input else 1000
    except ValueError:
        MAP_WIDTH = 1000

    try:
        user_input = input("Map height (500-2000) [1000]: ").strip()
        MAP_HEIGHT = max(500, min(2000, int(user_input))) if user_input else 1000
    except ValueError:
        MAP_HEIGHT = 1000

    # Reset global kill counter on new simulation
    # Set global_total_kills = 0 at the module level after this function


show_setup_menu()

# Always use default window size
screen = pygame.display.set_mode((DEFAULT_WIDTH, DEFAULT_HEIGHT))
pygame.display.set_caption("Evolution Simulation")
clock = pygame.time.Clock()

# Load day/night icons
sun_icon = pygame.image.load('sun.png')
moon_icon = pygame.image.load('moon.png')
icon_size = 48
sun_icon = pygame.transform.smoothscale(sun_icon, (icon_size, icon_size))
moon_icon = pygame.transform.smoothscale(moon_icon, (icon_size, icon_size))


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

###########################
# Biome definitions & helpers
class Biome(Enum):
    PLAINS = 0
    DESERT = 1
    RAINFOREST = 2
    TUNDRA = 3

def generate_biomes(map_width, map_height, num_biomes=6):
    biomes = []
    biome_map = [[Biome.PLAINS for _ in range(map_width)] for _ in range(map_height)]
    # Randomly decide which biomes will be present (Plains always present)
    possible_biomes = [Biome.PLAINS]
    if random.random() > 0.1:
        possible_biomes.append(Biome.DESERT)
    if random.random() > 0.1:
        possible_biomes.append(Biome.RAINFOREST)
    if random.random() > 0.1:
        possible_biomes.append(Biome.TUNDRA)
    # Distribute weights evenly among present biomes
    weights = [1.0 / len(possible_biomes) for _ in possible_biomes]
    for _ in range(num_biomes):
        bx = random.randint(0, map_width-1)
        by = random.randint(0, map_height-1)
        bradius = random.randint(150, 400)
        btype = random.choices(possible_biomes, weights=weights)[0]
        biomes.append((bx, by, bradius, btype))
        for y in range(max(0, by-bradius), min(map_height, by+bradius)):
            for x in range(max(0, bx-bradius), min(map_width, bx+bradius)):
                if math.hypot(x-bx, y-by) < bradius:
                    biome_map[y][x] = btype
    return biome_map

def get_biome(x, y):
    xi = int(min(max(x, 0), MAP_WIDTH-1))
    yi = int(min(max(y, 0), MAP_HEIGHT-1))
    return biome_map[yi][xi]

# Generate biome map after setup
biome_map = generate_biomes(MAP_WIDTH, MAP_HEIGHT)

# --- Pond generation ---
class Pond:
    def __init__(self, x, y, radius):
        self.x = x
        self.y = y
        self.radius = radius

# Limit number of ponds to a reasonable value based on map size
min_ponds = 2
max_ponds = max(4, min(12, (MAP_WIDTH * MAP_HEIGHT) // 150000))  # e.g., 4-12 for small to large maps
num_ponds = random.randint(min_ponds, max_ponds)
ponds = []
for _ in range(num_ponds):
    # Plains: 60% chance, Rainforest: 25%, Tundra: 10%, Desert: 5%
    while True:
        x = random.randint(0, MAP_WIDTH)
        y = random.randint(0, MAP_HEIGHT)
        biome = get_biome(x, y)
        if biome == Biome.PLAINS and random.random() < 0.6:
            break
        elif biome == Biome.RAINFOREST and random.random() < 0.25:
            break
        elif biome == Biome.TUNDRA and random.random() < 0.1:
            break
        elif biome == Biome.DESERT and random.random() < 0.05:
            break
    radius = random.randint(30, 60)  # Ponds are 30-60px radius
    ponds.append(Pond(x, y, radius))

###########################
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
            size = max(2, int(2 * zoom))
            pygame.draw.rect(screen, (0, 255, 0), (pos[0] - size//2, pos[1] - size//2, size, size))

    def __init__(self):
        super().__init__()
        # Place food based on biome
        placed = False
        for _ in range(10):
            x = random.randint(0, MAP_WIDTH)
            y = random.randint(0, MAP_HEIGHT)
            biome = get_biome(x, y)
            if biome == Biome.DESERT and random.random() < 0.7:
                continue  # Scarce in desert
            if biome == Biome.RAINFOREST and random.random() < 0.7:
                continue  # Plentiful, but not everywhere
            if biome == Biome.TUNDRA and random.random() < 0.4:
                continue  # More plentiful than desert, less than plains
            self.x, self.y = x, y
            self.spawn_x, self.spawn_y = x, y
            placed = True
            break
        if not placed:
            self.x, self.y = random.randint(0, MAP_WIDTH), random.randint(0, MAP_HEIGHT)
            self.spawn_x, self.spawn_y = self.x, self.y


class Creature:
    _id_counter = 1
    def __init__(self, x=None, y=None, hue=None, max_health=None, mutations=None, pack_id=None, pack_color=None):
        self.unique_id = Creature._id_counter
        Creature._id_counter += 1
        self.kill_count = 0
        self.mutations = list(mutations) if mutations else []
        # Make mutations extremely rare: 0.01% chance for a single random mutation
        if not mutations:
            mega_rare_mutations = {
                'Pack mentality', 'Immortal', 'Cannibal', 'Radioactive', 'Ethereal', 'Pregnancy hunter',
                'Fragmented DNA', 'Rage State', 'Blood Frenzy', 'Thermal Core', 'Brood Sac',
                'Color Pulse', 'Parasitic Womb', 'Null Core'
            }
            mutation_choices = list(MUTATIONS.keys())
            # Mega rare: 0.0000001% chance, others: 0.00001% chance
            roll = random.random()
            if roll < 0.000000001:  # 0.0000001% mega rare
                mega_rare = [m for m in mutation_choices if m in mega_rare_mutations]
                if mega_rare:
                    self.mutations = [random.choice(mega_rare)]
            elif roll < 0.0000001:  # 0.00001% for all other mutations
                normal = [m for m in mutation_choices if m not in mega_rare_mutations]
                if normal:
                    self.mutations = [random.choice(normal)]
        self.pack_id = pack_id
        self.pack_color = pack_color
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
        self.max_age = random.randint(300000, 360000)  # ms, 5-6 minutes
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
        self.seeking_mate_direction = random.uniform(0, 2 * math.pi)  # For mate-seeking movement
        self.seeking_resource_direction = random.uniform(0, 2 * math.pi)  # For food/water seeking movement
        self._rage_state = 'none'
        self._rage_timer = 0
        self._rage_cooldown = 0
        self._blood_frenzy = 0
        self._burrowed_until = 0
        self._burrow_cooldown = 0
        self._slippery_flash = False
        self._tailwhip_flash = False
        # --- Mutation state attributes ---
        self.mother_id = None  # For Territorial/offspring logic
        self._parasitic_infecting = False  # For Parasitic Womb
        self._parasitic_hosted_by = None # For Parasitic Womb host
        self._wet_until = 0  # Timestamp until which the creature is wet
        self._last_swim_time = 0
        self._avoid_tundra_until = 0

    def update(self, foods, creatures):
        global global_total_kills
        # Call mutation handlers for per-frame effects
        handle_fragmented_dna(self)
        handle_venom_glands(self)
        burrowed = handle_burrower(self)
        howler_mult = handle_howler(self, creatures)
        rage_attack_mult, rage_speed_mult, rage_aggression_mult = handle_rage_state(self)
        frenzy_attack_mult, frenzy_speed_mult, frenzy_aggression_mult = handle_blood_frenzy(self)
        attack_mult = rage_attack_mult * frenzy_attack_mult
        speed_mult = rage_speed_mult * frenzy_speed_mult
        aggression_mult = rage_aggression_mult * frenzy_aggression_mult * howler_mult
        # Loyal Mate: stat boost and mate following
        loyal_mult, mate_target = handle_loyal_mate(self, creatures)
        # Age update
        self.age += clock.get_time()  # ms per frame
        # Age scaling factor
        age_pct = self.age / self.max_age
        if age_pct < 0.10:
            age_factor = 0.75 + 0.25 * (age_pct / 0.10)
        elif age_pct > 0.90:
            age_factor = 1.0 - 0.5 * ((age_pct - 0.90) / 0.10)
            age_factor = max(0.5, age_factor)
        else:
            age_factor = 1.0
        # Pregnant check
        is_pregnant = self.sex == 'F' and pygame.time.get_ticks() < self.gestation_timer
        # Bioluminescent: boost attractiveness at night, get glow color
        biolum_mult, biolum_color = handle_bioluminescent(self, is_daytime)
        # Rainforest and Tundra movement/vision penalty
        biome = get_biome(self.x, self.y)
        biome_speed_penalty = 1.0
        biome_vision_penalty = 1.0
        if biome == Biome.RAINFOREST:
            biome_speed_penalty = 0.5  # Half speed in rainforest
        if biome == Biome.TUNDRA:
            biome_speed_penalty = 0.7  # 30% slower in tundra
            biome_vision_penalty = 0.7  # 30% less vision in tundra
        # --- Pond movement penalty ---
        in_pond = any(math.hypot(self.x - pond.x, self.y - pond.y) < pond.radius for pond in ponds)
        in_frozen_pond = False
        if in_pond and not is_daytime:
            for pond in ponds:
                if math.hypot(self.x - pond.x, self.y - pond.y) < pond.radius:
                    if get_biome(self.x, self.y) == Biome.TUNDRA:
                        in_frozen_pond = True
                        # Do NOT kill if walking onto frozen pond after nightfall
                        break
        if in_pond and not in_frozen_pond:
            biome_speed_penalty *= 0.5  # 50% slower in pond
        # Hyperaware: double vision, flee from threats
        hyperaware_mult, hyperaware_threat = handle_hyperaware(self, creatures)
        # Paranoia: flee from any non-pack, non-mate creature
        paranoia_threat = handle_paranoia(self, creatures)
        # Drain hunger and thirst
        drain_multiplier = 1.0
        speed_modifier = 1.0
        if is_pregnant:
            drain_multiplier = 1.3  # 30% faster drain when pregnant
            speed_modifier = 1/1.5  # 1.5x slower
        BASE_HUNGER_DRAIN = 0.02  # Tune as needed
        BASE_THIRST_DRAIN = 0.025  # Tune as needed
        self.hunger -= BASE_HUNGER_DRAIN * drain_multiplier * self.speed
        self.thirst -= BASE_THIRST_DRAIN * drain_multiplier * self.speed
        # Apply age scaling to stats
        effective_attack = self.attack * age_factor * attack_mult * loyal_mult
        effective_defense = self.defense * age_factor * loyal_mult
        effective_attractiveness = self.attractiveness * age_factor * biolum_mult * loyal_mult
        effective_aggression = self.aggression * age_factor * aggression_mult * loyal_mult
        effective_speed = self.speed * age_factor * speed_modifier * biome_speed_penalty * speed_mult * loyal_mult
        effective_vision = self.vision * age_factor * biome_vision_penalty * loyal_mult * hyperaware_mult
        # Flee logic for Hyperaware/Paranoia
        flee_from = hyperaware_threat or paranoia_threat
        if flee_from is not None:
            dx, dy = self.x - flee_from.x, self.y - flee_from.y
            dist = math.hypot(dx, dy)
            if dist > 0:
                self.x += (dx / dist) * effective_speed
                self.y += (dy / dist) * effective_speed
            self.x = max(0, min(MAP_WIDTH, self.x))
            self.y = max(0, min(MAP_HEIGHT, self.y))
            return True
        # Remove creature if health is zero or below
        if self.health <= 0:
            return False
        # If burrowed, skip movement, attacking, and make invulnerable
        if burrowed:
            # Visual effect and stat update only
            self.x = max(0, min(MAP_WIDTH, self.x))
            self.y = max(0, min(MAP_HEIGHT, self.y))
            # Still drain hunger/thirst, age, and allow eating/reproducing
            self.eat(foods)
            self.reproduce(creatures, age_factor=age_factor)
            handle_pack_mentality(self, creatures, get_biome)
            return True
        # Find targets (use effective_vision)
        food_target = self.find_nearest(foods, vision_override=effective_vision)
        pond_target = self.find_nearest_pond(ponds, vision_override=effective_vision) if self.thirst < 70 else None
        target = None
        # If hungry or thirsty, seek food or pond and do not move randomly
        if self.hunger < 70 or self.thirst < 70:
            if self.hunger < self.thirst and food_target:
                target = food_target
            elif pond_target:
                target = pond_target
            elif food_target:
                target = food_target
            else:
                # Move in a persistent direction while seeking food/water
                self.x += math.cos(self.seeking_resource_direction) * effective_speed
                self.y += math.sin(self.seeking_resource_direction) * effective_speed
                # If at map edge, change direction
                hit_edge = False
                if self.x <= 0 or self.x >= MAP_WIDTH:
                    hit_edge = True
                if self.y <= 0 or self.y >= MAP_HEIGHT:
                    hit_edge = True
                if hit_edge or random.random() < 0.01:
                    self.seeking_resource_direction = random.uniform(0, 2 * math.pi)
                # Clamp to map bounds
                self.x = max(0, min(MAP_WIDTH, self.x))
                self.y = max(0, min(MAP_HEIGHT, self.y))
                return True
        # If well-nourished, seek a mate
        elif self.hunger >= 70 and self.thirst >= 70:
            # Rage State: prioritize attacking during rage
            if hasattr(self, '_rage_state') and self._rage_state == 'rage':
                pass  # skip mate seeking, will attack below
            else:
                mate_target = None
                for other in creatures:
                    if other is self or {self.sex, other.sex} != {'M', 'F'}:
                        continue
                    if other.hunger < 70 or other.thirst < 70:
                        continue
                    if self.sex == 'M' and pygame.time.get_ticks() < other.gestation_timer:
                        continue
                    if self.attractiveness * age_factor < other.threshold or other.attractiveness * age_factor < self.threshold:
                        continue
                    other_age_pct = other.age / other.max_age
                    if other_age_pct < 0.25 or other_age_pct > 0.75:
                        continue
                    if math.hypot(other.x - self.x, other.y - self.y) <= effective_vision:
                        mate_target = other
                        break
                if mate_target:
                    target = mate_target
                else:
                    # Move in a persistent direction while seeking mate
                    self.x += math.cos(self.seeking_mate_direction) * effective_speed
                    self.y += math.sin(self.seeking_mate_direction) * effective_speed
                    # Occasionally change direction slightly for exploration
                    if random.random() < 0.01:
                        self.seeking_mate_direction += random.uniform(-0.5, 0.5)
                    # If at map edge, change direction
                    hit_edge = False
                    if self.x <= 0 or self.x >= MAP_WIDTH:
                        hit_edge = True
                    if self.y <= 0 or self.y >= MAP_HEIGHT:
                        hit_edge = True
                    if hit_edge:
                        self.seeking_mate_direction = random.uniform(0, 2 * math.pi)
                    # Clamp to map bounds
                    self.x = max(0, min(MAP_WIDTH, self.x))
                    self.y = max(0, min(MAP_HEIGHT, self.y))
                    return True
        # If loyal mate, bias movement toward mate if not close
        if mate_target is not None:
            dx, dy = mate_target.x - self.x, mate_target.y - self.y
            dist = math.hypot(dx, dy)
            if dist > 0:
                self.x += (dx / dist) * effective_speed * 0.5  # Move halfway toward mate
                self.y += (dy / dist) * effective_speed * 0.5
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
                if age_pct < 0.10:
                    dx, dy = self.x - c.x, self.y - c.y
                    dist = math.hypot(dx, dy)
                    if dist > 0:
                        self.x += (dx / dist) * effective_speed
                        self.y += (dy / dist) * effective_speed
                    contested = True
                    break
                # Ethereal creatures cannot attack or be attacked
                if "Ethereal" in self.mutations or "Ethereal" in c.mutations:
                    contested = True
                    break
                # Burrowed creatures cannot be attacked
                if hasattr(c, '_burrowed_until') and getattr(c, '_burrowed_until', 0) > pygame.time.get_ticks():
                    contested = True
                    break
                # Slippery Skin: 50% chance to evade
                if handle_slippery_skin(c):
                    contested = True
                    break
                # Dominant: boost attack/defense if fighting non-dominant
                dom_attack_mult, dom_def_mult = handle_dominant(self, c)
                dom_attack_mult2, dom_def_mult2 = handle_dominant(c, self)
                dom_attack = effective_attack * dom_attack_mult
                dom_defense = c.defense * dom_def_mult2
                damage = max(0, dom_attack - dom_defense)
                if damage > 0:
                    was_alive = c.health > 0
                    c.health -= damage
                    if was_alive and c.health <= 0:
                        self.kill_count += 1
                        global_total_kills += 1
                        handle_cannibal(self, c)
                        trigger_blood_frenzy(self)
                    # Venom Glands: poison the target
                    trigger_venom_glands(self, c)
                    # Tail Whip retaliation
                    handle_tail_whip(c, self)
                    # Poisonous Blood retaliation
                    handle_poisonous_blood(c, self)
                    # Bone Spikes retaliation
                    if "Bone Spikes" in c.mutations and self.health > 0 and "Ethereal" not in self.mutations:
                        self.health -= 2
                else:
                    if random.random() < c.aggression:
                        retaliation = max(0, c.attack - effective_defense)
                        if retaliation > 0:
                            was_alive = self.health > 0
                            self.health -= retaliation
                            if was_alive and self.health <= 0:
                                c.kill_count += 1
                                global_total_kills += 1
                                print(f"Random attack retaliation! {c.sex} killed {self.sex}. Total kills: {global_total_kills}")
                                handle_cannibal(c, self)
                                trigger_blood_frenzy(c)
                            # Venom Glands: poison the target
                            trigger_venom_glands(c, self)
                            # Tail Whip retaliation
                            handle_tail_whip(self, c)
                            # Poisonous Blood retaliation
                            handle_poisonous_blood(self, c)
                            # Bone Spikes retaliation
                            if "Bone Spikes" in self.mutations and c.health > 0 and "Ethereal" not in c.mutations:
                                c.health -= 2
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
        
        # Random attacks based on aggression (independent of resource competition)
        self.random_attack(creatures, effective_aggression, effective_attack, effective_defense)
        
        # Eat and drink (always allow if hungry/thirsty, regardless of mutation logic)
        if self.hunger < 100:
            self.eat(foods)
        if self.thirst < 100:
            self.drink_from_pond(ponds)
        self.reproduce(creatures, age_factor=age_factor)
        handle_pack_mentality(self, creatures, get_biome)
        # Clamp health, hunger, and thirst to a minimum of zero after all effects
        self.health = max(0, self.health)
        self.hunger = max(0, self.hunger)
        self.thirst = max(0, self.thirst)
        return True

    def move_random(self, speed_override=None):
        angle = random.uniform(0, 2 * math.pi)
        speed_mod = speed_override if speed_override is not None else self.speed
        # Springy Tendons: jump
        _, springy_jump = handle_springy_tendons(self)
        if springy_jump:
            speed_mod *= 2
        self.x += math.cos(angle) * speed_mod
        self.y += math.sin(angle) * speed_mod

    def move_toward(self, target, speed_override=None):
        dx, dy = target.x - self.x, target.y - self.y
        dist = math.hypot(dx, dy)
        if dist > 0:
            speed_mod = speed_override if speed_override is not None else self.speed
            # Springy Tendons: jump
            _, springy_jump = handle_springy_tendons(self)
            if springy_jump:
                speed_mod *= 2
            self.x += (dx / dist) * speed_mod
            self.y += (dy / dist) * speed_mod

    def find_nearest(self, items, vision_override=None):
        vision = vision_override if vision_override is not None else self.vision
        visible = [i for i in items if i.active and math.hypot(i.x - self.x, i.y - self.y) <= vision]
        return min(visible, key=lambda i: math.hypot(i.x - self.x, i.y - self.y), default=None)

    def find_nearest_pond(self, ponds, vision_override=None):
        vision = vision_override if vision_override is not None else self.vision
        # Prefer edge of pond (within 10px of edge)
        candidates = []
        for p in ponds:
            dist = math.hypot(p.x - self.x, p.y - self.y)
            if dist <= vision + p.radius:
                edge_dist = abs(dist - p.radius)
                candidates.append((edge_dist, dist, p))
        if not candidates:
            return None
        # Prefer edge (edge_dist close to 0), then closest
        candidates.sort(key=lambda tup: (tup[0], tup[1]))
        return candidates[0][2]

    def random_attack(self, creatures, effective_aggression, effective_attack, effective_defense):
        global global_total_kills
        # Amnesty: no random attacks for first 2 minutes
        now = pygame.time.get_ticks()
        if now - SIM_START_TIME < 120000:
            return
        """Randomly attack nearby creatures based on aggression level"""
        # Skip if this creature is a child or pregnant
        age_pct = self.age / self.max_age
        if age_pct < 0.10:
            return
        # Check for nearby creatures to attack
        for other in creatures:
            if other is self:
                continue
            # Ethereal creatures cannot attack or be attacked
            if "Ethereal" in self.mutations or "Ethereal" in other.mutations:
                continue
            # Burrowed creatures cannot be attacked
            if hasattr(other, '_burrowed_until') and getattr(other, '_burrowed_until', 0) > pygame.time.get_ticks():
                continue
            # Slippery Skin: 50% chance to evade
            if handle_slippery_skin(other):
                continue
            # Calculate distance to other creature
            distance = math.hypot(other.x - self.x, other.y - self.y)
            # Only attack if within attack range (vision radius)
            if distance <= self.vision:
                # Chance to attack based on aggression level
                attack_chance = effective_aggression * 0.1  # 10% of aggression level per frame
                if random.random() < attack_chance:
                    # Attempt attack
                    damage = max(0, effective_attack - other.defense)
                    if damage > 0:
                        was_alive = other.health > 0
                        other.health -= damage
                        if was_alive and other.health <= 0:
                            self.kill_count += 1
                            global_total_kills += 1
                            print(f"Random attack kill! {self.sex} killed {other.sex}. Total kills: {global_total_kills}")
                            handle_cannibal(self, other)
                            trigger_blood_frenzy(self)
                        # Venom Glands: poison the target
                        trigger_venom_glands(self, other)
                        # Tail Whip retaliation
                        handle_tail_whip(other, self)
                        # Poisonous Blood retaliation
                        handle_poisonous_blood(other, self)
                        # Bone Spikes retaliation
                        if "Bone Spikes" in other.mutations and self.health > 0 and "Ethereal" not in self.mutations:
                            self.health -= 2
                    else:
                        # If attack fails, other creature might retaliate
                        if random.random() < other.aggression:  # 20% of other's aggression
                            retaliation = max(0, other.attack - effective_defense)
                            if retaliation > 0:
                                was_alive = self.health > 0
                                self.health -= retaliation
                                if was_alive and self.health <= 0:
                                    other.kill_count += 1
                                    global_total_kills += 1
                                    print(f"Random attack retaliation! {other.sex} killed {self.sex}. Total kills: {global_total_kills}")
                                    handle_cannibal(other, self)
                                    trigger_blood_frenzy(other)
                                # Venom Glands: poison the target
                                trigger_venom_glands(other, self)
                                # Tail Whip retaliation
                                handle_tail_whip(self, other)
                                # Poisonous Blood retaliation
                                handle_poisonous_blood(self, other)
                                # Bone Spikes retaliation
                                if "Bone Spikes" in self.mutations and other.health > 0 and "Ethereal" not in other.mutations:
                                    other.health -= 2

    def eat(self, foods):
        for food in foods:
            if food.active and math.hypot(food.x - self.x, food.y - self.y) < CREATURE_RADIUS:
                self.hunger = min(100, self.hunger + FOOD_VALUE)
                self.health = min(self.max_health, self.health + 5)
                food.consume()
                break

    def drink_from_pond(self, ponds):
        global global_total_kills
        now = pygame.time.get_ticks()
        for pond in ponds:
            dist = math.hypot(pond.x - self.x, pond.y - self.y)
            if dist < pond.radius:
                self.thirst = min(100, self.thirst + WATER_VALUE)
                self.health = min(self.max_health, self.health + 5)
                # Mark as wet for 30s if not just at the edge
                if dist < pond.radius - 10:
                    self._wet_until = now + 30000
                    self._last_swim_time = now
                # Aggression at watering hole: 20% chance to attack another creature in pond
                if random.random() < 0.2:
                    others = [c for c in creatures if c is not self and math.hypot(c.x - pond.x, c.y - pond.y) < pond.radius]
                    if others:
                        target = random.choice(others)
                        damage = max(0, self.attack - target.defense)
                        if damage > 0:
                            was_alive = target.health > 0
                            target.health -= damage
                            if was_alive and target.health <= 0:
                                self.kill_count += 1
                                global_total_kills += 1
                                from mutations import handle_cannibal, trigger_blood_frenzy
                                handle_cannibal(self, target)
                                trigger_blood_frenzy(self)
                break

    def reproduce(self, creatures, age_factor=1.0):
        # Prevent reproduction for bottom/top 10% of age
        age_pct = self.age / self.max_age
        if age_pct < 0.10 or age_pct > 0.90:
            return
        if self.sex == 'F' and (pygame.time.get_ticks() < self.gestation_timer or self.pending_offspring):
            return
        # Prevent pregnancy if gestation duration is longer than remaining lifespan after maturity
        if self.sex == 'F':
            time_left = self.max_age - self.age
            if self.gestation_duration > time_left:
                return
        if self.hunger < 50 or self.thirst < 50:
            return
        for other in creatures:
            if other is self or {self.sex, other.sex} != {'M', 'F'}:
                continue
            if other.hunger < 50 or other.thirst < 50:
                continue
            if self.attractiveness * age_factor < other.threshold or other.attractiveness * age_factor < self.threshold:
                continue
            other_age_pct = other.age / other.max_age
            if other_age_pct < 0.10 or other_age_pct > 0.90:
                continue
            if math.hypot(other.x - self.x, other.y - self.y) < CREATURE_RADIUS * 2:
                mother, father = (self, other) if self.sex == 'F' else (other, self)
                # Infertility check
                infertility_chance = (mother.infertility + father.infertility) / 4
                if random.uniform(0, 100) < infertility_chance:
                    # Mating fails
                    return
                # Prevent breeding between creatures with "Pack mentality" if they are in different packs
                if "Pack mentality" in self.mutations and "Pack mentality" in other.mutations:
                    if hasattr(self, 'pack_id') and hasattr(other, 'pack_id'):
                        if self.pack_id != other.pack_id:
                            continue  # Only breed within the same pack
                # Twin Gene: double offspring, skip cost if present
                base_offspring = mother.offspring_count
                offspring_count, skip_cost = handle_twin_gene(mother, father, base_offspring)
                # Brood Sac: increase offspring, gestation=0 if present
                offspring_count, brood_gestation = handle_brood_sac(mother, offspring_count)
                mother.pending_offspring.append((father, offspring_count))
                # Cost scales with offspring count, applied to both parents
                if not skip_cost:
                    cost = offspring_count * 10  # 10 units per offspring (adjust as needed)
                    mother.hunger = max(0, mother.hunger - cost)
                    mother.thirst = max(0, mother.thirst - cost)
                    father.hunger = max(0, father.hunger - cost)
                    father.thirst = max(0, father.thirst - cost)
                # Loyal Mate: assign mates and halve gestation time
                if "Loyal Mate" in mother.mutations or "Loyal Mate" in father.mutations:
                    set_loyal_mates(mother, father)
                    mother.gestation_duration = max(1000, mother.gestation_duration // 2)
                # Brood Sac: gestation is 0 (spawn immediately)
                if brood_gestation == 0:
                    mother.gestation_timer = pygame.time.get_ticks()  # Immediate birth
                else:
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

        # Inherit mutations
        child_mutations = set(self.mutations)
        if "Pack mentality" in self.mutations or "Pack mentality" in partner.mutations:
            child_mutations.add("Pack mentality")
        # Fragmented DNA: extra mutation gain/loss for offspring
        fragmented = "Fragmented DNA" in self.mutations or "Fragmented DNA" in partner.mutations
        mega_rare_mutations = {
            'Pack mentality', 'Immortal', 'Cannibal', 'Radioactive', 'Ethereal', 'Pregnancy hunter',
            'Fragmented DNA', 'Rage State', 'Blood Frenzy', 'Thermal Core', 'Brood Sac',
            'Color Pulse', 'Parasitic Womb', 'Null Core'
        }
        mutation_choices = list(MUTATIONS.keys())
        # Mega rare: 0.0000001% chance, others: 0.00001% chance
        roll = random.random()
        if roll < 0.000000001:  # 0.0000001% mega rare
            mega_rare = [m for m in mutation_choices if m in mega_rare_mutations and m not in child_mutations]
            if mega_rare:
                child_mutations.add(random.choice(mega_rare))
        elif roll < 0.0000001:  # 0.00001% for all other mutations
            normal = [m for m in mutation_choices if m not in mega_rare_mutations and m not in child_mutations]
            if normal:
                child_mutations.add(random.choice(normal))
        # Child starts with no pack_id (will form/join on its own)
        child = Creature(x=self.x, y=self.y, hue=mutate(hue_avg, 0.1), max_health=child_max_health, mutations=child_mutations)
        if hasattr(child, 'pack_id'):
            child.pack_id = None
        if hasattr(child, 'pack_color'):
            child.pack_color = None

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
        child.max_age = max(300000, min(360000, child.max_age))  # Clamp to 5-6 minutes
        child.maturity_age = int(child.max_age * 0.25)
        child.infertility = max(1, min(100, int(mutate((self.infertility + partner.infertility) / 2, 0.1))))
        child.age = 0  # Ensure offspring start as children
        return child

    def draw(self):
        pos = world_to_screen(self.x, self.y)
        biolum_color = None
        if "Bioluminescent" in self.mutations:
            _, biolum_color = handle_bioluminescent(self, is_daytime)
        # Only draw if on screen
        if -CREATURE_RADIUS <= pos[0] <= screen.get_width() + CREATURE_RADIUS and \
                -CREATURE_RADIUS <= pos[1] <= screen.get_height() + CREATURE_RADIUS:
            # Draw glowing outline for pack members
            if hasattr(self, 'pack_id') and self.pack_id is not None and self.pack_color is not None:
                for glow_radius in range(int(CREATURE_RADIUS * 2.5 * zoom), int(CREATURE_RADIUS * 1.5 * zoom), -2):
                    alpha = max(30, 120 - (glow_radius - int(CREATURE_RADIUS * 1.5 * zoom)) * 10)
                    glow_surf = pygame.Surface((glow_radius*2, glow_radius*2), pygame.SRCALPHA)
                    pygame.draw.circle(glow_surf, self.pack_color + (alpha,), (glow_radius, glow_radius), glow_radius)
                    screen.blit(glow_surf, (pos[0] - glow_radius, pos[1] - glow_radius), special_flags=pygame.BLEND_RGBA_ADD)
            # Ethereal visual: semi-transparent overlay
            if "Ethereal" in self.mutations:
                ethereal_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(ethereal_surf, self.color + (120,), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(ethereal_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
            # Blood Frenzy visual: red glow
            elif hasattr(self, '_blood_frenzy') and self._blood_frenzy > pygame.time.get_ticks():
                frenzy_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(frenzy_surf, (255,30,30,160), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(frenzy_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * 1.5 * zoom))
            # Rage State visual: red overlay during rage
            elif hasattr(self, '_rage_state') and self._rage_state == 'rage':
                rage_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(rage_surf, (255,0,0,120), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(rage_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * 1.5 * zoom))
            # Burrower visual: brown overlay if burrowed
            elif hasattr(self, '_burrowed_until') and self._burrowed_until > pygame.time.get_ticks():
                burrow_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(burrow_surf, (139,69,19,120), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(burrow_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * 1.5 * zoom))
            # Bioluminescent visual: colored glow at night
            elif biolum_color is not None:
                biolum_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(biolum_surf, biolum_color + (120,), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(biolum_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * 1.5 * zoom))
            # --- Parasitic Womb host visual: parasite.png icon above health bar ---
            if hasattr(self, '_parasitic_hosted_by') and self._parasitic_hosted_by:
                if not hasattr(self, '_parasite_icon'):
                    self._parasite_icon = pygame.image.load('parasite.png')
                    self._parasite_icon = pygame.transform.smoothscale(self._parasite_icon, (20, 20))
                icon_x = pos[0] - 10  # Centered above health bar
                icon_y = pos[1] - int(10 * zoom) - 24  # Above health bar
                screen.blit(self._parasite_icon, (icon_x, icon_y))
            # Slippery Skin visual: blue flash
            if hasattr(self, '_slippery_flash') and self._slippery_flash:
                flash_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(flash_surf, (80,200,255,180), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(flash_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                self._slippery_flash = False
            # Tail Whip visual: magenta flash
            if hasattr(self, '_tailwhip_flash') and self._tailwhip_flash:
                flash_surf = pygame.Surface((int(CREATURE_RADIUS*3*zoom), int(CREATURE_RADIUS*3*zoom)), pygame.SRCALPHA)
                pygame.draw.circle(flash_surf, (255,0,255,180), (int(CREATURE_RADIUS*1.5*zoom), int(CREATURE_RADIUS*1.5*zoom)), int(CREATURE_RADIUS*1.5*zoom))
                screen.blit(flash_surf, (pos[0] - int(CREATURE_RADIUS*1.5*zoom), pos[1] - int(CREATURE_RADIUS*1.5*zoom)))
                self._tailwhip_flash = False
            else:
                pygame.draw.circle(screen, self.color, pos, int(CREATURE_RADIUS * 1.5 * zoom))

            # Draw health bar
            bar_width = int(20 * zoom)
            bar_height = max(1, int(3 * zoom))

            # Health bar (green to red gradient based on health)
            health_ratio = self.health / self.max_health if self.max_health > 0 else 0
            health_width = int(bar_width * health_ratio)

            # Color gradient: green at full health, yellow at half, red at low
            if health_ratio > 0.6:
                r = int(255 * (1 - health_ratio) * 2.5)
                g = 255
                b = 0
                health_color = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))  # Green to yellow
            else:
                r = 255
                g = int(255 * health_ratio * 1.67)
                b = 0
                health_color = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))  # Yellow to red

            pygame.draw.rect(screen, health_color,
                             (pos[0] - bar_width // 2, pos[1] - int(10 * zoom), health_width, bar_height))

            # Draw pink dot if pregnant
            dot_offset = 0
            if self.sex == 'F' and pygame.time.get_ticks() < self.gestation_timer:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (255, 105, 180), (dot_x, dot_y), max(3, int(3 * zoom)))
                dot_offset += 10  # space for next dot
            # Draw light blue dot if child (age < 10% max_age)
            if self.age / self.max_age < 0.10:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (135, 206, 250), (dot_x, dot_y), max(3, int(3 * zoom)))
                dot_offset += 10
            # Draw grey dot if geriatric (age > 90% max_age)
            if self.age / self.max_age > 0.90:
                dot_x = pos[0] + bar_width // 2 + 4 + dot_offset
                dot_y = pos[1] - int(10 * zoom) + bar_height // 2
                pygame.draw.circle(screen, (180, 180, 180), (dot_x, dot_y), max(3, int(3 * zoom)))
                dot_offset += 10


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
selected_creature = None
show_stats = True

# Main loop
try:
    running = True
    while running:
        screen.fill(BLACK)
        update_day_night()

        # Draw biome visualization
        biome_colors = {
            Biome.PLAINS: (0, 255, 0, 60),        # Light green
            Biome.DESERT: (255, 255, 0, 60),      # Yellow
            Biome.RAINFOREST: (0, 100, 0, 80),    # Dark green
            Biome.TUNDRA: (255, 255, 255, 80),    # White
        }
        biome_surface = pygame.Surface((MAP_WIDTH, MAP_HEIGHT), pygame.SRCALPHA)
        for y in range(0, MAP_HEIGHT, 10):
            for x in range(0, MAP_WIDTH, 10):
                biome = get_biome(x, y)
                color = biome_colors[biome]
                pygame.draw.rect(biome_surface, color, (x, y, 10, 10))
        # Draw ponds on biome surface
        for pond in ponds:
            # Draw normal pond
            pygame.draw.circle(biome_surface, (0, 120, 255, 180), (pond.x, pond.y), pond.radius)
            # At night, overlay frozen area for tundra-overlapping parts
            if not is_daytime:
                # Draw frozen overlay only where pond overlaps tundra
                frozen_overlay = pygame.Surface((pond.radius*2, pond.radius*2), pygame.SRCALPHA)
                for fy in range(pond.radius*2):
                    for fx in range(pond.radius*2):
                        wx = pond.x - pond.radius + fx
                        wy = pond.y - pond.radius + fy
                        if 0 <= wx < MAP_WIDTH and 0 <= wy < MAP_HEIGHT:
                            if math.hypot(wx - pond.x, wy - pond.y) < pond.radius:
                                if get_biome(wx, wy) == Biome.TUNDRA:
                                    frozen_overlay.set_at((fx, fy), (180, 240, 255, 180))  # Light blue/white
                biome_surface.blit(frozen_overlay, (pond.x - pond.radius, pond.y - pond.radius), special_flags=pygame.BLEND_RGBA_ADD)
        # Blit biome surface with camera/zoom
        surf = pygame.transform.smoothscale(biome_surface, (int(MAP_WIDTH * zoom), int(MAP_HEIGHT * zoom)))
        screen.blit(surf, (-int(camera_offset[0] * zoom), -int(camera_offset[1] * zoom)))

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

        # Update and draw creatures
        for c in creatures[:]:  # Use slice to avoid modification during iteration
            if not c.update(foods, creatures):
                creatures.remove(c)
                if c == selected_creature:
                    selected_creature = None
            else:
                c.draw()
            # Always check for all mutation behaviors
            handle_child_eater(c, creatures)
            handle_pack_mentality(c, creatures, get_biome, foods)
            handle_radioactive(c, creatures)
            handle_pregnancy_hunter(c, creatures)
            # Regen Core: heal if not poisoned
            handle_regen_core(c)
            # Cowardly: always flee, set aggression to 0
            cowardly_threat = handle_cowardly(c, creatures)
            if cowardly_threat is not None:
                dx, dy = c.x - cowardly_threat.x, c.y - cowardly_threat.y
                dist = math.hypot(dx, dy)
                if dist > 0:
                    c.x += (dx / dist) * c.speed
                    c.y += (dy / dist) * c.speed
                c.x = max(0, min(MAP_WIDTH, c.x))
                c.y = max(0, min(MAP_HEIGHT, c.y))
                c.aggression = 0 # Set aggression to 0 when fleeing

        # --- Birth logic: process pending_offspring when gestation ends ---
        for c in creatures:
            if c.sex == 'F' and c.pending_offspring and pygame.time.get_ticks() >= c.gestation_timer:
                for father, count in c.pending_offspring:
                    for _ in range(count):
                        child = c.make_offspring(father)
                        creatures.append(child)
                c.pending_offspring.clear()

        # Draw selected creature info
        if selected_creature and selected_creature in creatures:
            lines = [
                f"ID: {selected_creature.unique_id}",
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
            # Add mutations to the stat panel
            lines.append(f"Mutations: {', '.join(selected_creature.mutations) if selected_creature.mutations else 'None'}")
            # Add pack status to the stat panel
            if hasattr(selected_creature, 'pack_id') and selected_creature.pack_id is not None:
                lines.append(f"Pack: True (ID: {selected_creature.pack_id})")
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

        # Draw day/night icon in bottom right corner
        icon_x = screen.get_width() - icon_size - 20
        icon_y = screen.get_height() - icon_size - 40
        if is_daytime:
            screen.blit(sun_icon, (icon_x, icon_y))
            label = BIG_FONT.render('Day', True, (255, 255, 100))
        else:
            screen.blit(moon_icon, (icon_x, icon_y))
            label = BIG_FONT.render('Night', True, (255, 255, 180))
        screen.blit(label, (icon_x + icon_size//2 - label.get_width()//2, icon_y + icon_size + 2))

        # Draw instructions
        instructions = [
            f"Time: {'Day' if is_daytime else 'Night'}",
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