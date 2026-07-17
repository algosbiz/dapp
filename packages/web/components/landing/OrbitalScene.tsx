"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

const BRAND = new THREE.Color("#9fe870");
const BRAND_PALE = new THREE.Color("#e2f6d5");
const INK = new THREE.Color("#0e0f0c");
const CYAN = new THREE.Color("#38c8ff");
const ORANGE = new THREE.Color("#ffc091");

function makeWMark() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.82, 0.62);
  shape.lineTo(-0.5, 0.62);
  shape.lineTo(-0.2, -0.42);
  shape.lineTo(-0.07, 0.04);
  shape.lineTo(0.07, 0.04);
  shape.lineTo(0.2, -0.42);
  shape.lineTo(0.5, 0.62);
  shape.lineTo(0.82, 0.62);
  shape.lineTo(0.4, -0.72);
  shape.lineTo(0.08, -0.72);
  shape.lineTo(0, -0.43);
  shape.lineTo(-0.08, -0.72);
  shape.lineTo(-0.4, -0.72);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  geometry.center();
  const material = new THREE.MeshPhysicalMaterial({
    color: INK,
    metalness: 0.25,
    roughness: 0.24,
    clearcoat: 0.8,
  });
  const mark = new THREE.Mesh(geometry, material);
  mark.position.z = 0.26;
  return mark;
}

function makeCoin(radius: number, color: THREE.Color, label = false) {
  const group = new THREE.Group();
  const edge = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, radius * 0.25, 64, 1, false),
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.42,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    })
  );
  edge.rotation.x = Math.PI / 2;
  group.add(edge);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.86, radius * 0.055, 16, 80),
    new THREE.MeshStandardMaterial({
      color: label ? INK : BRAND_PALE,
      metalness: 0.45,
      roughness: 0.22,
    })
  );
  rim.position.z = radius * 0.135;
  group.add(rim);

  if (label) group.add(makeWMark());
  return group;
}

