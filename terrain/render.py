from __future__ import annotations

import numpy as np
import pygame
from typing import Tuple


def _to_numpy(arr) -> np.ndarray:
    """Convert a numpy/cupy array to numpy without copying if possible."""
    try:
        import cupy as cp  # type: ignore
        if isinstance(arr, cp.ndarray):  # type: ignore[attr-defined]
            return cp.asnumpy(arr)
    except Exception:
        pass
    if isinstance(arr, np.ndarray):
        return arr
    # Last-resort conversion
    return np.array(arr)


def heightmap_to_surface(heightmap, colormap: Tuple[Tuple[int, int, int], ...] = ((20, 30, 40), (40, 70, 40), (110, 90, 60), (200, 200, 200))) -> pygame.Surface:
    """Convert a [0,1] heightmap to a colorized pygame Surface.

    A simple piecewise gradient colormap is applied.
    """
    hm = _to_numpy(heightmap)
    h, w = hm.shape

    # Build RGB image
    img = np.zeros((h, w, 3), dtype=np.uint8)

    # Bands: water, grass, dirt, rock/snow
    bands = [0.35, 0.55, 0.75, 1.01]
    colors = colormap

    prev = 0.0
    for i, threshold in enumerate(bands):
        mask = (hm >= prev) & (hm < threshold)
        img[mask] = colors[min(i, len(colors) - 1)]
        prev = threshold

    surface = pygame.image.frombuffer(img.tobytes(), (w, h), 'RGB')
    return surface.convert()


