# mutations.py
import random
import math

MUTATIONS = {
    "Extra Arms": {"attack": +2, "aggression": +5},
    "No arms": {"attack": -2, "aggression": -5},
    "Extra legs": {"speed": 10},
    "Dwarf Legs": {"speed": -10},
    "Extra Eyes": {"vision": "double"},
    "Blurry eyes": {"vision": -20},
    "Scales": {"defense": +1},
    "Squishy Skin": {"defense": -2},
    "Better Lungs": {"max_health": 10},
    "Malformed Lungs": {"max_health": -10},
    "Fertile": {"infertility": -15, "offspring_count": +1},
    "Infertile": {"infertility": +15, "offspring_count": -1},
    "Attractive": {"attractiveness": +0.3},
    "UnAttractive": {"attractiveness": -0.3},
    "Pack mentality": {},
    "Child Eater": {},
    "Cannibal": {},
    "Immortal": {},
    "Radioactive": {},
    "Ethereal": {"infertility": +50},
    "Pregnancy hunter": {},
    "Fragmented DNA": {},
    "Bone Spikes": {"attack": 2},
    "Rage State": {},
    "Blood Frenzy": {},
    "Venom Glands": {},
    "Howler": {},
    "Burrower": {},
    "Photosynthetic Skin": {},
    "Cold-Blooded": {},
    "Thermal Core": {},
    "Bioluminescent": {},
    "Twin Gene": {},
    "Loyal Mate": {},
    "Brood Sac": {},
    "Springy Tendons": {},
    "Tail Whip": {},
    "Slippery Skin": {},
    "Stone Skin": {"defense": 5, "speed": -0.15},
    "Hyperaware": {},
    "Paranoia": {},
    "Dominant": {},
    "Cowardly": {},
    "Glass Bones": {"defense": -3, "speed": 3},
    "Regen Core": {},
    "Poisonous Blood": {},
    "Territorial": {},
    "Shimmering Hide": {"attractiveness": 0.5},
    "Unsettling Gaze": {"attractiveness": -0.3},
    "Color Pulse": {"vision": 5},
    "Null Core": {},
    "Parasitic Womb": {},
}

# Pack management
pack_counter = 1
packs = {}

class Pack:
    def __init__(self, home_biome):
        global pack_counter
        self.id = pack_counter
        pack_counter += 1
        self.members = []
        self.home_biome = home_biome
        self.foraging = False
        self.pack_color = tuple(random.randint(100, 255) for _ in range(3))

    def add_member(self, creature):
        if creature not in self.members and len(self.members) < 10:
            self.members.append(creature)
            creature.pack_id = self.id
            creature.pack_color = self.pack_color

    def remove_member(self, creature):
        if creature in self.members:
            self.members.remove(creature)
            creature.pack_id = None
            creature.pack_color = None

# Apply stat mutations
def apply_mutation_effect(creature, mut):
    eff = MUTATIONS[mut]
    for k, v in eff.items():
        if k == "attack":
            creature.attack += v
        elif k == "aggression":
            creature.aggression += v / 100 if abs(v) > 1 else v
        elif k == "speed":
            creature.speed += v
        elif k == "vision":
            if v == "double":
                creature.vision *= 2
            else:
                creature.vision += v
        elif k == "defense":
            creature.defense += v
        elif k == "max_health":
            creature.max_health += v
            creature.health = min(creature.health, creature.max_health)
        elif k == "infertility":
            creature.infertility += v
        elif k == "offspring_count":
            creature.offspring_count += v
        elif k == "attractiveness":
            creature.attractiveness += v
    # Clamp stats
    creature.speed = max(0.1, creature.speed)
    creature.vision = max(1, creature.vision)
    creature.defense = max(0, creature.defense)
    creature.max_health = max(1, creature.max_health)
    creature.offspring_count = max(1, min(5, creature.offspring_count))
    creature.attractiveness = max(0, min(1, creature.attractiveness))

