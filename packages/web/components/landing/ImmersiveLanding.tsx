"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LandingVisual } from "./LandingVisual";

const MODEL_CHAPTERS = [
  {
    number: "01",
    kicker: "Base layer",
    title: "Wrap once. Move everywhere.",
    body: "Convert ETH into WETH one-to-one, then use the same liquid asset across every earning route in the protocol.",
    stat: "1:1",
    label: "ETH / WETH",
    href: "/wrap",
    action: "Open wrapper",
  },
  {
    number: "02",
    kicker: "Reward engine",
    title: "Seconds become rewards.",
    body: "Choose a pre-funded staking stream or enter MasterChef farming where RWD emissions are accounted for continuously.",
    stat: "24/7",
    label: "reward accrual",
    href: "/farm",
    action: "Explore farms",
  },
  {
    number: "03",
    kicker: "Liquidity loop",
    title: "Trade. Pair. Earn again.",
    body: "Swap WETH and RWD, provide liquidity to the focused market, then stake the LP position for another reward layer.",
    stat: "0.3%",
    label: "swap fee",
    href: "/pool",
    action: "Enter the pool",
  },
] as const;

const PRODUCTS = [
  {
    index: "A",
    name: "WETH Stake",
    model: "Pre-funded",
    input: "WETH",
    output: "tRWD",
    description: "The straightforward route. A fixed reward budget streams over a defined period.",
    href: "/stake",
  },
  {
    index: "B",
    name: "MasterChef",
    model: "Mint on demand",
    input: "WETH",
    output: "RWD",
    description: "The emission route. Deposit WETH and harvest newly minted RWD every second.",
    href: "/farm",
  },
  {
    index: "C",
    name: "LP Farm",
    model: "Liquidity mining",
    input: "WETH-RWD-LP",
    output: "RWD",
    description: "The market-making route. Supply both assets, then put the resulting LP token to work.",
    href: "/farm",
  },
  {
    index: "D",
    name: "RWD Compound",
    model: "Pre-funded",
    input: "RWD",
    output: "RWD",
    description: "The recursive route. Lock earned RWD into a separate funded reward cycle.",
    href: "/stake-rwd",
  },
] as const;

