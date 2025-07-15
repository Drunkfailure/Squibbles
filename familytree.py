# Family Tree System for Evolution Simulation
# Tracks creature lineages, parent-child relationships, and inheritance patterns

import pygame
import math
from typing import Dict, List, Set, Optional, Tuple, Union

class FamilyNode:
    """Represents a single creature in the family tree"""
    def __init__(self, creature_id: int, parent_ids: Optional[Tuple[int, int]] = None):
        self.creature_id = creature_id
        self.parent_ids = parent_ids  # (mother_id, father_id) or None
        self.children_ids: Set[int] = set()
        self.generation = 0
        self.stats = {}  # Will store creature stats when available
        self.mutations = []
        self.alive = True
        self.death_time: Optional[int] = None
        # Visualization properties
        self.x = 0
        self.y = 0
        self.color = (255, 255, 255)
        self.size = 10
        
    def add_child(self, child_id: int):
        """Add a child to this node"""
        self.children_ids.add(child_id)
        
    def set_parents(self, mother_id: int, father_id: int):
        """Set the parents of this node"""
        self.parent_ids = (mother_id, father_id)
        
    def calculate_generation(self, family_tree):
        """Calculate the generation number based on ancestry"""
        if not self.parent_ids or self.parent_ids == (None, None):
            self.generation = 0
            return 0
        def get_gen(pid):
            if not pid or pid not in family_tree.nodes:
                return -1
            return family_tree.nodes[pid].generation
        mother_gen = get_gen(self.parent_ids[0])
        father_gen = get_gen(self.parent_ids[1])
        self.generation = max(mother_gen, father_gen) + 1
        return self.generation