export function OrbitalScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    const landing = document.querySelector<HTMLElement>("[data-immersive-landing]");
    const modelStage = document.querySelector<HTMLElement>("[data-model-stage]");
    if (!mount || !landing) return;

    gsap.registerPlugin(ScrollTrigger);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      mount.dataset.webgl = "unavailable";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8.2);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x163300, 2.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 5.5);
    keyLight.position.set(4, 5, 7);
    scene.add(keyLight);

    const greenLight = new THREE.PointLight(BRAND, 18, 16, 1.7);
    greenLight.position.set(-4, -1, 4);
    scene.add(greenLight);

    const scrollRig = new THREE.Group();
    const pointerRig = new THREE.Group();
    const asset = new THREE.Group();
    scrollRig.add(pointerRig);
    pointerRig.add(asset);
    scene.add(scrollRig);

    const mainCoin = makeCoin(1.5, BRAND, true);
    mainCoin.rotation.set(-0.12, -0.2, -0.08);
    asset.add(mainCoin);

    const orbitRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.42, 0.018, 8, 160),
      new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.24 })
    );
    orbitRing.rotation.set(1.12, 0.18, -0.28);
    asset.add(orbitRing);

    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.86, 0.055, 12, 120),
      new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.46 })
    );
    glowRing.rotation.set(0.72, -0.32, 0.18);
    asset.add(glowRing);

    const satelliteSpecs = [
      { radius: 0.39, color: CYAN, position: new THREE.Vector3(2.12, 0.72, 0.15) },
      { radius: 0.3, color: ORANGE, position: new THREE.Vector3(-1.95, -1.18, 0.42) },
      { radius: 0.22, color: BRAND_PALE, position: new THREE.Vector3(0.48, 2.28, -0.22) },
    ];
    const satellites = satelliteSpecs.map(({ radius, color, position }, index) => {
      const coin = makeCoin(radius, color);
      coin.position.copy(position);
      coin.rotation.set(0.35 + index * 0.2, -0.45, index * 0.7);
      asset.add(coin);
      return coin;
    });

    const particleCount = window.innerWidth < 768 ? 90 : 180;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const distance = 2.8 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI * 2;
      particlePositions[index * 3] = Math.cos(angle) * distance;
      particlePositions[index * 3 + 1] = Math.sin(angle) * distance;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: INK, size: 0.028, transparent: true, opacity: 0.32 })
    );
    asset.add(particles);

    const desktop = window.innerWidth >= 900;
    scrollRig.position.set(desktop ? 2.15 : 0.8, desktop ? 0 : 1.05, 0);
    scrollRig.scale.setScalar(desktop ? 1 : 0.72);

    const scrollTimeline = reducedMotion
      ? null
      : gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: landing,
              endTrigger: modelStage ?? landing,
              start: "top top",
              end: "bottom bottom",
              scrub: 1.1,
            },
          })
          .to(scrollRig.position, {
            x: desktop ? 2.1 : 0.7,
            y: desktop ? -0.18 : 0.7,
            z: -0.45,
            duration: 0.46,
          })
          .to(
            scrollRig.rotation,
            { x: 0.35, y: Math.PI * 0.8, z: -0.22, duration: 0.46 },
            "<"
          )
          .to(scrollRig.position, {
            x: desktop ? 2.15 : 0.7,
            y: desktop ? 0 : 0.7,
            z: -0.25,
            duration: 0.18,
          })
          .to(
            scrollRig.rotation,
            { x: -0.1, y: Math.PI * 1.25, z: 0.16, duration: 0.18 },
            "<"
          )
          .to(scrollRig.position, {
            x: desktop ? -2.1 : -0.7,
            y: desktop ? 0.08 : 0.72,
            z: -0.4,
            duration: 0.18,
          })
          .to(
            scrollRig.rotation,
            { x: 0.2, y: Math.PI * 2, z: -0.24, duration: 0.18 },
            "<"
          )
          .to(scrollRig.position, {
            x: desktop ? 2.05 : 0.7,
            y: desktop ? 0.05 : 0.62,
            z: -0.65,
            duration: 0.18,
          })
          .to(
            scrollRig.rotation,
            { x: 0.3, y: Math.PI * 2.8, z: -0.34, duration: 0.18 },
            "<"
          )
          .to(
            scrollRig.scale,
            {
              x: desktop ? 0.9 : 0.62,
              y: desktop ? 0.9 : 0.62,
              z: desktop ? 0.9 : 0.62,
              duration: 0.18,
            },
            "<"
          )
          .to(mount, { opacity: 0, duration: 0.03 });

    const pointer = new THREE.Vector2();
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.28;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.22;
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (reducedMotion) renderer.render(scene, camera);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let frame = 0;
    let running = !document.hidden;

    const render = () => {
      if (!running) return;
      const elapsed = clock.getElapsedTime();
      pointerRig.rotation.y += (pointer.x - pointerRig.rotation.y) * 0.035;
      pointerRig.rotation.x += (-pointer.y - pointerRig.rotation.x) * 0.035;
      mainCoin.rotation.z = -0.08 + Math.sin(elapsed * 0.45) * 0.045;
      orbitRing.rotation.z = -0.28 + elapsed * 0.08;
      glowRing.rotation.z = 0.18 - elapsed * 0.11;
      particles.rotation.z = elapsed * 0.018;
      satellites.forEach((coin, index) => {
        coin.rotation.y = elapsed * (0.45 + index * 0.09);
        coin.position.y += Math.sin(elapsed * 0.8 + index * 2) * 0.0008;
      });
      renderer.render(scene, camera);
      if (!reducedMotion) frame = window.requestAnimationFrame(render);
    };

    const onVisibilityChange = () => {
      running = !document.hidden;
      if (running && !reducedMotion) {
        clock.getDelta();
        frame = window.requestAnimationFrame(render);
      } else {
        window.cancelAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    render();

    return () => {
      scrollTimeline?.scrollTrigger?.kill();
      scrollTimeline?.kill();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="landing-scene pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      <div className="landing-scene-fallback absolute right-[8%] top-[18%] h-72 w-72 rounded-full bg-brand/70 blur-3xl" />
    </div>
  );
}
