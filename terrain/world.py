from __future__ import annotations

from typing import Tuple

import numpy as np

from .gpu import GpuContext


def _noise(xp, shape, octaves=3, persistence=0.5, lacunarity=2.0, seed=None):
    h, w = shape
    if seed is not None:
        try:
            xp.random.seed(seed)
        except Exception:
            pass

    base = xp.random.random((h, w)).astype(xp.float32)
    result = xp.zeros_like(base)
    amp = 1.0
    freq = 1.0
    total = 0.0
    for _ in range(octaves):
        f = xp.fft.fftn(base)
        ky = xp.fft.fftfreq(h)
        kx = xp.fft.fftfreq(w)
        ky2 = ky[:, None] ** 2
        kx2 = kx[None, :] ** 2
        sigma2 = (1.0 / (freq + 1e-6)) ** 2
        gauss = xp.exp(-(kx2 + ky2) / (2 * sigma2)).astype(xp.complex64)
        smooth = xp.real(xp.fft.ifftn(f * gauss)).astype(xp.float32)
        result += amp * smooth
        total += amp
        amp *= persistence
        freq *= lacunarity
    if total > 0:
        result /= total
    # Normalize to [0,1]
    result -= result.min()
    maxv = result.max()
    if maxv > 0:
        result /= maxv
    return result


