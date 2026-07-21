/**
 * Geometry for the network globe. Kept as pure functions, separate from the canvas component,
 * so the projection can be verified deterministically — a `requestAnimationFrame` loop can't
 * be tested in a headless or backgrounded tab (browsers suspend rAF entirely when a tab is
 * hidden), but this math can be checked anywhere.
 */

import { isLand } from "@/lib/landMask";

export type GlobePoint = { x: number; y: number; z: number };

export type Projected = {
  px: number;
  py: number;
  /** 0 = far side of the sphere, 1 = nearest the viewer. Drives both alpha and dot size. */
  depth: number;
  /** Perspective scale factor; >1 in front of the centre, <1 behind it. */
  scale: number;
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Fibonacci sphere — scatters points evenly over a sphere. Naive lat/long stepping bunches
 * points at the poles, which reads as two bright caps instead of an even shell.
 */
export function buildSphere(count: number): GlobePoint[] {
  const points: GlobePoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return points;
}

/**
 * Converts a unit-sphere point to latitude/longitude in degrees. `y` is the polar axis, so the
 * globe spins the way Earth does.
 */
export function toLatLon(point: GlobePoint): { lat: number; lon: number } {
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, point.y))) * 180) / Math.PI,
    lon: (Math.atan2(point.z, point.x) * 180) / Math.PI,
  };
}

/**
 * Scatters `sampleCount` points over the sphere and keeps only the ones that fall on land, so
 * the dots draw continent silhouettes instead of an even shell. Roughly a third survive —
 * oversample accordingly.
 */
export function buildLandPoints(sampleCount: number): GlobePoint[] {
  return buildSphere(sampleCount).filter((point) => {
    const { lat, lon } = toLatLon(point);
    return isLand(lat, lon);
  });
}

/** Rotates a point around Y (spin) then X (tilt), and projects it with perspective. */
export function projectPoint(
  point: GlobePoint,
  options: { angle: number; tilt: number; radius: number; cx: number; cy: number; fov: number }
): Projected {
  const { angle, tilt, radius, cx, cy, fov } = options;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  const sinT = Math.sin(tilt);
  const cosT = Math.cos(tilt);

  const x1 = point.x * cosA + point.z * sinA;
  const z1 = -point.x * sinA + point.z * cosA;
  const y2 = point.y * cosT - z1 * sinT;
  const z2 = point.y * sinT + z1 * cosT;

  const scale = fov / (fov + z2);
  return {
    px: cx + x1 * radius * scale,
    py: cy + y2 * radius * scale,
    depth: (1 - z2) / 2,
    scale,
  };
}
