"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const FILM_CHAPTERS = [
  {
    number: "01",
    label: "The asset",
    kicker: "ETH, made liquid",
    title: "Start with ETH. Make it move.",
    body: "Wrap ETH one-to-one into WETH—the liquid format built to travel through every route in the protocol.",
    image: "/landing/film/weth-origin.png",
    objectPosition: "center",
    align: "left",
    accent: "Make it move.",
  },
  {
    number: "02",
    label: "The wrapper",
    kicker: "One token · every route",
    title: "Wrapped once. Ready everywhere.",
    body: "The same self-custodied position can enter staking, farming, liquidity, and compounding without changing its base asset.",
    image: "/landing/film/weth-wrapped.png",
    objectPosition: "center",
    align: "right",
    accent: "Ready everywhere.",
  },
  {
    number: "03",
    label: "The rewards",
    kicker: "Time becomes yield",
    title: "Every second leaves a trace.",
    body: "Rewards accrue continuously and stay visible from the wallet—no private balance sheet between you and the contracts.",
    image: "/landing/film/weth-rewards.png",
    objectPosition: "center",
    align: "left",
    accent: "leaves a trace.",
  },
  {
    number: "04",
    label: "The loop",
    kicker: "Liquidity · composability · control",
    title: "Trade. Pair. Earn again.",
    body: "Move between WETH and RWD, provide focused liquidity, then put the LP position back to work—all from one wallet.",
    image: "/landing/film/weth-liquidity.png",
    objectPosition: "center",
    align: "right",
    accent: "Earn again.",
  },
] as const;