# Pack mentality logic
def handle_pack_mentality(creature, all_creatures, get_biome, foods=None):
    """
    Handles pack behavior: movement, combat, and foraging.
    Now also ensures pack members leave to forage when hungry/thirsty, then return to the pack.
    """
    if "Pack mentality" not in getattr(creature, 'mutations', []):
        return
    # Find or create pack
    pack = getattr(creature, 'pack', None)
    if not pack and hasattr(creature, 'pack_id') and creature.pack_id is not None:
        # Find pack by ID
        for c in all_creatures:
            if hasattr(c, 'pack_id') and c.pack_id == creature.pack_id and hasattr(c, 'pack'):
                pack = c.pack
                break
        if pack:
            creature.pack = pack
    # --- Pack foraging and return ---
    if hasattr(creature, 'pack_id') and creature.pack_id is not None:
        # Foraging state: leave pack if hungry/thirsty, return after eating/drinking
        if not hasattr(creature, '_pack_state'):
            creature._pack_state = 'in_pack'  # can be 'in_pack', 'foraging', 'returning'
        if creature._pack_state == 'in_pack':
            if creature.hunger < 70 or creature.thirst < 70:
                creature._pack_state = 'foraging'
        if creature._pack_state == 'foraging':
            # If hunger/thirst is now satisfied, return to pack
            if creature.hunger >= 90 and creature.thirst >= 90:
                creature._pack_state = 'returning'
        if creature._pack_state == 'returning':
            # Move toward pack center
            if hasattr(creature, 'pack') and creature.pack:
                center_x = sum(m.x for m in creature.pack.members) / len(creature.pack.members)
                center_y = sum(m.y for m in creature.pack.members) / len(creature.pack.members)
                dx, dy = center_x - creature.x, center_y - creature.y
                dist = (dx ** 2 + dy ** 2) ** 0.5
                if dist > 10:
                    angle = math.atan2(dy, dx)
                    creature.x += math.cos(angle) * creature.speed
                    creature.y += math.sin(angle) * creature.speed
                else:
                    creature._pack_state = 'in_pack'
    # --- Pack formation/joining/conversion (as before) ---
    if not hasattr(creature, 'pack_id') or creature.pack_id is None:
        # Try to join a nearby pack
        for other in all_creatures:
            if other is not creature and hasattr(other, 'pack_id') and other.pack_id is not None:
                if "Pack mentality" in other.mutations:
                    pack = packs.get(other.pack_id)
                    if pack and len(pack.members) < 10 and get_biome(creature.x, creature.y) == pack.home_biome:
                        pack.add_member(creature)
                        return
        # Otherwise, form a new pack
        home_biome = get_biome(creature.x, creature.y)
        new_pack = Pack(home_biome)
        packs[new_pack.id] = new_pack
        new_pack.add_member(creature)
    # Try to convert nearby non-pack creatures
    pack = packs.get(creature.pack_id)
    if pack:
        for other in all_creatures:
            if other is not creature and (not hasattr(other, 'pack_id') or other.pack_id is None):
                if len(pack.members) < 10 and math.hypot(other.x - creature.x, other.y - creature.y) < 40:
                    other.mutations.append("Pack mentality")
                    apply_mutation_effect(other, "Pack mentality")
                    pack.add_member(other)
    # --- Pack movement and foraging ---
    if pack:
        # Move toward pack center if not close
        center_x = sum(m.x for m in pack.members) / len(pack.members)
        center_y = sum(m.y for m in pack.members) / len(pack.members)
        dist = math.hypot(creature.x - center_x, creature.y - center_y)
        if dist > 30:
            angle = math.atan2(center_y - creature.y, center_x - creature.x)
            creature.x += math.cos(angle) * creature.speed
            creature.y += math.sin(angle) * creature.speed
        # Foraging logic
        if foods is not None:
            # Check if any food is in home biome
            food_in_biome = any(get_biome(f.x, f.y) == pack.home_biome and f.active for f in foods)
            if not food_in_biome:
                pack.foraging = True
            # If foraging, move toward nearest food
            if pack.foraging:
                visible_foods = [f for f in foods if f.active]
                if visible_foods:
                    nearest = min(visible_foods, key=lambda f: math.hypot(f.x - creature.x, f.y - creature.y))
                    angle = math.atan2(nearest.y - creature.y, nearest.x - creature.x)
                    creature.x += math.cos(angle) * creature.speed
                    creature.y += math.sin(angle) * creature.speed
                    # If food is eaten in home biome, return
                    if get_biome(creature.x, creature.y) == pack.home_biome and food_in_biome:
                        pack.foraging = False
        # Defend home biome: attack non-pack intruders and members of other packs
        for other in all_creatures:
            if other is not creature:
                # Attack if other is not in this pack and is in the home biome
                if (not hasattr(other, 'pack_id') or other.pack_id != pack.id) and get_biome(other.x, other.y) == pack.home_biome and math.hypot(other.x - creature.x, other.y - creature.y) < 40:
                    # Attack logic: move toward and attack
                    angle = math.atan2(other.y - creature.y, other.x - creature.x)
                    creature.x += math.cos(angle) * creature.speed
                    creature.y += math.sin(angle) * creature.speed
                    # Direct attack: deal damage
                    if hasattr(other, 'health') and other.health > 0:
                        damage = max(0, creature.attack - other.defense)
                        if damage > 0:
                            was_alive = other.health > 0
                            other.health -= damage
                            if was_alive and other.health <= 0:
                                if hasattr(creature, 'kill_count'):
                                    creature.kill_count += 1
        # --- Pack member collision avoidance ---
        CREATURE_RADIUS = 6  # Should match main sim
        for mate in pack.members:
            if mate is not creature:
                dist = math.hypot(mate.x - creature.x, mate.y - creature.y)
                min_dist = 2 * CREATURE_RADIUS
                if dist < min_dist and dist > 0:
                    # Move away from mate
                    dx = creature.x - mate.x
                    dy = creature.y - mate.y
                    norm = math.hypot(dx, dy)
                    if norm > 0:
                        creature.x += (dx / norm) * (min_dist - dist) * 0.5
                        creature.y += (dy / norm) * (min_dist - dist) * 0.5

