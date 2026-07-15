import Link from "next/link";
import { LiquidityPanel } from "@/components/LiquidityPanel";
import { PoolPanel } from "@/components/PoolPanel";
import { SwapPanel } from "@/components/SwapPanel";

export const metadata = {
  title: "WETH/RWD Pool | WETH Staking",
};

export default function PoolPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-pale px-3 py-1 text-xs font-bold text-positive-deep">
          WETH/RWD pool · founding liquidity permanently locked
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          WETH / RWD Pool
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          A constant-product liquidity pool giving RWD a market price. The founding
          liquidity was permanently burned — nobody, including the team, can ever
          withdraw it.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <PoolPanel />
        <SwapPanel />
        <LiquidityPanel />
      </div>
    </div>
  );
}
