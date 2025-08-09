from __future__ import annotations

import os
import pygame
from enum import IntEnum
from typing import Dict, Tuple, Optional


class Biome(IntEnum):
    PLAINS = 1
    FOREST = 2
    DESERT = 3
    TUNDRA = 4


_FLOOR_ASSET_MAP: Dict[Biome, Tuple[str, str]] = {
    Biome.PLAINS: (os.path.join('Assets', 'Tilesets for Terrain', 'Plains'), 'Plainsfloor.png'),
    Biome.FOREST: (os.path.join('Assets', 'Tilesets for Terrain', 'Forest'), 'Forestfloor.png'),
    Biome.DESERT: (os.path.join('Assets', 'Tilesets for Terrain', 'Desert'), 'Desertfloor.png'),
    Biome.TUNDRA: (os.path.join('Assets', 'Tilesets for Terrain', 'Tundra'), 'TundraFloor.png'),
}

_FLOOR_COLOR_FALLBACK: Dict[Biome, Tuple[int, int, int]] = {
    Biome.PLAINS: (120, 180, 110),   # light green
    Biome.FOREST: (70, 110, 70),     # forest green
    Biome.DESERT: (220, 200, 140),   # sand
    Biome.TUNDRA: (200, 210, 220),   # icy/gray
}

_texture_cache: Dict[Tuple[Biome, int], Optional[pygame.Surface]] = {}


def get_floor_texture(biome: Biome, tile_size: int) -> Optional[pygame.Surface]:
    key = (biome, tile_size)
    if key in _texture_cache:
        return _texture_cache[key]

    folder, filename = _FLOOR_ASSET_MAP[biome]
    path = os.path.join(folder, filename)
    try:
        img = pygame.image.load(path).convert_alpha()
        img = pygame.transform.smoothscale(img, (tile_size, tile_size))
        _texture_cache[key] = img
        return img
    except Exception:
        _texture_cache[key] = None
        return None


def render_biome_floor_surface(biome_grid, tile_size: int, water_mask=None) -> pygame.Surface:
    """Render a floor surface from a biome grid (rows x cols of Biome ints).

    Attempts to tile floor textures; if not available, fills solid fallback colors.
    """
    rows, cols = biome_grid.shape
    width = cols * tile_size
    height = rows * tile_size
    surface = pygame.Surface((width, height)).convert()

    for r in range(rows):
        for c in range(cols):
            rect = pygame.Rect(c * tile_size, r * tile_size, tile_size, tile_size)
            if water_mask is not None and bool(water_mask[r, c]):
                surface.fill((40, 80, 130), rect)  # water color
                continue

            biome = Biome(int(biome_grid[r, c]))
            tex = get_floor_texture(biome, tile_size)
            if tex is not None:
                surface.blit(tex, rect)
            else:
                surface.fill(_FLOOR_COLOR_FALLBACK[biome], rect)

    return surface