def handle_child_eater(creature, all_creatures):
    if "Child Eater" not in creature.mutations:
        return False
    # Look for nearby child creatures
    for other in all_creatures:
        if other is not creature and hasattr(other, 'age') and hasattr(other, 'maturity_age'):
            if other.age < other.maturity_age and other.health > 0:
                dist = math.hypot(other.x - creature.x, other.y - creature.y)
                if dist < 30:  # Close enough to attack
                    # Attack and eat the child
                    other.health = 0
                    creature.hunger = min(100, creature.hunger + 50)  # Eating a child restores a lot of hunger
                    return True
    return False

def handle_cannibal(killer, victim):
    """
    If the killer has the Cannibal mutation, restore health and hunger after a kill.
    This should be called immediately after a kill event.
    """
    if "Cannibal" not in getattr(killer, 'mutations', []):
        return
    # Eating a corpse restores a lot of hunger and some health
    killer.hunger = min(100, killer.hunger + 50)
    killer.health = min(killer.max_health, killer.health + 30)
    # Optionally, print debug info
    # print(f"{killer} (Cannibal) ate {victim} after killing.")

def handle_immortal(creature):
    """
    Prevents death from age, hunger, or thirst for creatures with the Immortal mutation.
    Call this before removing a creature for these causes.
    Returns True if the creature should be kept alive, False otherwise.
    """
    if "Immortal" in getattr(creature, 'mutations', []):
        # Restore hunger/thirst/health if needed, or just prevent death
        creature.hunger = max(creature.hunger, 1)
        creature.thirst = max(creature.thirst, 1)
        creature.age = min(creature.age, creature.max_age - 1)
        creature.health = max(creature.health, 1)
        return True
    return False

def handle_radioactive(creature, all_creatures):
    """
    Radioactive creatures:
    - Damage and mutate nearby non-radioactive creatures (within 30px)
    - Are immune to their own effect (and so are other radioactive creatures)
    - Lose a small amount of health per frame
    """
    if "Radioactive" not in getattr(creature, 'mutations', []):
        return
    RADIUS = 30
    DAMAGE = 1.5  # per frame
    SELF_DAMAGE = 0.15  # per frame
    MUTATE_CHANCE = 0.01  # 1% per frame
    for other in all_creatures:
        if other is creature:
            continue
        if "Radioactive" in getattr(other, 'mutations', []):
            continue  # Immune
        dist = math.hypot(other.x - creature.x, other.y - creature.y)
        if dist < RADIUS:
            # Damage
            if hasattr(other, 'health'):
                other.health -= DAMAGE
            # Mutation chance
            if hasattr(other, 'mutations') and random.random() < MUTATE_CHANCE:
                possible = set(MUTATIONS.keys()) - set(other.mutations)
                if possible:
                    new_mut = random.choice(list(possible))
                    other.mutations.append(new_mut)
                    apply_mutation_effect(other, new_mut)
    # Self-damage
    creature.health -= SELF_DAMAGE

def handle_pregnancy_hunter(creature, all_creatures):
    """
    If the creature has the Pregnancy hunter mutation and is hungry, it seeks and attacks nearby pregnant creatures.
    If it kills a pregnant creature, it eats it (restores hunger). Otherwise, normal eating is allowed.
    Returns True if it ate a pregnant creature, False otherwise.
    """
    if "Pregnancy hunter" not in getattr(creature, 'mutations', []):
        return False
    if creature.hunger > 80:
        return False  # Not hungry enough to hunt
    # Find nearby pregnant creatures
    for other in all_creatures:
        if other is creature:
            continue
        if getattr(other, 'sex', None) == 'F' and hasattr(other, 'gestation_timer'):
            import pygame
            if pygame.time.get_ticks() < other.gestation_timer and other.health > 0:
                dist = math.hypot(other.x - creature.x, other.y - creature.y)
                if dist < 30:
                    # Attack and eat the pregnant creature
                    other.health = 0
                    creature.hunger = min(100, creature.hunger + 50)
                    creature.health = min(creature.max_health, creature.health + 10)
                    return True
    return False