def generate_world(width: int, height: int, ctx: GpuContext | None = None, seed: int | None = None, settings: dict | None = None):
    """Generate biome grid and water mask for the world with tunable settings.

    settings keys (all optional):
      - 'biome_scale': 1..10 (larger -> broader regions). Default 4
      - 'biome_weights': {'plains':%, 'forest':%, 'desert':%, 'tundra':%}
      - 'pond_chance': 0..100 (probability-like control for ponds)
      - 'river_chance': 0..100 (chance to include a river)
      - 'river_width': integer tiles half-width

    Returns (biome_grid_np, water_mask_np, tile_size)
    """
    context = ctx or GpuContext.detect()
    xp = context.xp

    tile_size = 32
    rows = max(1, height // tile_size)
    cols = max(1, width // tile_size)

    # Settings with defaults
    s = settings or {}
    biome_scale = int(s.get('biome_scale', 4))
    biome_scale = max(1, min(10, biome_scale))
    weights = s.get('biome_weights', None) or {'plains': 40, 'forest': 25, 'desert': 20, 'tundra': 15}
    total_w = sum(max(0, float(v)) for v in weights.values()) or 1.0
    plains_w = max(0.0, float(weights.get('plains', 0))) / total_w
    forest_w = max(0.0, float(weights.get('forest', 0))) / total_w
    desert_w = max(0.0, float(weights.get('desert', 0))) / total_w
    tundra_w = max(0.0, float(weights.get('tundra', 0))) / total_w
    cdf = [plains_w, plains_w + forest_w, plains_w + forest_w + desert_w, 1.01]

    pond_chance = float(s.get('pond_chance', 20.0)) / 100.0
    river_chance = float(s.get('river_chance', 60.0)) / 100.0
    # Baseline river width in tiles, fallback uses map size
    river_width_tiles = int(s.get('river_width', max(1, (height // 32) // 120)))

    # Generate temperature (north-south gradient + low-frequency noise)
    y = xp.linspace(0.0, 1.0, rows, dtype=xp.float32)[:, None]
    oct = 2 + biome_scale // 4
    lac = 1.3 + (10 - biome_scale) * 0.05
    temp_noise = _noise(xp, (rows, cols), octaves=oct, persistence=0.5, lacunarity=lac, seed=(None if seed is None else seed + 1))
    temperature = (0.85 * (1.0 - y) + 0.15 * temp_noise).clip(0.0, 1.0)

    # Generate moisture noise (smoother, larger features)
    moisture = _noise(xp, (rows, cols), octaves=oct + 1, persistence=0.55, lacunarity=lac, seed=(None if seed is None else seed + 2))

    # Generate elevation for water determination and biome hints
    elevation = _noise(xp, (rows, cols), octaves=oct + 2, persistence=0.55, lacunarity=lac + 0.1, seed=seed)
    # Weighted base biome field mapped via CDF, then biased by temp/moisture
    base_noise = _noise(xp, (rows, cols), octaves=oct, persistence=0.5, lacunarity=lac, seed=(None if seed is None else seed + 5))
    biome_grid = xp.ones((rows, cols), dtype=xp.uint8)
    biome_grid = xp.where(base_noise < cdf[0], xp.uint8(1), biome_grid)
    biome_grid = xp.where((base_noise >= cdf[0]) & (base_noise < cdf[1]), xp.uint8(2), biome_grid)
    biome_grid = xp.where((base_noise >= cdf[1]) & (base_noise < cdf[2]), xp.uint8(3), biome_grid)
    biome_grid = xp.where(base_noise >= cdf[2], xp.uint8(4), biome_grid)
    # Bias
    biome_grid = xp.where((temperature > 0.7) & (moisture < 0.35), xp.uint8(3), biome_grid)
    biome_grid = xp.where((temperature < 0.25), xp.uint8(4), biome_grid)
    biome_grid = xp.where((moisture > 0.7) & (temperature > 0.3), xp.uint8(2), biome_grid)

    # Smooth biomes with a small majority filter to form larger, cohesive regions
    biome_grid = _majority_filter(xp, biome_grid, iterations=2)

    # Water: combine elevation and moisture, scaled by pond_chance
    water_potential = ((1.0 - elevation) * 0.6 + moisture * 0.4)
    ponds = water_potential > (1.0 - pond_chance)
    water = ponds

    # River path across columns
    if river_chance > 0.0:
        t = xp.linspace(0.0, 1.0, cols, dtype=xp.float32)
        river_center = 0.5 + 0.10 * xp.sin(2.0 * xp.pi * (t * 1.0 + (seed or 0) * 0.01))
        river_center += 0.05 * (_noise(xp, (1, cols), octaves=2, persistence=0.7, seed=(None if seed is None else seed + 3))[0] - 0.5)
        river_center = (river_center * (rows - 1)).astype(xp.int32)
        half_width = max(1, river_width_tiles)
        for c in range(cols):
            r0 = int(river_center[c] - half_width)
            r1 = int(river_center[c] + half_width)
            r0 = max(0, r0)
            r1 = min(rows - 1, r1)
            water[r0:r1 + 1, c] = True

    # Convert to numpy for rendering code
    try:
        import cupy as cp  # type: ignore
        if isinstance(biome_grid, cp.ndarray):
            biome_grid_np = cp.asnumpy(biome_grid)
            water_np = cp.asnumpy(water)
        else:
            biome_grid_np = np.array(biome_grid)
            water_np = np.array(water)
    except Exception:
        biome_grid_np = np.array(biome_grid)
        water_np = np.array(water)

    return biome_grid_np, water_np, tile_size


def _majority_filter(xp, grid, iterations: int = 1):
    """Apply a 3x3 majority filter to an integer grid, a few iterations.

    Works with NumPy or CuPy arrays.
    """
    if iterations <= 0:
        return grid

    out = grid
    for _ in range(iterations):
        padded = xp.pad(out, 1, mode='edge')
        counts = []
        for biome_id in (1, 2, 3, 4):
            acc = xp.zeros_like(out, dtype=xp.int32)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    window = padded[1 + dy:1 + dy + out.shape[0], 1 + dx:1 + dx + out.shape[1]]
                    acc += (window == biome_id)
            counts.append(acc)
        # Stack and choose biome with max neighbor count
        stacked = xp.stack(counts, axis=0)  # shape (4, H, W)
        argmax = xp.argmax(stacked, axis=0)  # 0..3
        out = (argmax + 1).astype(xp.uint8)
    return out


