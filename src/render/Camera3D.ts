/**
 * Camera3D - Orbit camera for extruded terrain (yaw, pitch, zoom)
 *
 * Map space: X right, Y down, Z up (elevation).
 */

export class Camera3D {
  focusX: number = 0;
  focusY: number = 0;
  /** Rotation around vertical axis (radians). */
  yaw: number = Math.PI * 0.22;
  /** 0 = horizon, π/2 = straight down. */
  pitch: number = 1.08;
  zoom: number = 1.0;
  screenW: number = 1280;
  screenH: number = 720;

  readonly minPitch = 0.42;
  readonly maxPitch = 1.52;
  readonly minZoom = 0.35;
  readonly maxZoom = 2.8;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
  }

  setScreenSize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
  }

  project(wx: number, wy: number, wz: number): { sx: number; sy: number; depth: number } {
    const lx = wx - this.focusX;
    const ly = wy - this.focusY;
    const lz = wz;

    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const rx = lx * c - ly * s;
    const ry = lx * s + ly * c;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    // +Z = up on screen (smaller sy); +Z = drawn in front when depth-sorted
    const depth = ry * cosP + lz * sinP;
    const screenUp = -ry * sinP - lz * cosP;

    return {
      sx: this.screenW / 2 + rx * this.zoom,
      sy: this.screenH / 2 + screenUp * this.zoom,
      depth,
    };
  }

  /** Inverse project onto a horizontal plane at the given world Z. */
  screenToWorldOnPlane(sx: number, sy: number, planeZ: number): { worldX: number; worldY: number } {
    const rx = (sx - this.screenW / 2) / this.zoom;
    const screenUp = (sy - this.screenH / 2) / this.zoom;
    const sinP = Math.sin(this.pitch);
    const cosP = Math.cos(this.pitch);
    const ry = sinP > 0.01 ? (-screenUp - planeZ * cosP) / sinP : 0;

    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    return {
      worldX: this.focusX + rx * c + ry * s,
      worldY: this.focusY + -rx * s + ry * c,
    };
  }

  /** Pick world XY using height map surface at the hit point (two-pass). */
  screenToWorld(
    sx: number,
    sy: number,
    surfaceZAt: (x: number, y: number) => number
  ): { worldX: number; worldY: number } {
    let hit = this.screenToWorldOnPlane(sx, sy, 0);
    const z = surfaceZAt(hit.worldX, hit.worldY);
    hit = this.screenToWorldOnPlane(sx, sy, z);
    return hit;
  }

  /** Rough world-space view half-extents for culling. */
  getViewHalfExtents(): { halfW: number; halfH: number } {
    return {
      halfW: this.screenW / (2 * this.zoom) + 200,
      halfH: this.screenH / (2 * this.zoom) + 200,
    };
  }
}