def handle_rage_state(creature):
    """
    Handles Rage State mutation. Returns (attack_mult, speed_mult, aggression_mult).
    Manages rage/exhausted state machine on the creature.
    """
    if "Rage State" not in getattr(creature, 'mutations', []):
        creature._rage_state = 'none'
        return 1.0, 1.0, 1.0
    import pygame
    now = pygame.time.get_ticks()
    if not hasattr(creature, '_rage_state'):
        creature._rage_state = 'none'  # 'none', 'rage', 'exhausted'
        creature._rage_timer = 0
        creature._rage_cooldown = 0
    # Enter rage if health < 30% and not on cooldown or already raging
    if creature._rage_state == 'none' and creature.health < 0.3 * creature.max_health and now > creature._rage_cooldown:
        creature._rage_state = 'rage'
        creature._rage_timer = now + 10000  # 10s
        creature._rage_cooldown = now + 15000  # 15s cooldown
    # End rage, enter exhausted
    if creature._rage_state == 'rage' and now > creature._rage_timer:
        creature._rage_state = 'exhausted'
        creature._rage_timer = now + 5000  # 5s exhausted
    # End exhausted
    if creature._rage_state == 'exhausted' and now > creature._rage_timer:
        creature._rage_state = 'none'
    if creature._rage_state == 'rage':
        return 2.0, 2.0, 2.0
    elif creature._rage_state == 'exhausted':
        return 0.5, 0.5, 0.5
    else:
        return 1.0, 1.0, 1.0

def handle_fragmented_dna(creature):
    """
    Handles Fragmented DNA mutation: random mutation gain/loss every 5 seconds.
    """
    if "Fragmented DNA" not in getattr(creature, 'mutations', []):
        return
    import pygame
    if not hasattr(creature, '_fragmented_timer'):
        creature._fragmented_timer = pygame.time.get_ticks()
    if pygame.time.get_ticks() - creature._fragmented_timer > 5000:
        creature._fragmented_timer = pygame.time.get_ticks()
        # 50% chance to gain or lose a mutation
        if random.random() < 0.5:
            # Gain a random mutation (not already present, not forbidden)
            forbidden = {"Pack mentality", "Immortal", "Fragmented DNA"}
            possible = set(MUTATIONS.keys()) - set(creature.mutations) - forbidden
            if possible:
                new_mut = random.choice(list(possible))
                creature.mutations.append(new_mut)
                apply_mutation_effect(creature, new_mut)
        else:
            # Lose a random mutation (not forbidden)
            forbidden = {"Pack mentality", "Immortal", "Fragmented DNA"}
            removable = [m for m in creature.mutations if m not in forbidden]
            if removable:
                lost = random.choice(removable)
                creature.mutations.remove(lost)

def handle_blood_frenzy(creature):
    """
    Handles Blood Frenzy mutation. Returns (attack_mult, speed_mult, aggression_mult).
    If in frenzy, stats are boosted. Frenzy lasts 8s after a kill.
    """
    if "Blood Frenzy" not in getattr(creature, 'mutations', []):
        creature._blood_frenzy = 0
        return 1.0, 1.0, 1.0
    import pygame
    now = pygame.time.get_ticks()
    if not hasattr(creature, '_blood_frenzy'):
        creature._blood_frenzy = 0
    if creature._blood_frenzy > now:
        return 1.5, 1.5, 1.5
    else:
        return 1.0, 1.0, 1.0

def trigger_blood_frenzy(creature):
    """
    Call this when a creature with Blood Frenzy kills another.
    Sets/refreshes the frenzy timer.
    """
    if "Blood Frenzy" in getattr(creature, 'mutations', []):
        import pygame
        creature._blood_frenzy = pygame.time.get_ticks() + 8000  # 8 seconds

def handle_venom_glands(creature):
    """
    Handles poison damage for creatures that are poisoned by Venom Glands.
    Applies 2 damage/sec for 5s. Poisoned creatures glow green. Venomous creatures are immune.
    """
    import pygame
    if hasattr(creature, '_poisoned_until') and creature._poisoned_until > pygame.time.get_ticks():
        # Only apply poison if not immune
        if "Venom Glands" not in getattr(creature, 'mutations', []):
            # Poison damage: 2 per second
            if not hasattr(creature, '_last_poison_tick'):
                creature._last_poison_tick = 0
            now = pygame.time.get_ticks()
            if now - creature._last_poison_tick > 1000:
                creature.health -= 2
                creature._last_poison_tick = now
    else:
        creature._poisoned_until = 0
        creature._last_poison_tick = 0

def trigger_venom_glands(attacker, target):
    """
    Call this when a creature with Venom Glands attacks another.
    Poisons the target for 5 seconds unless the target is venomous.
    """
    if "Venom Glands" in getattr(attacker, 'mutations', []):
        if "Venom Glands" not in getattr(target, 'mutations', []):
            import pygame
            target._poisoned_until = pygame.time.get_ticks() + 5000  # 5 seconds
            target._last_poison_tick = 0