class FamilyTree:
    """Manages the complete family tree of all creatures"""
    
    def __init__(self):
        self.nodes: Dict[int, FamilyNode] = {}
        self.current_generation = 0
        self.family_stats = {}
        # Visualization properties
        self.node_spacing = 80
        self.generation_spacing = 120
        self.selected_node = None
        
    def add_creature(self, creature_id: int, parent_ids: Optional[Tuple[int, int]] = None):
        """Add a new creature to the family tree"""
        node = FamilyNode(creature_id, parent_ids)
        self.nodes[creature_id] = node
        
        # Add to parents' children lists
        if parent_ids:
            mother_id, father_id = parent_ids
            if mother_id and mother_id in self.nodes:
                self.nodes[mother_id].add_child(creature_id)
            if father_id and father_id in self.nodes:
                self.nodes[father_id].add_child(creature_id)
                
        # Calculate generation
        node.calculate_generation(self)
        self.current_generation = max(self.current_generation, node.generation)
        
    def get_node(self, creature_id: int) -> Optional[FamilyNode]:
        """Get a family node by creature ID"""
        return self.nodes.get(creature_id)
        
    def update_creature_stats(self, creature_id: int, stats: dict, mutations: list):
        """Update the stats and mutations of a creature"""
        if creature_id in self.nodes:
            self.nodes[creature_id].stats = stats.copy()
            self.nodes[creature_id].mutations = mutations.copy()
            
    def mark_creature_dead(self, creature_id: int, death_time: int):
        """Mark a creature as dead"""
        if creature_id in self.nodes:
            self.nodes[creature_id].alive = False
            self.nodes[creature_id].death_time = death_time
            
    def get_ancestors(self, creature_id: int, max_generations: int = 5, living_only: bool = False) -> List[FamilyNode]:
        """Get all ancestors of a creature up to max_generations back. Optionally filter for living only."""
        ancestors = []
        current_node = self.get_node(creature_id)
        if not current_node:
            return ancestors
        visited = set()
        def add_ancestors(node: FamilyNode, depth: int):
            if depth >= max_generations or not node.parent_ids:
                return
            mother_id, father_id = node.parent_ids
            for pid in [mother_id, father_id]:
                if pid and pid in self.nodes and pid not in visited:
                    parent = self.nodes[pid]
                    if not living_only or parent.alive:
                        ancestors.append(parent)
                    visited.add(pid)
                    add_ancestors(parent, depth + 1)
        add_ancestors(current_node, 0)
        return ancestors

    def get_descendants(self, creature_id: int, max_generations: int = 5, living_only: bool = False) -> List[FamilyNode]:
        """Get all descendants of a creature up to max_generations forward. Optionally filter for living only."""
        descendants = []
        current_node = self.get_node(creature_id)
        if not current_node:
            return descendants
        visited = set()
        def add_descendants(node: FamilyNode, depth: int):
            if depth >= max_generations:
                return
            for child_id in node.children_ids:
                if child_id in self.nodes and child_id not in visited:
                    child = self.nodes[child_id]
                    if not living_only or child.alive:
                        descendants.append(child)
                    visited.add(child_id)
                    add_descendants(child, depth + 1)
        add_descendants(current_node, 0)
        return descendants
        
    def get_siblings(self, creature_id: int) -> List[FamilyNode]:
        """Get all siblings of a creature"""
        current_node = self.get_node(creature_id)
        if not current_node or not current_node.parent_ids:
            return []
            
        mother_id, father_id = current_node.parent_ids
        siblings = []
        
        # Get all children of the same parents
        if mother_id and mother_id in self.nodes:
            for child_id in self.nodes[mother_id].children_ids:
                if child_id != creature_id and child_id in self.nodes:
                    siblings.append(self.nodes[child_id])
                    
        return siblings
        
    def calculate_inbreeding_coefficient(self, creature_id: int) -> float:
        """Calculate the inbreeding coefficient of a creature"""
        current_node = self.get_node(creature_id)
        if not current_node or not current_node.parent_ids:
            return 0.0
            
        mother_id, father_id = current_node.parent_ids
        
        # Check if parents are siblings
        if mother_id and father_id and mother_id in self.nodes and father_id in self.nodes:
            mother = self.nodes[mother_id]
            father = self.nodes[father_id]
            
            # If they share parents, they are siblings
            if mother.parent_ids and father.parent_ids:
                if mother.parent_ids == father.parent_ids:
                    return 0.25  # Full siblings
                    
        return 0.0
        
    def get_family_stats(self, creature_id: int) -> dict:
        """Get comprehensive family statistics for a creature, including living and total counts, and correct generation."""
        current_node = self.get_node(creature_id)
        if not current_node:
            return {}
        ancestors = self.get_ancestors(creature_id, max_generations=10, living_only=False)
        living_ancestors = self.get_ancestors(creature_id, max_generations=10, living_only=True)
        descendants = self.get_descendants(creature_id, max_generations=10, living_only=False)
        living_descendants = self.get_descendants(creature_id, max_generations=10, living_only=True)
        siblings = self.get_siblings(creature_id)
        living_siblings = [sib for sib in siblings if sib.alive]
        # Calculate correct generation: 0 for initial, else max(parent generations) + 1
        if not current_node.parent_ids or current_node.parent_ids == (None, None):
            generation = 0
        else:
            def get_gen(pid):
                if not pid or pid not in self.nodes:
                    return -1
                return self.nodes[pid].generation
            mother_gen = get_gen(current_node.parent_ids[0])
            father_gen = get_gen(current_node.parent_ids[1])
            generation = max(mother_gen, father_gen) + 1
        family_stats = {
            'generation': generation,
            'total_family_members': len(ancestors) + len(descendants) + len(siblings) + 1,
            'living_family_members': len(living_ancestors) + len(living_descendants) + len(living_siblings) + (1 if current_node.alive else 0),
            'generations_back': max([a.generation for a in ancestors]) if ancestors else 0,
            'generations_forward': max([d.generation for d in descendants]) if descendants else 0,
            'siblings_count': len(siblings),
            'living_siblings_count': len(living_siblings),
            'children_count': len(current_node.children_ids),
            'inbreeding_coefficient': self.calculate_inbreeding_coefficient(creature_id),
            'alive_descendants': len(living_descendants),
            'dead_descendants': len([d for d in descendants if not d.alive]),
            'total_ancestors': len(ancestors),
            'living_ancestors': len(living_ancestors),
            'total_descendants': len(descendants),
            'living_descendants': len(living_descendants),
        }
        return family_stats
        
    def calculate_tree_layout(self, root_id: int, start_x: int = 100, start_y: int = 50):
        """Calculate positions for all nodes in the family tree"""
        root_node = self.get_node(root_id)
        if not root_node:
            return
            
        # Clear existing positions
        for node in self.nodes.values():
            node.x = 0
            node.y = 0
            
        def layout_subtree(node: FamilyNode, x: int, y: int, level: int):
            """Recursively layout the tree"""
            node.x = x
            node.y = y
            
            # Position children
            children = [self.nodes[child_id] for child_id in node.children_ids if child_id in self.nodes]
            if children:
                # Calculate total width needed for children
                total_width = len(children) * self.node_spacing
                start_child_x = x - total_width // 2
                
                for i, child in enumerate(children):
                    child_x = start_child_x + i * self.node_spacing
                    child_y = y + self.generation_spacing
                    layout_subtree(child, child_x, child_y, level + 1)
                    
        # Start layout from root
        layout_subtree(root_node, start_x, start_y, 0)
        
    def draw_family_tree(self, screen, camera_offset, zoom, selected_creature_id: Optional[int] = None):
        """Draw the family tree visualization"""
        if not self.nodes:
            return
            
        # Find a root node (creature with no parents or selected creature)
        root_id = selected_creature_id if selected_creature_id and selected_creature_id in self.nodes else None
        if not root_id:
            # Find a creature with no parents as root
            for creature_id, node in self.nodes.items():
                if not node.parent_ids:
                    root_id = creature_id
                    break
                    
        if not root_id:
            return
            
        # Calculate layout
        self.calculate_tree_layout(root_id)
        
        # Draw connections first
        for node in self.nodes.values():
            if node.parent_ids:
                mother_id, father_id = node.parent_ids
                if mother_id and mother_id in self.nodes:
                    mother = self.nodes[mother_id]
                    # Draw connection line
                    start_pos = world_to_screen(mother.x, mother.y)
                    end_pos = world_to_screen(node.x, node.y)
                    pygame.draw.line(screen, (100, 100, 100), start_pos, end_pos, 2)
                    
        # Draw nodes
        for node in self.nodes.values():
            pos = world_to_screen(node.x, node.y)
            
            # Choose color based on status
            if not node.alive:
                color = (100, 100, 100)  # Grey for dead
            elif node.creature_id == selected_creature_id:
                color = (255, 255, 0)  # Yellow for selected
            elif node.mutations:
                color = (255, 100, 100)  # Red for mutated
            else:
                color = (100, 255, 100)  # Green for normal
                
            # Draw node
            size = max(3, int(node.size * zoom))
            pygame.draw.circle(screen, color, pos, size)
            
            # Draw generation number
            if zoom > 0.5:
                font = pygame.font.SysFont(None, int(16 * zoom))
                gen_text = font.render(f"G{node.generation}", True, (255, 255, 255))
                text_pos = (pos[0] - gen_text.get_width()//2, pos[1] + size + 5)
                screen.blit(gen_text, text_pos)
                
    def get_node_at_position(self, mouse_x: int, mouse_y: int, camera_offset, zoom) -> Optional[int]:
        """Get the creature ID of a node at the given screen position"""
        for creature_id, node in self.nodes.items():
            pos = world_to_screen(node.x, node.y)
            distance = math.hypot(mouse_x - pos[0], mouse_y - pos[1])
            if distance <= node.size * zoom:
                return creature_id
        return None
        
    def get_family_analysis(self, creature_id: int) -> dict:
        """Get detailed family analysis including inheritance patterns"""
        current_node = self.get_node(creature_id)
        if not current_node:
            return {}
            
        ancestors = self.get_ancestors(creature_id, 3)
        descendants = self.get_descendants(creature_id, 3)
        siblings = self.get_siblings(creature_id)
        
        # Analyze mutation inheritance
        inherited_mutations = set()
        if current_node.parent_ids:
            mother_id, father_id = current_node.parent_ids
            if mother_id and mother_id in self.nodes:
                inherited_mutations.update(self.nodes[mother_id].mutations)
            if father_id and father_id in self.nodes:
                inherited_mutations.update(self.nodes[father_id].mutations)
                
        # Find unique mutations in family
        all_family_mutations = set()
        for node in ancestors + descendants + siblings + [current_node]:
            all_family_mutations.update(node.mutations)
            
        analysis = {
            'creature_id': creature_id,
            'generation': current_node.generation,
            'alive': current_node.alive,
            'total_ancestors': len(ancestors),
            'total_descendants': len(descendants),
            'total_siblings': len(siblings),
            'inherited_mutations': list(inherited_mutations),
            'unique_mutations': list(current_node.mutations),
            'family_mutations': list(all_family_mutations),
            'inbreeding_coefficient': self.calculate_inbreeding_coefficient(creature_id),
            'generations_tracked': self.current_generation,
            'alive_descendants': len([d for d in descendants if d.alive]),
            'dead_descendants': len([d for d in descendants if not d.alive]),
        }
        
        return analysis

def world_to_screen(x: float, y: float) -> Tuple[int, int]:
    """Convert world coordinates to screen coordinates"""
    # This will be overridden when integrated with main simulation
    return int(x), int(y)

# Function to set the coordinate transform function from main simulation
def set_coordinate_transform(transform_func):
    """Set the coordinate transform function from the main simulation"""
    global world_to_screen
    world_to_screen = transform_func

# Global family tree instance
family_tree = FamilyTree()

def initialize_family_tree():
    """Initialize the family tree system"""
    global family_tree
    family_tree = FamilyTree()
    
def add_creature_to_tree(creature_id: int, parent_ids: Optional[Tuple[int, int]] = None):
    """Add a creature to the family tree"""
    family_tree.add_creature(creature_id, parent_ids)
    
def update_creature_in_tree(creature_id: int, stats: dict, mutations: list):
    """Update creature information in the family tree"""
    family_tree.update_creature_stats(creature_id, stats, mutations)
    
def mark_creature_dead_in_tree(creature_id: int, death_time: int):
    """Mark a creature as dead in the family tree"""
    family_tree.mark_creature_dead(creature_id, death_time)
    
def get_family_info(creature_id: int) -> dict:
    """Get family information for a creature"""
    return family_tree.get_family_stats(creature_id)
    
def get_family_analysis(creature_id: int) -> dict:
    """Get detailed family analysis for a creature"""
    return family_tree.get_family_analysis(creature_id)
    
def draw_family_tree(screen, camera_offset, zoom, selected_creature_id: Optional[int] = None):
    """Draw the family tree visualization"""
    family_tree.draw_family_tree(screen, camera_offset, zoom, selected_creature_id)
    
def get_node_at_position(mouse_x: int, mouse_y: int, camera_offset, zoom) -> Optional[int]:
    """Get creature ID at screen position"""
    return family_tree.get_node_at_position(mouse_x, mouse_y, camera_offset, zoom) 