import Link from "next/link";

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

        {/* Right — staking preview card (product mockup) */}
        <div className="lg:justify-self-end">
          <StakePreviewCard />
        </div>
      </div>
    </section>
  );
}

function StakePreviewCard() {
  return (
    <div className="w-full max-w-md rounded-[28px] bg-canvas p-6 shadow-card ring-1 ring-ink/5 sm:p-7">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink">Staking preview</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-positive-deep">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
          Earning
        </span>
      </div>

      <div className="mt-5 space-y-2">
        {/* You stake */}
        <div className="rounded-control bg-canvas-soft p-4">
          <p className="text-xs font-semibold text-ink-body">You stake</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-display text-3xl font-extrabold tracking-tight text-ink">1.0</span>
            <TokenPill code="WETH" tone="ink" />
          </div>
        </div>

        {/* connector */}
        <div className="relative flex justify-center">
          <span className="absolute -top-4 grid h-8 w-8 place-items-center rounded-full bg-brand text-ink ring-4 ring-canvas">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 5v14M12 19l-5-5M12 19l5-5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        {/* You earn */}
        <div className="rounded-control bg-brand-pale p-4">
          <p className="text-xs font-semibold text-positive-deep">You earn</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="font-display text-3xl font-extrabold tracking-tight text-ink">RWD</span>
            <TokenPill code="Streaming" tone="green" />
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-ink-body">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
          <rect x="4" y="10" width="16" height="10" rx="2.5" stroke="#0e0f0c" strokeWidth="1.7" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#0e0f0c" strokeWidth="1.7" />
        </svg>
        Your WETH never leaves your control. Reward rate is funded up front, so the pool can only
        promise what it actually holds.
      </p>
    </div>
  );
}

function TokenPill({ code, tone }: { code: string; tone: "ink" | "green" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-sm font-bold text-ink shadow-sm ring-1 ring-ink/10">
      <span
        className={`h-2.5 w-2.5 rounded-full ${tone === "green" ? "bg-brand" : "bg-ink"}`}
        aria-hidden="true"
      />
      {code}
    </span>
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