def handle_howler(creature, all_creatures):
    """
    If attacked or below 50% health, howls (every 10s), boosting aggression of nearby allies for 5s.
    Returns aggression multiplier for this frame.
    """
    import pygame
    if "Howler" not in getattr(creature, 'mutations', []):
        creature._howl_cooldown = 0
        creature._howl_until = 0
        return 1.0
    now = pygame.time.get_ticks()
    if not hasattr(creature, '_howl_cooldown'):
        creature._howl_cooldown = 0
        creature._howl_until = 0
    # Trigger howl if below 50% health and not on cooldown
    if creature.health < 0.5 * creature.max_health and now > creature._howl_cooldown:
        creature._howl_cooldown = now + 10000  # 10s cooldown
        creature._howl_until = now + 5000      # 5s effect
        # Boost aggression of nearby allies
        for other in all_creatures:
            if other is not creature and math.hypot(other.x - creature.x, other.y - creature.y) < 80:
                if hasattr(other, '_howl_boost_until'):
                    other._howl_boost_until = max(getattr(other, '_howl_boost_until', 0), now + 5000)
                else:
                    other._howl_boost_until = now + 5000
    # Aggression boost for self if howling
    if creature._howl_until > now:
        return 1.5
    # Aggression boost if affected by another's howl
    if hasattr(creature, '_howl_boost_until') and creature._howl_boost_until > now:
        return 1.5
    return 1.0

def handle_burrower(creature):
    """
    If below 30% health, burrows for 6s (invulnerable, can't move/attack, every 20s).
    Returns True if burrowed, False otherwise.
    """
    import pygame
    if "Burrower" not in getattr(creature, 'mutations', []):
        creature._burrowed_until = 0
        creature._burrow_cooldown = 0
        return False
    now = pygame.time.get_ticks()
    if not hasattr(creature, '_burrowed_until'):
        creature._burrowed_until = 0
        creature._burrow_cooldown = 0
    # Trigger burrow if below 30% health and not on cooldown
    if creature.health < 0.3 * creature.max_health and now > creature._burrow_cooldown:
        creature._burrowed_until = now + 6000   # 6s burrow
        creature._burrow_cooldown = now + 20000 # 20s cooldown
    if creature._burrowed_until > now:
        return True
    return False

def handle_photosynthetic_skin(creature, get_biome, is_daytime):
    """
    If creature has Photosynthetic Skin, restore hunger during day (any biome).
    """
    if "Photosynthetic Skin" not in getattr(creature, 'mutations', []):
        return
    if not is_daytime:
        return
    # Restore hunger slowly in any biome
    creature.hunger = min(100, creature.hunger + 0.5 * (1/60))  # 0.5 per second at 60 FPS

def handle_thermal_core(creature):
    """
    Returns True if creature has Thermal Core mutation.
    """
    return "Thermal Core" in getattr(creature, 'mutations', [])

def handle_cold_blooded(creature, get_biome, has_thermal_core):
    """
    Returns (speed_mult, hunger_drain_mult) based on biome, unless Thermal Core is present.
    """
    if not "Cold-Blooded" in getattr(creature, 'mutations', []):
        return 1.0, 1.0
    if has_thermal_core:
        return 1.0, 1.0
    biome = get_biome(creature.x, creature.y)
    if biome.name == 'TUNDRA':
        return 0.5, 0.5  # Half speed, half hunger drain
    elif biome.name == 'DESERT':
        return 1.25, 1.25  # 25% faster, 25% more hunger drain
    else:
        return 1.0, 1.0

def handle_bioluminescent(creature, is_daytime):
    """
    If creature has Bioluminescent, assign a random color if not set, and return (attractiveness_mult, color) for night glow and attractiveness boost.
    """
    import random
    if "Bioluminescent" not in getattr(creature, 'mutations', []):
        return 1.0, None
    if not hasattr(creature, 'biolum_color'):
        # Assign a random bright color
        hue = random.random()
        import colorsys
        r, g, b = colorsys.hsv_to_rgb(hue, 1, 1)
        creature.biolum_color = (int(r*255), int(g*255), int(b*255))
    if not is_daytime:
        return 1.5, creature.biolum_color
    return 1.0, None

def handle_twin_gene(parent1, parent2, base_offspring_count):
    """
    If either parent has Twin Gene, double offspring (max 10) and skip cost.
    Returns (offspring_count, skip_cost:bool)
    """
    has_twin = "Twin Gene" in getattr(parent1, 'mutations', []) or "Twin Gene" in getattr(parent2, 'mutations', [])
    if has_twin:
        return min(10, base_offspring_count * 2), True
    return base_offspring_count, False

def handle_loyal_mate(creature, all_creatures):
    """
    Loyal Mate: assigns a mate on first reproduction, halves gestation time, and gives a 1.5x stat boost when within 30px of mate.
    Returns (stat_mult, mate_target) for use in main simulation.
    """
    if "Loyal Mate" not in getattr(creature, 'mutations', []):
        return 1.0, None
    # If mate is dead, clear
    if hasattr(creature, 'loyal_mate_id'):
        mate = next((c for c in all_creatures if getattr(c, 'unique_id', None) == creature.loyal_mate_id), None)
        if mate is None:
            creature.loyal_mate_id = None
            return 1.0, None
        dist = math.hypot(creature.x - mate.x, creature.y - mate.y)
        if dist <= 30:
            return 1.5, None  # Boost when close
        else:
            return 1.0, mate  # Move toward mate
    return 1.0, None

