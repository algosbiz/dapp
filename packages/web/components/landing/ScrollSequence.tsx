"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const FRAME_COUNT = 8;
const COLUMNS = 4;
const ROWS = 2;
const SPRITE_URL = "/landing/weth-journey-sprite.png";

type SequenceState = {
  frame: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

export function ScrollSequence() {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    const landing = document.querySelector<HTMLElement>("[data-immersive-landing]");
    const journey = document.querySelector<HTMLElement>("#model, #journey");
    const context = canvas?.getContext("2d");
    if (!mount || !canvas || !landing || !journey || !context) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const image = new Image();
    image.decoding = "async";
    image.src = SPRITE_URL;
    const preparedFrames: HTMLCanvasElement[] = [];

    const state: SequenceState = {
      frame: reducedMotion ? 1 : 0,
      x: window.innerWidth >= 900 ? 0.76 : 0.68,
      y: window.innerWidth >= 900 ? 0.5 : 0.3,
      scale: 1,
      opacity: 1,
    };

    const prepareFrames = () => {
      if (preparedFrames.length > 0 || image.naturalWidth === 0) return;
      const frameWidth = image.naturalWidth / COLUMNS;
      const frameHeight = image.naturalHeight / ROWS;

      for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
        const buffer = document.createElement("canvas");
        buffer.width = frameWidth;
        buffer.height = frameHeight;
        const bufferContext = buffer.getContext("2d");
        if (!bufferContext) continue;

        const column = frame % COLUMNS;
        const row = Math.floor(frame / COLUMNS);
        bufferContext.drawImage(
          image,
          column * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
          0,
          0,
          frameWidth,
          frameHeight
        );

        // Feather the generated frame's neutral backdrop into the page instead of
        // showing the hard edge of a sprite cell on light or dark sections.
        bufferContext.globalCompositeOperation = "destination-in";
        const matte = bufferContext.createRadialGradient(
          frameWidth / 2,
          frameHeight / 2,
          frameWidth * 0.43,
          frameWidth / 2,
          frameHeight / 2,
          frameWidth * 0.72
        );
        matte.addColorStop(0, "rgba(0, 0, 0, 1)");
        matte.addColorStop(0.74, "rgba(0, 0, 0, 1)");
        matte.addColorStop(1, "rgba(0, 0, 0, 0)");
        bufferContext.fillStyle = matte;
        bufferContext.fillRect(0, 0, frameWidth, frameHeight);
        bufferContext.globalCompositeOperation = "source-over";
        preparedFrames.push(buffer);
      }
    };

    const drawSingleFrame = (frame: number, alpha: number, size: number, left: number, top: number) => {
      const preparedFrame = preparedFrames[frame];
      if (!preparedFrame) return;

      context.globalAlpha = alpha * state.opacity;
      context.drawImage(preparedFrame, left, top, size, size);
    };

    const draw = () => {
      if (!image.complete || image.naturalWidth === 0) return;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width < 900;
      const baseSize = Math.min(width * (mobile ? 0.92 : 0.5), height * (mobile ? 0.58 : 0.72));
      const size = baseSize * state.scale;
      const left = width * state.x - size / 2;
      const top = height * state.y - size / 2;
      const currentFrame = Math.min(FRAME_COUNT - 1, Math.floor(state.frame));
      const nextFrame = Math.min(FRAME_COUNT - 1, currentFrame + 1);
      const mix = state.frame - currentFrame;

      context.clearRect(0, 0, width, height);
      drawSingleFrame(currentFrame, 1 - mix, size, left, top);
      if (nextFrame !== currentFrame && mix > 0) {
        drawSingleFrame(nextFrame, mix, size, left, top);
      }
      context.globalAlpha = 1;
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };

    image.onload = () => {
      mount.dataset.loaded = "true";
      prepareFrames();
      resize();
    };

    image.onerror = () => {
      mount.dataset.failed = "true";
    };

    window.addEventListener("resize", resize);

    const timeline = reducedMotion
      ? null
      : gsap
          .timeline({
            defaults: { ease: "none", onUpdate: draw },
            scrollTrigger: {
              trigger: landing,
              endTrigger: journey,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          })
          .to(state, { frame: 1, y: window.innerWidth >= 900 ? 0.48 : 0.3, duration: 0.14 })
          .to(state, { frame: 3, x: window.innerWidth >= 900 ? 0.76 : 0.67, scale: 1.04, duration: 0.28 })
          .to(state, { frame: 5, x: window.innerWidth >= 900 ? 0.24 : 0.33, scale: 0.96, duration: 0.28 })
          .to(state, { frame: 7, x: window.innerWidth >= 900 ? 0.76 : 0.67, scale: 1.08, duration: 0.24 })
          .to(state, { opacity: 0, scale: 0.9, duration: 0.06 });

    if (image.complete) {
      mount.dataset.loaded = "true";
      prepareFrames();
      resize();
    } else {
      resize();
    }

    return () => {
      timeline?.scrollTrigger?.kill();
      timeline?.kill();
      window.removeEventListener("resize", resize);
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="landing-sequence pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="landing-sequence-fallback absolute right-[8%] top-[18%] h-72 w-72 rounded-full bg-brand/60 blur-3xl" />
    </div>
  );
}