const ROUTES = [
  {
    index: "A",
    title: "Stake WETH",
    eyebrow: "Pre-funded stream",
    copy: "Deposit WETH into a fixed reward cycle and watch pending rewards update continuously.",
    input: "WETH",
    output: "tRWD",
    href: "/stake",
  },
  {
    index: "B",
    title: "Farm WETH",
    eyebrow: "Emission engine",
    copy: "Enter the MasterChef route where newly minted RWD follows your share of the pool.",
    input: "WETH",
    output: "RWD",
    href: "/farm",
  },
  {
    index: "C",
    title: "Build liquidity",
    eyebrow: "Focused market",
    copy: "Pair WETH with RWD, collect swap fees, and stake the resulting LP position.",
    input: "WETH + RWD",
    output: "LP + RWD",
    href: "/pool",
  },
] as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {diagonal ? (
        <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function FilmLoader({ loaded, ready }: { loaded: number; ready: boolean }) {
  const percent = Math.min(100, Math.round((loaded / FILM_CHAPTERS.length) * 100));

  return (
    <div
      aria-hidden={ready}
      className={`fixed inset-0 z-[100] grid place-items-center bg-brand transition-[opacity,visibility] duration-700 ${
        ready ? "invisible pointer-events-none opacity-0" : "visible opacity-100"
      }`}
    >
      <div className="w-[min(24rem,76vw)] text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink font-display text-2xl font-extrabold text-brand shadow-[0_20px_60px_rgba(14,15,12,0.2)]">
          W
        </div>
        <div className="mt-9 h-px overflow-hidden bg-ink/20">
          <span
            className="block h-full bg-ink transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-ink/65">
          Loading protocol film — {percent}%
        </p>
      </div>
    </div>
  );
}

export function ImmersiveLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(new Set<string>());
  const [loadedAssets, setLoadedAssets] = useState(0);
  const [introReady, setIntroReady] = useState(false);

  const markAsset = (src: string) => {
    if (loadedRef.current.has(src)) return;
    loadedRef.current.add(src);
    setLoadedAssets(loadedRef.current.size);
  };

  useEffect(() => {
    const fallback = window.setTimeout(() => setIntroReady(true), 5000);
    if (loadedAssets >= 2) {
      const reveal = window.setTimeout(() => setIntroReady(true), 320);
      return () => {
        window.clearTimeout(reveal);
        window.clearTimeout(fallback);
      };
    }
    return () => window.clearTimeout(fallback);
  }, [loadedAssets]);

  useEffect(() => {
    if (introReady) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [introReady]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !introReady) return;

    gsap.registerPlugin(ScrollTrigger);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      const frames = gsap.utils.toArray<HTMLElement>("[data-film-frame]");
      const railItems = gsap.utils.toArray<HTMLElement>("[data-film-rail-item]");
      const scenes = gsap.utils.toArray<HTMLElement>("[data-film-scene]");
      const firstCopy = scenes[0]?.querySelectorAll<HTMLElement>("[data-film-reveal]");

      gsap.set(frames, { autoAlpha: 0, scale: 1.07 });
      gsap.set(frames[0], { autoAlpha: 1, scale: 1 });

      const filmTrigger = ScrollTrigger.create({
        trigger: "[data-film-story]",
        start: "top 65px",
        end: "bottom bottom",
        onUpdate: (self) => {
          const phase = self.progress * (frames.length - 1);
          const active = Math.min(frames.length - 1, Math.round(phase));

          frames.forEach((frame, index) => {
            const visibility = gsap.utils.clamp(0, 1, 1 - Math.abs(index - phase));
            gsap.set(frame, {
              autoAlpha: visibility,
              scale: 1.075 - visibility * 0.075,
            });
          });

          railItems.forEach((item, index) => {
            item.dataset.active = index === active ? "true" : "false";
          });
        },
      });

      scenes.forEach((scene, index) => {
        const copy = scene.querySelectorAll<HTMLElement>("[data-film-reveal]");
        gsap.set(copy, { autoAlpha: index === 0 ? 1 : 0, y: index === 0 ? 0 : 34 });

        if (index > 0) {
          gsap.to(copy, {
            autoAlpha: 1,
            y: 0,
            stagger: 0.05,
            ease: "none",
            scrollTrigger: {
              trigger: scene,
              start: "top 68%",
              end: "top 20%",
              scrub: true,
            },
          });
        }

        gsap.to(copy, {
          autoAlpha: 0,
          y: -28,
          stagger: 0.035,
          ease: "none",
          scrollTrigger: {
            trigger: scene,
            start: "bottom 74%",
            end: "bottom 32%",
            scrub: true,
          },
        });
      });

      if (firstCopy?.length) {
        gsap.from(firstCopy, {
          y: 28,
          duration: 1,
          stagger: 0.1,
          ease: "power3.out",
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          autoAlpha: 0,
          y: 42,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 86%" },
        });
      });

      gsap.to("[data-ticker-track]", {
        xPercent: -34,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-ticker]",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      const xTo = gsap.quickTo("[data-film-parallax]", "x", { duration: 0.8, ease: "power3.out" });
      const yTo = gsap.quickTo("[data-film-parallax]", "y", { duration: 0.8, ease: "power3.out" });
      const onPointerMove = (event: PointerEvent) => {
        xTo((event.clientX / window.innerWidth - 0.5) * 14);
        yTo((event.clientY / window.innerHeight - 0.5) * 10);
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        filmTrigger.kill();
      };
    }, root);

    ScrollTrigger.refresh();
    return () => context.revert();
  }, [introReady]);

  return (
    <div ref={rootRef} data-weth-film className="relative isolate overflow-clip bg-canvas-soft">
      <FilmLoader loaded={loadedAssets} ready={introReady} />

      <section data-film-story className="relative h-[800svh] bg-brand">
        <div className="sticky top-[65px] h-[calc(100svh-65px)] overflow-hidden bg-brand">
          <div data-film-parallax className="absolute -inset-3">
            {FILM_CHAPTERS.map((chapter, index) => (
              <div
                key={chapter.number}
                data-film-frame
                className="weth-film-frame absolute inset-0 will-change-[opacity,transform]"
              >
                {/* Generated project artwork is decorative; chapter copy carries the meaning. */}
                <img
                  src={chapter.image}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: chapter.objectPosition }}
                  loading={index < 2 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  onLoad={() => markAsset(chapter.image)}
                  onError={() => markAsset(chapter.image)}
                />
              </div>
            ))}
          </div>

          <div className="weth-film-wash pointer-events-none absolute inset-0" />
          <div className="weth-film-grain pointer-events-none absolute inset-0 opacity-[0.1]" />

          <div className="absolute left-4 top-5 z-20 flex items-center gap-2 rounded-full border border-ink/15 bg-canvas/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink backdrop-blur-md sm:left-6">
            <span className="h-2 w-2 rounded-full bg-positive" />
            WETH-1 · protocol film
          </div>

          <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end gap-4 sm:right-6">
            {FILM_CHAPTERS.map((chapter, index) => (
              <div
                key={chapter.label}
                data-film-rail-item
                data-active={index === 0 ? "true" : "false"}
                className="group flex items-center gap-3"
              >
                <span className="hidden font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink opacity-0 transition-opacity group-data-[active=true]:opacity-100 md:block">
                  {chapter.label}
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-ink/35 transition-[transform,background-color] group-data-[active=true]:scale-[1.8] group-data-[active=true]:bg-ink" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 z-10">
          {FILM_CHAPTERS.map((chapter, index) => {
            const [beforeAccent] = chapter.title.split(chapter.accent);
            const rightAligned = chapter.align === "right";

            return (
              <article key={chapter.number} data-film-scene className="relative h-[200svh]">
                <div
                  className={`sticky top-[65px] flex h-[calc(100svh-65px)] items-end px-4 pb-[8svh] pt-24 sm:px-6 sm:pb-[10svh] ${
                    rightAligned ? "justify-end text-right" : "justify-start text-left"
                  }`}
                >
                  <div className={`weth-film-copy w-full max-w-[42rem] ${rightAligned ? "items-end" : "items-start"}`}>
                    <p data-film-reveal className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                      {chapter.number} · {chapter.kicker}
                    </p>
                    <h1
                      data-film-reveal
                      className="mt-5 text-balance font-display text-[clamp(2.75rem,7.4vw,7rem)] font-extrabold leading-[0.86] tracking-[-0.065em] text-ink sm:text-[clamp(3.25rem,7.4vw,7rem)]"
                    >
                      {beforeAccent}
                      <span className="font-sans font-medium italic text-positive-deep drop-shadow-[0_2px_18px_rgba(246,243,232,0.6)]">
                        {chapter.accent}
                      </span>
                    </h1>
                    <p
                      data-film-reveal
                      className={`mt-6 w-full text-pretty text-base font-medium leading-relaxed text-ink/70 sm:text-lg ${
                        rightAligned ? "ml-auto" : ""
                      }`}
                      style={{ maxWidth: "min(35rem, calc(100vw - 3.5rem))" }}
                    >
                      {chapter.body}
                    </p>

                    {index === 0 && (
                      <div data-film-reveal className={`mt-7 flex flex-wrap gap-3 ${rightAligned ? "justify-end" : ""}`}>
                        <Link href="/stake" className="inline-flex items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas transition-transform hover:-translate-y-0.5">
                          Launch app <span className="text-brand"><Arrow /></span>
                        </Link>
                        <Link href="/wrap" className="rounded-full border border-ink/20 bg-canvas/65 px-5 py-3 text-sm font-bold text-ink backdrop-blur-md transition-colors hover:bg-canvas">
                          Wrap ETH
                        </Link>
                      </div>
                    )}

                    {index === 0 && (
                      <div data-film-reveal className="mt-8 flex items-center gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-ink/55">
                        Scroll to run the film
                        <span className="h-8 w-px overflow-hidden bg-ink/20">
                          <span className="landing-scroll-pulse block h-2 w-px bg-ink" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section data-ticker className="relative z-20 overflow-hidden border-y border-canvas/15 bg-ink py-6 text-brand">
        <div data-ticker-track className="flex w-max items-center gap-8 whitespace-nowrap font-display text-5xl font-extrabold uppercase tracking-[-0.06em] sm:text-7xl">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="flex items-center gap-8">
              Wrap <i className="h-3 w-3 rounded-full bg-canvas" /> Stake <i className="h-3 w-3 rounded-full bg-canvas" /> Farm <i className="h-3 w-3 rounded-full bg-canvas" /> Pair <i className="h-3 w-3 rounded-full bg-canvas" /> Compound <i className="h-3 w-3 rounded-full bg-canvas" />
            </span>
          ))}
        </div>
      </section>

      <section className="relative z-20 bg-ink px-4 py-24 text-canvas sm:px-6 sm:py-32">
        <div className="mx-auto max-w-container">
          <div data-reveal className="grid gap-10 lg:grid-cols-[0.68fr_0.32fr] lg:items-end">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-brand">After the film · the system</p>
              <h2 className="mt-6 max-w-5xl text-balance font-display text-[clamp(3.5rem,8vw,7.6rem)] font-extrabold leading-[0.84] tracking-[-0.065em]">
                One liquid asset. Several ways to put it to work.
              </h2>
            </div>
            <p className="max-w-md text-lg leading-relaxed text-canvas-soft/65">
              WETH is the shared layer connecting staking contracts, emission engines, liquidity, and composable rewards.
            </p>
          </div>

          <div data-reveal className="mt-16 grid overflow-hidden rounded-[30px] border border-canvas/15 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1:1", "ETH to WETH"],
              ["1 sec", "reward accounting"],
              ["0.3%", "focused swap fee"],
              ["Always", "withdraw access"],
            ].map(([value, label]) => (
              <div key={label} className="border-b border-canvas/15 p-6 last:border-0 sm:border-r lg:border-b-0">
                <p className="font-display text-3xl font-extrabold tracking-tight text-brand">{value}</p>
                <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-canvas-soft/45">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="relative z-20 bg-canvas-soft px-4 py-24 sm:px-6 sm:py-32">
        <div className="mx-auto max-w-container">
          <div data-reveal className="flex flex-col gap-6 border-b border-ink/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-positive-deep">Choose your route</p>
              <h2 className="mt-5 max-w-4xl text-balance font-display text-5xl font-extrabold leading-[0.88] tracking-[-0.055em] text-ink sm:text-7xl">
                The story keeps moving after the scroll.
              </h2>
            </div>
            <Link href="/tokenomics" className="inline-flex items-center gap-2 font-bold text-ink transition-colors hover:text-positive-deep">
              Inspect tokenomics <Arrow diagonal />
            </Link>
          </div>

          <div className="divide-y divide-ink/15">
            {ROUTES.map((route) => (
              <Link
                key={route.index}
                data-reveal
                href={route.href}
                className="product-row group grid gap-5 py-9 md:grid-cols-[0.08fr_0.25fr_0.2fr_0.38fr_0.09fr] md:items-center"
              >
                <span className="font-mono text-[10px] font-bold text-ink-mute">{route.index}</span>
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-positive-deep">{route.eyebrow}</p>
                  <h3 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{route.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-body">
                  <span className="rounded-full bg-canvas px-3 py-1.5">{route.input}</span>
                  <span>→</span>
                  <span className="rounded-full bg-brand-pale px-3 py-1.5">{route.output}</span>
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-ink-body">{route.copy}</p>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-canvas text-ink transition-[background-color,transform] group-hover:-rotate-12 group-hover:bg-brand">
                  <Arrow diagonal />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="relative z-20 bg-brand px-4 py-24 sm:px-6 sm:py-32">
        <div data-reveal className="mx-auto grid max-w-container gap-10 lg:grid-cols-[0.65fr_0.35fr] lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-positive-deep">Protocol note 01</p>
            <h2 className="mt-6 max-w-4xl text-balance font-display text-5xl font-extrabold leading-[0.87] tracking-[-0.055em] text-ink sm:text-7xl">
              Control is not a promise. It is the exit path.
            </h2>
          </div>
          <div className="rounded-[28px] bg-ink p-7 text-canvas shadow-[0_30px_90px_-35px_rgba(14,15,12,0.55)]">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-brand">System state</p>
            <dl className="mt-6 divide-y divide-canvas/15 text-sm">
              {[
                ["Network", "Robinhood Testnet"],
                ["Custody", "Non-custodial"],
                ["Withdrawals", "Always available"],
                ["Accounting", "On-chain"],
              ].map(([term, value]) => (
                <div key={term} className="flex items-center justify-between gap-5 py-4">
                  <dt className="text-canvas-soft/50">{term}</dt>
                  <dd className="text-right font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="relative z-20 bg-canvas-soft px-4 py-20 sm:px-6 sm:py-28">
        <div data-reveal className="relative mx-auto max-w-container overflow-hidden rounded-[38px] bg-ink px-6 py-16 text-center text-canvas sm:px-10 sm:py-24">
          <div className="absolute left-1/2 top-0 h-64 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/30 blur-3xl" />
          <p className="relative font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-brand">The film ends · your position starts</p>
          <h2 className="relative mx-auto mt-6 max-w-5xl text-balance font-display text-5xl font-extrabold leading-[0.87] tracking-[-0.055em] sm:text-7xl">
            Put the liquid asset engine to work.
          </h2>
          <p className="relative mx-auto mt-6 max-w-xl text-lg leading-relaxed text-canvas-soft/65">
            Connect a wallet, choose a route, and keep control from the first approval to the final exit.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/stake" className="inline-flex items-center gap-3 rounded-full bg-brand px-6 py-3.5 font-bold text-ink transition-transform hover:-translate-y-0.5">
              Launch staking <Arrow />
            </Link>
            <Link href="/farm" className="rounded-full border border-canvas/25 px-6 py-3.5 font-bold text-canvas transition-colors hover:border-canvas/60">
              Explore every route
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