def set_loyal_mates(creature1, creature2):
    """
    Assigns each other as loyal mates (by unique_id).
    """
    if not hasattr(creature1, 'unique_id'):
        creature1.unique_id = id(creature1)
    if not hasattr(creature2, 'unique_id'):
        creature2.unique_id = id(creature2)
    creature1.loyal_mate_id = creature2.unique_id
    creature2.loyal_mate_id = creature1.unique_id

def handle_brood_sac(mother, base_offspring_count):
    """
    If mother has Brood Sac, increase offspring by 50% (rounded up, max 10), gestation time is 0.
    Returns (offspring_count, gestation_time).
    """
    if "Brood Sac" in getattr(mother, 'mutations', []):
        import math
        count = min(10, int(math.ceil(base_offspring_count * 1.5)))
        return count, 0
    return base_offspring_count, None

def handle_springy_tendons(creature):
    """
    If creature has Springy Tendons, speed is x1.3, and can jump (move 2x) every 3s.
    Returns (speed_mult, jump_now:bool).
    """
    import pygame
    if "Springy Tendons" not in getattr(creature, 'mutations', []):
        return 1.0, False
    if not hasattr(creature, '_springy_jump_cooldown'):
        creature._springy_jump_cooldown = 0
    now = pygame.time.get_ticks()
    jump_now = False
    if now > creature._springy_jump_cooldown:
        jump_now = True
        creature._springy_jump_cooldown = now + 3000  # 3s cooldown
    return 1.3, jump_now

def handle_tail_whip(defender, attacker):
    """
    If defender has Tail Whip, 50% chance to deal 2 damage to attacker (unless attacker is Ethereal or dead).
    Sets defender._tailwhip_flash = True for visual cue. Returns True if triggered.
    """
    import random
    if "Tail Whip" in getattr(defender, 'mutations', []):
        if random.random() < 0.5 and hasattr(attacker, 'health') and attacker.health > 0 and "Ethereal" not in getattr(attacker, 'mutations', []):
            attacker.health -= 2
            defender._tailwhip_flash = True
            return True
    defender._tailwhip_flash = False
    return False

def handle_slippery_skin(defender):
    """
    If defender has Slippery Skin, 50% chance to evade attack. Returns True if evaded.
    Sets defender._slippery_flash = True for visual cue.
    """
    import random
    if "Slippery Skin" in getattr(defender, 'mutations', []):
        if random.random() < 0.5:
            defender._slippery_flash = True
            return True
    defender._slippery_flash = False
    return False

def handle_hyperaware(creature, all_creatures):
    """
    Hyperaware: doubles vision, flees from hostile creatures in vision.
    Returns (vision_mult, flee_from:creature or None)
    """
    if "Hyperaware" not in getattr(creature, 'mutations', []):
        return 1.0, None
    vision_mult = 2.0
    # Flee from hostile creatures in vision
    for other in all_creatures:
        if other is creature:
            continue
        # Hostile: aggressive, hunter, or attacking
        is_hostile = getattr(other, 'aggression', 0) > 0.7 or any(mut in getattr(other, 'mutations', []) for mut in ["Cannibal", "Child Eater", "Pregnancy hunter"])
        if is_hostile and math.hypot(other.x - creature.x, other.y - creature.y) < creature.vision * vision_mult:
            return vision_mult, other
    return vision_mult, None

def handle_paranoia(creature, all_creatures):
    """
    Paranoia: flees from any non-pack, non-mate creature within 50px.
    Returns flee_from:creature or None.
    """
    if "Paranoia" not in getattr(creature, 'mutations', []):
        return None
    for other in all_creatures:
        if other is creature:
            continue
        # Ignore packmates and loyal mate
        if hasattr(creature, 'pack_id') and hasattr(other, 'pack_id') and creature.pack_id is not None and creature.pack_id == other.pack_id:
            continue
        if hasattr(creature, 'loyal_mate_id') and getattr(other, 'unique_id', None) == getattr(creature, 'loyal_mate_id', None):
            continue
        if math.hypot(other.x - creature.x, other.y - creature.y) < 50:
            return other
    return None

def handle_dominant(attacker, defender):
    """
    Dominant: 1.5x attack/defense if fighting a non-dominant creature.
    Returns (attack_mult, defense_mult).
    """
    if "Dominant" in getattr(attacker, 'mutations', []) and "Dominant" not in getattr(defender, 'mutations', []):
        return 1.5, 1.5
    return 1.0, 1.0

