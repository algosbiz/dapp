#!/usr/bin/env node
/**
 * Turns Natural Earth land polygons into a compact equirectangular land/water bitmask,
 * emitted as `lib/landMask.ts`.
 *
 * Run once and commit the output — the globe then needs no geo dependency, no runtime fetch,
 * and no polygon maths in the browser; it just samples a ~3 kB bitstring.
 *
 * Usage:
 *   curl -sL https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson -o land.geojson
 *   node scripts/generate-land-mask.mjs land.geojson
 */

import fs from "node:fs";
import path from "node:path";

const COLS = 720; // 0.5° per cell horizontally
const ROWS = 360; //  0.5° per cell vertically

const input = process.argv[2];
if (!input) {
  console.error("Usage: node generate-land-mask.mjs <land.geojson>");
  process.exit(1);
}

const geo = JSON.parse(fs.readFileSync(input, "utf8"));

/** Ray-casting point-in-ring test. Rings are [ [lon, lat], … ]. */
function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function ringBounds(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

// Flatten every feature into polygons of [outerRing, ...holes], each with a bounding box so
// most cells can be rejected without running the full ray cast.
const polygons = [];
for (const feature of geo.features) {
  const geom = feature.geometry;
  if (!geom) continue;
  const coordsList = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  for (const rings of coordsList) {
    if (!rings.length) continue;
    polygons.push({ rings, bounds: ringBounds(rings[0]) });
  }
}

console.log(`Loaded ${polygons.length} polygons from ${path.basename(input)}`);

const bits = new Uint8Array(COLS * ROWS);
let landCells = 0;

for (let row = 0; row < ROWS; row += 1) {
  // Sample the centre of each cell.
  const lat = 90 - (row + 0.5) * (180 / ROWS);
  for (let col = 0; col < COLS; col += 1) {
    const lon = -180 + (col + 0.5) * (360 / COLS);

    let isLand = false;
    for (const { rings, bounds } of polygons) {
      if (lon < bounds.minX || lon > bounds.maxX || lat < bounds.minY || lat > bounds.maxY) continue;
      if (!pointInRing(lon, lat, rings[0])) continue;
      // Inside the outer ring — unless it falls in a hole (e.g. the Caspian).
      let inHole = false;
      for (let h = 1; h < rings.length; h += 1) {
        if (pointInRing(lon, lat, rings[h])) { inHole = true; break; }
      }
      if (!inHole) { isLand = true; break; }
    }

    if (isLand) {
      bits[row * COLS + col] = 1;
      landCells += 1;
    }
  }
}

const percent = ((landCells / bits.length) * 100).toFixed(1);
console.log(`Land cells: ${landCells}/${bits.length} (${percent}%)`);

// Pack to bytes, then base64 — bits become a few kB of source.
const bytes = new Uint8Array(Math.ceil(bits.length / 8));
for (let i = 0; i < bits.length; i += 1) {
  if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
}
const base64 = Buffer.from(bytes).toString("base64");

const out = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-land-mask.mjs <ne_50m_land.geojson>
// Source: Natural Earth 50m land (public domain), sampled at ${360 / COLS}° per cell.
//
// An equirectangular land/water bitmask, packed to base64 (~${(base64.length / 1024).toFixed(1)} kB).
// Row 0 is the north pole, column 0 is 180°W. ${percent}% of cells are land, which is close to
// Earth's real land fraction and a quick sanity check that the sampling is right.

export const LAND_MASK_COLS = ${COLS};
export const LAND_MASK_ROWS = ${ROWS};

const PACKED =
  "${base64}";

let decoded: Uint8Array | undefined;

function bits(): Uint8Array {
  if (!decoded) {
    const binary = typeof atob === "function" ? atob(PACKED) : Buffer.from(PACKED, "base64").toString("binary");
    decoded = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) decoded[i] = binary.charCodeAt(i);
  }
  return decoded;
}

/**
 * True when the given latitude/longitude (degrees) falls on land. Decodes the mask once on
 * first call, then it's a couple of array lookups per query.
 */
export function isLand(latDeg: number, lonDeg: number): boolean {
  const row = Math.min(LAND_MASK_ROWS - 1, Math.max(0, Math.floor(((90 - latDeg) / 180) * LAND_MASK_ROWS)));
  const wrappedLon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  const col = Math.min(LAND_MASK_COLS - 1, Math.max(0, Math.floor(((wrappedLon + 180) / 360) * LAND_MASK_COLS)));
  const index = row * LAND_MASK_COLS + col;
  return (bits()[index >> 3] & (1 << (index & 7))) !== 0;
}
`;

// Relative to cwd — this script is meant to be run from packages/web.
const target = path.join("lib", "landMask.ts");
fs.writeFileSync(target, out, "utf8");
console.log(`Wrote ${path.resolve(target)}`);