const LAB_MODES = [
  {
    id: "stream",
    label: "Reward stream",
    eyebrow: "Time-based accounting",
    title: "Every second is visible.",
    body: "Balances, pending rewards, and pool state are read directly from the chain. No private ledger sits between the wallet and the protocol.",
    metric: "1 sec",
    metricLabel: "accounting interval",
  },
  {
    id: "market",
    label: "Price engine",
    eyebrow: "Constant product market",
    title: "A market with one job.",
    body: "The WETH/RWD pool uses focused x·y=k pricing, reserve-based quotes, a 0.3% fee, and explicit high-impact trade warnings.",
    metric: "x · y = k",
    metricLabel: "pricing invariant",
  },
  {
    id: "custody",
    label: "Self custody",
    eyebrow: "Wallet-native control",
    title: "Your exit stays yours.",
    body: "A pause can stop new deposits, but existing positions retain their withdrawal and reward-claim paths.",
    metric: "Always",
    metricLabel: "withdraw access",
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

function ProtocolLab() {
  const [active, setActive] = useState(0);
  const mode = LAB_MODES[active];

  return (
    <div className="grid overflow-hidden rounded-[32px] border border-ink/10 bg-canvas lg:grid-cols-[0.38fr_0.62fr]">
      <div className="border-b border-ink/10 p-3 lg:border-b-0 lg:border-r">
        {LAB_MODES.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(index)}
            aria-pressed={active === index}
            className={`flex w-full items-center justify-between rounded-[20px] px-5 py-5 text-left transition-colors ${
              active === index ? "bg-ink text-canvas" : "text-ink hover:bg-canvas-soft"
            }`}
          >
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] opacity-50">0{index + 1}</span>
              <span className="mt-1 block font-display text-lg font-extrabold">{item.label}</span>
            </span>
            <span className={`h-2.5 w-2.5 rounded-full ${active === index ? "bg-brand" : "bg-ink/15"}`} />
          </button>
        ))}
      </div>

      <div className="relative min-h-[32rem] overflow-hidden p-7 sm:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[52px] border-brand/45" />
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-positive-deep">{mode.eyebrow}</p>
            <h3 className="mt-4 max-w-xl text-balance font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-5xl">
              {mode.title}
            </h3>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-body sm:text-lg">{mode.body}</p>
          </div>

          <div className="mt-20 flex items-end justify-between gap-6 border-t border-ink/10 pt-6">
            <div>
              <p className="font-display text-3xl font-extrabold tracking-tight text-ink">{mode.metric}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-mute">{mode.metricLabel}</p>
            </div>
            <div className="protocol-pulse grid h-20 w-20 place-items-center rounded-full border border-ink/10 bg-brand-pale">
              <span className="h-3 w-3 rounded-full bg-positive" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImmersiveLanding() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const gsapContext = gsap.context(() => {
      gsap.from("[data-hero-reveal]", {
        y: 36,
        duration: 0.7,
        stagger: 0.06,
        ease: "power3.out",
      });

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, {
          y: 44,
          opacity: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 84%" },
        });
      });

      const chapters = gsap.utils.toArray<HTMLElement>("[data-model-chapter]");
      gsap.set(chapters, { autoAlpha: 0, y: 36 });
      gsap.set(chapters[0], { autoAlpha: 1, y: 0 });

      const modelTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: "[data-model-stage]",
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
        },
      });
      modelTimeline
        .to(chapters[0], { autoAlpha: 0, y: -30, duration: 0.18 })
        .to(chapters[1], { autoAlpha: 1, y: 0, duration: 0.2 }, "<0.04")
        .to(chapters[1], { autoAlpha: 0, y: -30, duration: 0.18 }, "+=0.34")
        .to(chapters[2], { autoAlpha: 1, y: 0, duration: 0.2 }, "<0.04");

      gsap.to("[data-marquee-track]", {
        xPercent: -32,
        ease: "none",
        scrollTrigger: {
          trigger: "[data-marquee]",
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });

      gsap.to("[data-scroll-progress]", {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: true },
      });
    }, root);

    return () => gsapContext.revert();
  }, []);

  return (
    <div ref={rootRef} data-immersive-landing className="relative isolate overflow-clip bg-canvas-soft">
      <LandingVisual />

      <div className="pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 md:block">
        <div className="h-24 w-px overflow-hidden bg-ink/15">
          <span data-scroll-progress className="block h-full w-full origin-top scale-y-0 bg-ink" />
        </div>
      </div>

      <section className="relative min-h-[calc(100svh-65px)] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_35%,rgba(159,232,112,0.5),transparent_31%),radial-gradient(circle_at_8%_10%,rgba(255,255,255,0.96),transparent_28%)]" />
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-65px)] max-w-container items-center px-4 py-16 sm:px-6">
          <div className="max-w-[48rem]">
            <div data-hero-reveal className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-canvas/70 px-3 py-1.5 text-xs font-bold text-ink-body backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-positive" />
              WETH-1 · Liquid asset engine
            </div>
            <h1 data-hero-reveal className="mt-6 text-balance font-display text-[clamp(4rem,9vw,8.3rem)] font-extrabold leading-[0.82] tracking-[-0.07em] text-ink">
              Wrapped.
              <br />
              <span className="text-positive-deep">Rewired.</span>
            </h1>
            <p data-hero-reveal className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-ink-body sm:text-xl">
              One WETH position. Multiple on-chain routes to stake, farm, trade, and compound—without handing over control.
            </p>
            <div data-hero-reveal className="mt-8 flex flex-wrap gap-3">
              <Link href="/stake" className="group inline-flex items-center gap-3 rounded-card bg-ink px-6 py-3.5 font-bold text-canvas transition-transform hover:-translate-y-0.5">
                Launch app
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-ink"><Arrow /></span>
              </Link>
              <Link href="#model" className="rounded-card border border-ink/20 bg-canvas/55 px-6 py-3.5 font-bold text-ink backdrop-blur-md transition-colors hover:bg-canvas">
                Meet WETH-1
              </Link>
            </div>
          </div>

          <div className="absolute bottom-5 left-4 flex items-end gap-3 sm:left-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">Scroll to deploy</span>
            <span className="h-10 w-px overflow-hidden bg-ink/15"><span className="landing-scroll-pulse block h-3 w-px bg-ink" /></span>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-ink px-4 py-24 text-canvas sm:px-6 sm:py-32">
        <div className="mx-auto max-w-container">
          <div data-reveal className="max-w-5xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Not merely wrapped</p>
            <h2 className="mt-6 text-balance font-display text-[clamp(3.5rem,8vw,7.5rem)] font-extrabold leading-[0.86] tracking-[-0.06em]">
              WETH isn&apos;t just ETH in a token.
            </h2>
          </div>
          <div className="mt-16 grid gap-8 border-t border-canvas/15 pt-8 md:grid-cols-[1fr_1fr]">
            <p data-reveal className="text-xl font-semibold leading-relaxed text-canvas-soft/75 sm:text-2xl">
              It is the common language connecting staking contracts, emission engines, liquidity, and composable rewards.
            </p>
            <div data-reveal className="grid grid-cols-2 gap-3">
              {[["46630", "testnet chain"], ["7 days", "reward cycle"], ["2", "farm pools"], ["1", "focused market"]].map(([value, label]) => (
                <div key={label} className="rounded-card border border-canvas/10 bg-canvas/[0.04] p-5">
                  <p className="font-display text-2xl font-extrabold text-brand">{value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em] text-canvas-soft/45">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="model" data-model-stage className="relative h-[330svh] bg-brand">
        <div className="sticky top-[65px] z-[2] h-[calc(100svh-65px)] overflow-hidden">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(14,15,12,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(14,15,12,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
          <div className="relative z-10 mx-auto h-full max-w-container px-4 sm:px-6">
            <div className="flex items-center justify-between border-b border-ink/15 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-body">
              <span>WETH-1 protocol model</span>
              <span className="hidden sm:inline">Scroll-calibrated product view</span>
              <span>v1.0</span>
            </div>

            <div className="relative h-[calc(100%-57px)]">
              {MODEL_CHAPTERS.map((chapter, index) => (
                <article
                  key={chapter.number}
                  data-model-chapter
                  className={`absolute bottom-8 z-10 w-full max-w-md rounded-[28px] border border-ink/15 bg-canvas/[0.96] p-6 shadow-[0_24px_80px_-24px_rgba(14,15,12,0.34)] backdrop-blur-xl sm:bottom-10 sm:p-8 ${
                    index === 1 ? "right-0" : "left-0"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-ink-body">
                    <span>{chapter.number}</span>
                    <span>{chapter.kicker}</span>
                  </div>
                  <h3 className="mt-6 text-balance font-display text-3xl font-extrabold leading-[0.98] tracking-tight text-ink sm:text-4xl">{chapter.title}</h3>
                  <p className="mt-4 leading-relaxed text-ink-body">{chapter.body}</p>
                  <div className="mt-7 flex items-end justify-between border-t border-ink/10 pt-5">
                    <Link href={chapter.href} className="group inline-flex items-center gap-2 text-sm font-bold text-positive-deep">
                      {chapter.action}<span className="transition-transform group-hover:translate-x-1"><Arrow /></span>
                    </Link>
                    <div className="text-right">
                      <p className="font-display text-2xl font-extrabold text-ink">{chapter.stat}</p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink-mute">{chapter.label}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section data-marquee className="relative z-10 overflow-hidden bg-ink py-7 text-brand">
        <div data-marquee-track className="flex w-max items-center gap-8 whitespace-nowrap font-display text-5xl font-extrabold uppercase tracking-[-0.05em] sm:text-7xl">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="flex items-center gap-8">
              Wrap <i className="h-4 w-4 rounded-full bg-canvas" /> Stake <i className="h-4 w-4 rounded-full bg-canvas" /> Farm <i className="h-4 w-4 rounded-full bg-canvas" /> Swap <i className="h-4 w-4 rounded-full bg-canvas" /> Compound <i className="h-4 w-4 rounded-full bg-canvas" />
            </span>
          ))}
        </div>
      </section>

      <section className="relative z-10 bg-canvas-soft py-20 sm:py-28">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div data-reveal className="grid gap-6 lg:grid-cols-[0.65fr_0.35fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-positive-deep">Protocol lab</p>
              <h2 className="mt-4 max-w-4xl text-balance font-display text-5xl font-extrabold leading-[0.91] tracking-[-0.05em] text-ink sm:text-7xl">
                Sophisticated where it matters.
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-ink-body">Inspect the mechanics underneath the interface. Switch modes to see how each part of the system earns its place.</p>
          </div>
          <div data-reveal className="mt-12"><ProtocolLab /></div>
        </div>
      </section>

      <section className="relative z-10 bg-canvas py-20 sm:py-28">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div data-reveal className="flex flex-col gap-6 border-b border-ink/15 pb-10 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-positive-deep">Choose your engine</p>
              <h2 className="mt-4 text-balance font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.05em] text-ink sm:text-7xl">Four routes. One wallet.</h2>
            </div>
            <Link href="/tokenomics" className="inline-flex items-center gap-2 font-bold text-ink hover:text-positive-deep">Open tokenomics lab <Arrow diagonal /></Link>
          </div>

          <div className="divide-y divide-ink/10">
            {PRODUCTS.map((product) => (
              <Link key={product.index} data-reveal href={product.href} className="product-row group grid gap-5 py-8 md:grid-cols-[0.1fr_0.3fr_0.22fr_0.3fr_0.08fr] md:items-center">
                <span className="text-xs font-bold text-ink-mute">{product.index}</span>
                <div>
                  <h3 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{product.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-positive-deep">{product.model}</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-ink-body">
                  <span className="rounded-full bg-canvas-soft px-3 py-1.5">{product.input}</span>
                  <span>→</span>
                  <span className="rounded-full bg-brand-pale px-3 py-1.5">{product.output}</span>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-ink-body">{product.description}</p>
                <span className="grid h-11 w-11 place-items-center rounded-full bg-canvas-soft text-ink transition-colors group-hover:bg-brand"><Arrow diagonal /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="security" className="relative z-10 bg-brand py-20 sm:py-28">
        <div className="mx-auto max-w-container px-4 sm:px-6">
          <div data-reveal className="grid gap-12 lg:grid-cols-[0.62fr_0.38fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-positive-deep">Protocol note 01</p>
              <h2 className="mt-5 text-balance font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.05em] text-ink sm:text-7xl">Control is the feature.</h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-body">The system uses reentrancy guards, explicit token-recovery restrictions, funded reward accounting, and withdrawal paths that remain available when new deposits are paused.</p>
            </div>
            <div className="rounded-[28px] bg-ink p-7 text-canvas sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Specification</p>
              <dl className="mt-8 divide-y divide-canvas/15 text-sm">
                {[["Network", "Robinhood Testnet"], ["Chain ID", "46630"], ["Custody", "Non-custodial"], ["Withdrawals", "Always available"], ["Audit status", "Independent audit required"]].map(([term, value]) => (
                  <div key={term} className="flex items-center justify-between gap-5 py-4">
                    <dt className="text-canvas-soft/50">{term}</dt>
                    <dd className="text-right font-bold text-canvas">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-canvas-soft px-4 py-20 sm:px-6 sm:py-28">
        <div data-reveal className="relative mx-auto max-w-container overflow-hidden rounded-[38px] bg-ink px-6 py-16 text-center sm:px-10 sm:py-24">
          <div className="absolute left-1/2 top-0 h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-brand">WETH-1 is ready</p>
          <h2 className="relative mx-auto mt-5 max-w-5xl text-balance font-display text-5xl font-extrabold leading-[0.9] tracking-[-0.05em] text-canvas sm:text-7xl">Put the liquid asset engine to work.</h2>
          <p className="relative mx-auto mt-6 max-w-xl text-lg leading-relaxed text-canvas-soft/65">Connect a wallet, choose an earning route, and keep control from the first approval to the final exit.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/stake" className="inline-flex items-center gap-3 rounded-card bg-brand px-6 py-3.5 font-bold text-ink hover:bg-brand-active">Launch staking <Arrow /></Link>
            <Link href="/farm" className="rounded-card border border-canvas/25 px-6 py-3.5 font-bold text-canvas hover:border-canvas/60">Explore every route</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
