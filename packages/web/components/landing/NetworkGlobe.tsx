"use client";

import { useEffect, useRef } from "react";
import { buildSphere, projectPoint } from "@/lib/globe";

/**
 * Interactive particle globe standing in for the Robinhood Chain network.
 *
 * Canvas 2D on purpose — a dotted sphere is just a projection plus an alpha ramp, so pulling
 * in a WebGL library would cost ~500 kB to draw a thousand circles. It also keeps the page
 * free of the 3D/scroll dependencies that were deliberately removed from this landing.
 *
 * Interaction is the point, not decoration: the cursor steers the globe (it slows its drift
 * and leans toward you), and a click sends a pulse rippling outward across the surface —
 * the network answering back.
 */

/** Raised with the globe: the same count spread over a much larger sphere reads as sparse. */
const POINT_COUNT = 1500;
/** Perspective strength. Lower = more dramatic foreshortening. */
const FOV = 2.4;
const PULSE_MS = 1100;

type Pulse = { x: number; y: number; start: number };

export function NetworkGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !wrap || !context) return;

    const points = buildSphere(POINT_COUNT);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let spin = 0.6;
    let spinBoost = 0;
    let tilt = -0.18;
    let targetSpinOffset = 0;
    let targetTilt = -0.18;
    let spinOffset = 0;
    let pointer: { x: number; y: number } | null = null;
    let pulses: Pulse[] = [];
    let frame = 0;
    let running = true;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const globeRadius = Math.min(width, height) * 0.44;

      context.clearRect(0, 0, width, height);

      // Ease the cursor-driven rotation so the globe feels weighted rather than twitchy.
      spinOffset += (targetSpinOffset - spinOffset) * 0.06;
      tilt += (targetTilt - tilt) * 0.06;
      spinBoost *= 0.94;

      const angle = spin + spinOffset;
      const projection = { angle, tilt, radius: globeRadius, cx, cy, fov: FOV };

      pulses = pulses.filter((p) => time - p.start < PULSE_MS);

      for (const point of points) {
        const { px, py, depth, scale } = projectPoint(point, projection);

        // Depth ramp: near points read solid, far points fade toward the page.
        let alpha = 0.1 + depth * 0.78;
        let size = (0.7 + depth * 1.5) * scale;
        let bright = false;

        // A click sends an expanding ring; points it sweeps past light up briefly.
        for (const pulse of pulses) {
          const progress = (time - pulse.start) / PULSE_MS;
          const ringRadius = progress * globeRadius * 2.6;
          const distance = Math.hypot(px - pulse.x, py - pulse.y);
          if (Math.abs(distance - ringRadius) < globeRadius * 0.16) {
            const strength = (1 - progress) * (1 - Math.abs(distance - ringRadius) / (globeRadius * 0.16));
            alpha = Math.min(1, alpha + strength * 0.9);
            size += strength * 1.9;
            if (strength > 0.35) bright = true;
          }
        }

        // Points near the cursor swell — makes the surface feel touchable.
        if (pointer) {
          const distance = Math.hypot(px - pointer.x, py - pointer.y);
          const reach = globeRadius * 0.42;
          if (distance < reach) {
            const strength = 1 - distance / reach;
            alpha = Math.min(1, alpha + strength * 0.5);
            size += strength * 1.5;
            if (strength > 0.55) bright = true;
          }
        }

        context.beginPath();
        context.arc(px, py, Math.max(0.4, size), 0, Math.PI * 2);
        // Sitting on the light sage page rather than a dark panel, "lit" has to mean *deeper*,
        // not brighter — brand lime on #e8ebe6 is barely visible, while forest green reads at
        // roughly 8:1 against it.
        context.fillStyle = bright
          ? `rgba(22, 51, 0, ${alpha})` // ink-deep, for points the cursor or a pulse hits
          : `rgba(5, 77, 40, ${alpha})`; // positive-deep
        context.fill();
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      spin += 0.0016 + spinBoost;
      // Hovering slows the drift, so the cursor feels like it has taken hold of the globe.
      if (pointer) spin -= 0.0011;
      draw(time);
      frame = requestAnimationFrame(loop);
    };

    resize();

    if (reduceMotion) {
      // Static portrait: no drift, no pulses, no rAF — but still a real globe, not a blank box.
      draw(performance.now());
    } else {
      frame = requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduceMotion) draw(performance.now());
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (reduceMotion) return;
      const nx = (pointer.x / rect.width) * 2 - 1;
      const ny = (pointer.y / rect.height) * 2 - 1;
      targetSpinOffset = nx * 0.55;
      targetTilt = -0.18 + ny * 0.45;
    };

    const onPointerLeave = () => {
      pointer = null;
      targetSpinOffset = 0;
      targetTilt = -0.18;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (reduceMotion) return;
      const rect = canvas.getBoundingClientRect();
      pulses.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, start: performance.now() });
      spinBoost = 0.014;
    };

    // Stop animating when the globe isn't on screen — it's decoration, and a hero that keeps
    // burning a rAF loop while the user reads the footer is wasted battery.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (reduceMotion) return;
        if (entry.isIntersecting && !running) {
          running = true;
          frame = requestAnimationFrame(loop);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0 }
    );
    observer.observe(wrap);

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    // No panel: the globe sits straight on the page and fills its half of the hero. The
    // "Live on Robinhood Chain" badge at the top of the hero already names what it stands
    // for, so repeating a label here would just be chrome around the object.
    <div className="w-full">
      <div ref={wrapRef} className="relative aspect-square w-full">
        {/* Soft lime haze so the sphere sits in space instead of floating flat on the sage. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-4/5 w-4/5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/35 blur-3xl"
        />
        {/* Decorative: nothing here is information the surrounding copy doesn't already carry. */}
        <canvas ref={canvasRef} aria-hidden="true" className="relative block h-full w-full cursor-pointer" />
      </div>

      <p className="text-center text-xs text-ink-body">
        Move your cursor to steer it — click to send a pulse.
      </p>
    </div>
  );
}
