from __future__ import annotations

from typing import Tuple
from .gpu import GpuContext


def _perlin_like(xp, shape: Tuple[int, int], octaves: int = 4, persistence: float = 0.5, lacunarity: float = 2.0, seed: int | None = None):
    """Simple multi-octave value noise using FFT filtering as a placeholder.

    This is deliberately backend-agnostic and works with numpy or cupy arrays.
    It's not true Perlin, but produces decent smooth terrain quickly.
    """
    h, w = shape
    if seed is not None:
        try:
            xp.random.seed(seed)
        except Exception:
            pass

    # Start with white noise
    noise = xp.random.random((h, w)).astype(xp.float32)
    result = xp.zeros_like(noise)

    amplitude = 1.0
    frequency = 1.0
    total_amplitude = 0.0

    for _ in range(octaves):
        # Frequency-domain low-pass via FFT to create smooth noise layer
        f = xp.fft.fftn(noise)
        ky = xp.fft.fftfreq(h)
        kx = xp.fft.fftfreq(w)
        ky2 = ky[:, None] ** 2
        kx2 = kx[None, :] ** 2
        # Gaussian filter in frequency space; scale by frequency
        sigma2 = (1.0 / (frequency + 1e-6)) ** 2
        gauss = xp.exp(-(kx2 + ky2) / (2 * sigma2)).astype(xp.complex64)
        smooth = xp.real(xp.fft.ifftn(f * gauss)).astype(xp.float32)

        result += amplitude * smooth
        total_amplitude += amplitude
        amplitude *= persistence
        frequency *= lacunarity

    # Normalize to [0, 1]
    if total_amplitude > 0:
        result /= total_amplitude
    result -= result.min()
    maxv = result.max()
    if maxv > 0:
        result /= maxv
    return result


def generate_heightmap(width: int, height: int, gpu: GpuContext | None = None, seed: int | None = None):
    """Generate a heightmap using GPU if available.

    Returns an array on the backend (cupy/numpy). Caller may convert to CPU as needed.
    """
    ctx = gpu or GpuContext.detect()
    xp = ctx.xp

    hm = _perlin_like(xp, (height, width), octaves=5, persistence=0.55, lacunarity=2.0, seed=seed)

    return hm, ctx


