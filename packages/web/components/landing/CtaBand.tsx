import Link from "next/link";

export function CtaBand() {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:pb-24">
      <div className="mx-auto max-w-container overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center sm:px-10 sm:py-20">
        <h2 className="mx-auto max-w-3xl text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-brand sm:text-5xl">
          Ready to put your WETH to work?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-canvas-soft/80">
          Connect your wallet, stake in a couple of clicks, and start earning rewards that stream
          in every second.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/stake"
            className="rounded-card bg-brand px-6 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active"
          >
            Start staking
          </Link>
          <Link
            href="https://docs.robinhood.com/chain/connecting/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-card border border-canvas-soft/25 px-6 py-3.5 text-base font-bold text-canvas-soft transition-colors hover:border-canvas-soft/60 hover:text-canvas"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}