def handle_cowardly(creature, all_creatures):
    """
    Cowardly: always flees from any non-pack, non-mate creature within 80px, aggression is 0.
    Returns flee_from:creature or None.
    """
    if "Cowardly" not in getattr(creature, 'mutations', []):
        return None
    for other in all_creatures:
        if other is creature:
            continue
        # Ignore packmates and loyal mate
        if hasattr(creature, 'pack_id') and hasattr(other, 'pack_id') and creature.pack_id is not None and creature.pack_id == other.pack_id:
            continue
        if hasattr(creature, 'loyal_mate_id') and getattr(other, 'unique_id', None) == getattr(creature, 'loyal_mate_id', None):
            continue
        if math.hypot(other.x - creature.x, other.y - creature.y) < 80:
            return other
    return None

def handle_regen_core(creature):
    """
    Regen Core: heals 1 health/sec if not poisoned.
    """
    import pygame
    if "Regen Core" not in getattr(creature, 'mutations', []):
        return
    # Don't heal if poisoned
    if hasattr(creature, '_poisoned_until') and creature._poisoned_until > pygame.time.get_ticks():
        return
    if not hasattr(creature, '_last_regen_tick'):
        creature._last_regen_tick = 0
    now = pygame.time.get_ticks()
    if now - creature._last_regen_tick > 1000:
        creature.health = min(creature.max_health, creature.health + 1)
        creature._last_regen_tick = now

def handle_poisonous_blood(defender, attacker):
    """
    Poisonous Blood: poisons attacker when defender is attacked (unless attacker is immune).
    """
    if "Poisonous Blood" in getattr(defender, 'mutations', []):
        from mutations import trigger_venom_glands
        trigger_venom_glands(defender, attacker)

# --- NEW MUTATION HANDLERS ---

def handle_territorial(creature, all_creatures, get_biome):
    """
    Territorial: Claims a territory (circle, 80px radius). Attacks non-pack, non-mate, non-offspring intruders. Gets +25% attack/defense in territory.
    Draws a faint circle for territory (handled in draw).
    """
    if "Territorial" not in getattr(creature, 'mutations', []):
        return 1.0, 1.0
    if not hasattr(creature, '_territory_center'):
        creature._territory_center = (creature.x, creature.y)
    cx, cy = creature._territory_center
    TERRITORY_RADIUS = 80
    # Attack intruders
    for other in all_creatures:
        if other is creature:
            continue
        # Ignore packmates, loyal mate, and offspring
        if hasattr(creature, 'pack_id') and hasattr(other, 'pack_id') and creature.pack_id is not None and creature.pack_id == other.pack_id:
            continue
        if hasattr(creature, 'loyal_mate_id') and getattr(other, 'unique_id', None) == getattr(creature, 'loyal_mate_id', None):
            continue
        if hasattr(other, 'mother_id') and getattr(other, 'mother_id', None) == getattr(creature, 'unique_id', None):
            continue
        dist = math.hypot(other.x - cx, other.y - cy)
        if dist < TERRITORY_RADIUS:
            # Move toward and attack intruder
            angle = math.atan2(other.y - creature.y, other.x - creature.x)
            creature.x += math.cos(angle) * creature.speed
            creature.y += math.sin(angle) * creature.speed
            if hasattr(other, 'health') and other.health > 0:
                damage = max(0, creature.attack * 1.25 - other.defense)
                if damage > 0:
                    was_alive = other.health > 0
                    other.health -= damage
                    if was_alive and other.health <= 0:
                        if hasattr(creature, 'kill_count'):
                            creature.kill_count += 1
    # Stat boost if inside territory
    if math.hypot(creature.x - cx, creature.y - cy) < TERRITORY_RADIUS:
        return 1.25, 1.25
    return 1.0, 1.0

def handle_color_pulse(creature):
    """
    Color Pulse: Every 5s, emits a visible color pulse (expanding ring). +50% attractiveness for 2s after pulse.
    Returns (attractiveness_mult, pulse_active, pulse_radius, pulse_color).
    """
    import pygame
    if "Color Pulse" not in getattr(creature, 'mutations', []):
        creature._colorpulse_last = 0
        creature._colorpulse_active = False
        return 1.0, False, 0, None
    now = pygame.time.get_ticks()
    if not hasattr(creature, '_colorpulse_last'):
        creature._colorpulse_last = 0
        creature._colorpulse_active = False
        creature._colorpulse_start = 0
    # Pulse every 5s
    if now - creature._colorpulse_last > 5000:
        creature._colorpulse_last = now
        creature._colorpulse_active = True
        creature._colorpulse_start = now
    # Pulse lasts 2s
    if creature._colorpulse_active:
        elapsed = now - creature._colorpulse_start
        if elapsed < 2000:
            # Expanding ring: radius grows from 0 to 60
            pulse_radius = int(20 + 40 * (elapsed / 2000))
            # Color: use creature color
            pulse_color = creature.color
            return 1.5, True, pulse_radius, pulse_color
        else:
            creature._colorpulse_active = False
    return 1.0, False, 0, None

