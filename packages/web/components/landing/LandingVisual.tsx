"use client";

import { useEffect, useState } from "react";
import { OrbitalScene } from "./OrbitalScene";
import { ScrollSequence } from "./ScrollSequence";

export function LandingVisual() {
  const [useSequence, setUseSequence] = useState<boolean | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setUseSequence(mobile.matches || reduced.matches);

    update();
    mobile.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  if (useSequence === null) {
    return (
      <div
        className="pointer-events-none fixed right-[8%] top-[18%] z-[1] h-72 w-72 rounded-full bg-brand/55 blur-3xl"
        aria-hidden="true"
      />
    );
  }

  return useSequence ? <ScrollSequence /> : <OrbitalScene />;
}
