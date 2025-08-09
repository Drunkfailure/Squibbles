from __future__ import annotations

from typing import Tuple

import numpy as np

from .gpu import GpuContext
from .heightmap import generate_heightmap
from .tiles import Biome


def generate_biome_grid(width: int, height: int, ctx: GpuContext | None = None, seed: int | None = None):
    """Generate a basic biome grid. For now, everything is PLAINS.

    Returns a numpy array of shape (rows, cols) with Biome ints.
    """
    # One tile per 32px initially; adjust as needed
    tile = 32
    rows = max(1, height // tile)
    cols = max(1, width // tile)
    grid = np.full((rows, cols), int(Biome.PLAINS), dtype=np.uint8)
    return grid, tile