def handle_null_core(creature):
    """
    Null Core: Suppresses all other mutation effects (stat and behavioral) except Null Core itself.
    Returns True if Null Core is active.
    """
    return "Null Core" in getattr(creature, 'mutations', [])

# Helper: Suppress all mutation handlers if Null Core is present
# (Call this at the start of each handler except handle_null_core)
def null_core_suppresses(creature, mutation_name=None):
    if "Null Core" in getattr(creature, 'mutations', []):
        if mutation_name is None or mutation_name != "Null Core":
            return True
    return False

def handle_parasitic_womb(mother, all_creatures):
    """
    Parasitic Womb: Instead of normal pregnancy, infects a nearby host (any creature except self) to carry offspring.
    Host suffers health drain and gives birth to mother's offspring at end of gestation.
    Host gets a parasite icon overlay (drawn as green circle).
    """
    import pygame
    if "Parasitic Womb" not in getattr(mother, 'mutations', []):
        return False
    if mother.sex != 'F':
        return False
    # Only infect if not already pregnant
    if hasattr(mother, '_parasitic_infecting') and mother._parasitic_infecting:
        return True
    # Find a host within 60px
    for host in all_creatures:
        if host is mother:
            continue
        if hasattr(host, '_parasitic_hosted_by') and host._parasitic_hosted_by:
            continue  # Already hosting
        dist = math.hypot(host.x - mother.x, host.y - mother.y)
        if dist < 60:
            # Infect host
            host._parasitic_hosted_by = mother
            host._parasitic_gestation_timer = pygame.time.get_ticks() + mother.gestation_duration
            host._parasitic_offspring_count = getattr(mother, 'offspring_count', 1)
            host._parasitic_offspring_mutations = list(mother.mutations)
            host._parasitic_offspring_hue = mother.hue
            host._parasitic_offspring_max_health = mother.max_health
            host._parasitic_offspring_sex = mother.sex
            host._parasitic_offspring_attractiveness = mother.attractiveness
            host._parasitic_offspring_attack = mother.attack
            host._parasitic_offspring_defense = mother.defense
            host._parasitic_offspring_speed = mother.speed
            host._parasitic_offspring_vision = mother.vision
            host._parasitic_offspring_aggression = mother.aggression
            host._parasitic_offspring_infertility = mother.infertility
            mother._parasitic_infecting = True
            # Set mother as not pregnant
            mother.gestation_timer = 0
            return True
    return False

def handle_parasitic_host(host, creatures):
    """
    Called on all creatures. If hosting a parasitic womb, drain health and spawn offspring at end of gestation.
    Returns True if host is currently infected.
    """
    import pygame
    if not hasattr(host, '_parasitic_hosted_by') or not host._parasitic_hosted_by:
        return False
    # Drain health
    host.health = max(0, host.health - 0.05)  # 0.05 per frame
    # Visual handled in draw (draw green circle)
    # Birth
    if pygame.time.get_ticks() > host._parasitic_gestation_timer:
        # Spawn offspring at host's location
        offspring = []
        for _ in range(getattr(host, '_parasitic_offspring_count', 1)):
            from evolution_simulation_fully_integrated9 import Creature
            child = Creature(
                x=host.x, y=host.y,
                hue=getattr(host, '_parasitic_offspring_hue', 0),
                max_health=getattr(host, '_parasitic_offspring_max_health', 10),
                mutations=getattr(host, '_parasitic_offspring_mutations', []),
            )
            # Set mother_id for territory/offspring logic (safe assignment)
            if hasattr(child, 'mother_id') or not hasattr(child, '__slots__'):
                child.mother_id = getattr(host._parasitic_hosted_by, 'unique_id', None)
            offspring.append(child)
        # Add to global creatures list
        creatures.extend(offspring)
        # Clear infection state
        host._parasitic_hosted_by = None
        host._parasitic_gestation_timer = 0
        host._parasitic_offspring_count = 0
        host._parasitic_offspring_mutations = []
        host._parasitic_offspring_hue = 0
        host._parasitic_offspring_max_health = 0
        host._parasitic_offspring_sex = None
        host._parasitic_offspring_attractiveness = 0
        host._parasitic_offspring_attack = 0
        host._parasitic_offspring_defense = 0
        host._parasitic_offspring_speed = 0
        host._parasitic_offspring_vision = 0
        host._parasitic_offspring_aggression = 0
        host._parasitic_offspring_infertility = 0
        # Mark mother as able to infect again
        if hasattr(host, '_parasitic_hosted_by') and host._parasitic_hosted_by is not None and hasattr(host._parasitic_hosted_by, '_parasitic_infecting'):
            host._parasitic_hosted_by._parasitic_infecting = False
        return False
    return True

# In handle_pack_mentality, at the end, call handle_child_eater(creature, all_creatures) 