import pygame
import pygame_gui

HEADER_FONT_SIZE = 26  # For theme only, not used in HTML
INFO_FONT_SIZE = 18   # For theme only, not used in HTML
STATS_FONT_SIZE = 16  # For theme only, not used in HTML
HEADER_COLOR = '#00BFFF'  # Accent color (DeepSkyBlue)
PANEL_BG_COLOR = (30, 34, 40, 220)  # RGBA for dark, semi-transparent
PANEL_BORDER_COLOR = '#444444'
PANEL_BORDER_WIDTH = 2
PANEL_CORNER_RADIUS = 12  # Not natively supported, but can be simulated
PANEL_PADDING = 12
LABEL_SPACING = 6

# Helper to create a styled UIPanel background (simulate rounded corners with a surface)
def create_panel_bg(size):
    surf = pygame.Surface(size, pygame.SRCALPHA)
    rect = pygame.Rect(0, 0, *size)
    pygame.draw.rect(surf, PANEL_BG_COLOR, rect, border_radius=PANEL_CORNER_RADIUS)
    pygame.draw.rect(surf, pygame.Color(PANEL_BORDER_COLOR), rect, PANEL_BORDER_WIDTH, border_radius=PANEL_CORNER_RADIUS)
    return surf


def draw_stats(creatures, global_total_kills, ui_manager, parent_rect):
    if not creatures:
        return None, []
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
    total_kills = global_total_kills
    avg_lifespan = sum(c.max_age for c in creatures) / total / 1000
    avg_age = sum(c.age for c in creatures) / total / 1000
    avg_infertility = sum(c.infertility for c in creatures) / total
    stats_text = [
        "<b>Statistics</b>",
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
    panel = pygame_gui.elements.UIPanel(
        relative_rect=parent_rect,
        manager=ui_manager
    )
    stats_html = '<br>'.join(stats_text)
    textbox_width = parent_rect.width - 2 * PANEL_PADDING - 24  # 24px for scrollbar
    textbox_height = parent_rect.height - 2 * PANEL_PADDING
    textbox = pygame_gui.elements.UITextBox(
        html_text=stats_html,
        relative_rect=pygame.Rect((PANEL_PADDING, PANEL_PADDING), (textbox_width, textbox_height)),
        manager=ui_manager,
        container=panel
    )
    return panel, [textbox]


def draw_selected_creature_info(selected_creature, creatures, ui_manager, parent_rect, show_family_tree, get_family_info, pygame, screen, zoom):
    if not selected_creature or selected_creature not in creatures:
        return None, []
    lines = [
        "<b>Creature Info</b>",
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
    lines.append(f"Mutations: {', '.join(selected_creature.mutations) if selected_creature.mutations else 'None'}")
    if hasattr(selected_creature, 'pack_id') and selected_creature.pack_id is not None:
        lines.append(f"Pack: True (ID: {selected_creature.pack_id})")
    if selected_creature.sex == 'F' and pygame.time.get_ticks() < selected_creature.gestation_timer:
        remaining = max(0, (selected_creature.gestation_timer - pygame.time.get_ticks()) // 1000)
        lines.append(f"Pregnant ({remaining}s left)")
    if show_family_tree:
        family_info = get_family_info(selected_creature.unique_id)
        if family_info:
            lines.append("--- Family Info ---")
            lines.append(f"Generation: {family_info.get('generation', 0)}")
            lines.append(f"Family Members: {family_info.get('total_family_members', 0)} (Living: {family_info.get('living_family_members', 0)})")
            lines.append(f"Ancestors: {family_info.get('total_ancestors', 0)} (Living: {family_info.get('living_ancestors', 0)})")
            lines.append(f"Descendants: {family_info.get('total_descendants', 0)} (Living: {family_info.get('living_descendants', 0)})")
            lines.append(f"Siblings: {family_info.get('siblings_count', 0)} (Living: {family_info.get('living_siblings_count', 0)})")
            lines.append(f"Children: {family_info.get('children_count', 0)}")
            lines.append(f"Alive Descendants: {family_info.get('alive_descendants', 0)}")
            lines.append(f"Inbreeding: {family_info.get('inbreeding_coefficient', 0):.3f}")
    panel = pygame_gui.elements.UIPanel(
        relative_rect=parent_rect,
        manager=ui_manager
    )
    info_html = '<br>'.join(lines)
    textbox_width = parent_rect.width - 2 * PANEL_PADDING - 24  # 24px for scrollbar
    textbox_height = parent_rect.height - 2 * PANEL_PADDING
    textbox = pygame_gui.elements.UITextBox(
        html_text=info_html,
        relative_rect=pygame.Rect((PANEL_PADDING, PANEL_PADDING), (textbox_width, textbox_height)),
        manager=ui_manager,
        container=panel
    )
    return panel, [textbox]


def draw_instructions(ui_manager, parent_rect):
    instructions = [
        "Click: Select creature",
        "ESC: Deselect",
        "S: Toggle stats",
        "T: Toggle family tree",
        "WASD/Arrows: Move camera",
        "Mouse wheel: Zoom"
    ]
    panel = pygame_gui.elements.UIPanel(
        relative_rect=parent_rect,
        manager=ui_manager
    )
    bg_surf = create_panel_bg((parent_rect.width, parent_rect.height))
    bg_img = pygame_gui.elements.UIImage(
        relative_rect=pygame.Rect((0, 0), (parent_rect.width, parent_rect.height)),
        image_surface=bg_surf,
        manager=ui_manager,
        container=panel
    )
    labels = []
    header = pygame_gui.elements.UILabel(
        relative_rect=pygame.Rect((PANEL_PADDING, PANEL_PADDING), (parent_rect.width - 2 * PANEL_PADDING, 22)),
        text='Instructions',
        manager=ui_manager,
        container=panel
    )
    labels.append(header)
    y = PANEL_PADDING + 24
    label_height = 14  # Smaller font size
    for instruction in instructions:
        label = pygame_gui.elements.UILabel(
            relative_rect=pygame.Rect((PANEL_PADDING, y), (parent_rect.width - 2 * PANEL_PADDING, label_height)),
            text=instruction,
            manager=ui_manager,
            container=panel
        )
        labels.append(label)
        y += label_height + 1  # Tighter spacing
    return panel, labels

# Add more GUI functions for overlays, icons, etc. as needed. 