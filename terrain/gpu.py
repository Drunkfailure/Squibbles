"""GPU detection and array backend selection.

Provides a minimal context that exposes an array module `xp` which will be
either CuPy (GPU) or NumPy (CPU fallback). This lets terrain generation code
write to a single API.
"""

from __future__ import annotations

import importlib
from dataclasses import dataclass
import os
from typing import Any


@dataclass
class GpuContext:
    """Represents the computation backend used for terrain generation.

    Attributes:
        xp: Array module (cupy if GPU available, otherwise numpy)
        is_gpu: True if using GPU (CuPy), else False
        vendor: String hint about the backend used
    """

    xp: Any
    is_gpu: bool
    vendor: str

    @classmethod
    def detect(cls) -> 'GpuContext':
        # Allow forcing CPU via env var for stability
        if os.environ.get('SQUIBBLES_FORCE_CPU', '').strip() in {'1', 'true', 'True'}:
            import numpy as xp  # type: ignore
            return cls(xp=xp, is_gpu=False, vendor='NumPy (forced)')

        # Try to import cupy first
        cupy_spec = importlib.util.find_spec('cupy')
        if cupy_spec is not None:
            try:
                import cupy as xp  # type: ignore
                # Run a series of sanity checks that tend to fail when CUDA/CuPy
                # is not fully configured (e.g., missing nvrtc DLL).
                _ = xp.zeros((1,), dtype=xp.float32)
                _ = xp.linspace(0.0, 1.0, 4, dtype=xp.float32)
                a = xp.random.random((4, 4)).astype(xp.float32)
                _ = xp.fft.fftn(a)
                # Try an elementwise op
                _ = xp.sin(a)
                return cls(xp=xp, is_gpu=True, vendor='CuPy')
            except Exception:
                pass

        # Fallback to numpy
        import numpy as xp  # type: ignore
        return cls(xp=xp, is_gpu=False, vendor='NumPy')


