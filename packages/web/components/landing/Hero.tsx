import Link from "next/link";
import { NetworkGlobe } from "@/components/landing/NetworkGlobe";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-container items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        {/* Left — message */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink-body shadow-sm ring-1 ring-ink/5">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            Live on Robinhood Chain
          </span>

          <h1 className="mt-5 text-balance font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Put your WETH to work.
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-ink-body sm:text-xl">
            Stake WETH on Robinhood Chain and earn reward tokens that stream in every second.
            Non-custodial from start to finish — withdraw or claim whenever you want.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/stake"
              className="rounded-card bg-brand px-6 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active"
            >
              Start staking
            </Link>
            <Link
              href="#how"
              className="rounded-card border border-ink/20 bg-canvas px-6 py-3.5 text-base font-bold text-ink transition-colors hover:border-ink"
            >
              How it works
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-body">
            <li className="flex items-center gap-2">
              <CheckDot /> Non-custodial
            </li>
            <li className="flex items-center gap-2">
              <CheckDot /> Withdraw anytime
            </li>
            <li className="flex items-center gap-2">
              <CheckDot /> 7-day reward cycles
            </li>
          </ul>
        </div>

        {/* Right — the network itself, as an object you can push around */}
        <div className="lg:justify-self-end">
          <NetworkGlobe />
        </div>
      </div>
    </section>
  );
}

function CheckDot() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#9fe870" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="#0e0f0c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
