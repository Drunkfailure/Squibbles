from __future__ import annotations

import numpy as np


class WaterMap:
    """Thin helper around a water tile mask for proximity queries."""

    def __init__(self, water_mask: np.ndarray, tile_size: int):
        if water_mask.dtype != np.bool_:
            water_mask = water_mask.astype(bool)
        self.mask = water_mask
        self.tile_size = max(1, int(tile_size))
        self.rows, self.cols = self.mask.shape

    def _clamp_cell(self, cx: int, cy: int) -> tuple[int, int]:
        cx = max(0, min(self.cols - 1, cx))
        cy = max(0, min(self.rows - 1, cy))
        return cx, cy

    def is_water_at(self, x: float, y: float) -> bool:
        cx = int(x) // self.tile_size
        cy = int(y) // self.tile_size
        cx, cy = self._clamp_cell(cx, cy)
        return bool(self.mask[cy, cx])

    def is_water_near(self, x: float, y: float, radius: float) -> bool:
        ts = self.tile_size
        min_cx = int(max(0, (x - radius)) // ts)
        max_cx = int(min(self.cols - 1, (x + radius) // ts))
        min_cy = int(max(0, (y - radius)) // ts)
        max_cy = int(min(self.rows - 1, (y + radius) // ts))
        sub = self.mask[min_cy:max_cy + 1, min_cx:max_cx + 1]
        return bool(sub.any())


