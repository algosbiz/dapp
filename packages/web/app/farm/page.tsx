import Link from "next/link";
import { FarmDashboard } from "@/components/FarmDashboard";
import { FarmPanel } from "@/components/FarmPanel";
import { LiquidityPanel } from "@/components/LiquidityPanel";
import { LpFarmDashboard } from "@/components/LpFarmDashboard";
import { LpFarmPanel } from "@/components/LpFarmPanel";
import { PoolPanel } from "@/components/PoolPanel";
import { SupplyPanel } from "@/components/SupplyPanel";
import { SwapPanel } from "@/components/SwapPanel";

export const metadata = {
  title: "Farm | $FLEX Staking",
};

// Always re-read the on-disk snapshot history instead of serving a build-time copy.
export const dynamic = "force-dynamic";

export default function FarmPage() {
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
          MasterChef · rewards minted every second
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          WETH Farm
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Deposit WETH and earn freshly minted FLX every second. Rewards are minted on demand — the
          emission never runs out. Harvest, withdraw, or emergency-exit at any time.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <FarmDashboard />
        <FarmPanel />

        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            LP farm
          </h2>
          <p className="mt-1 text-sm text-ink-body">
            Stake WETH-FLEX-LP tokens (from adding liquidity in the{" "}
            <a href="#pool" className="font-semibold text-positive hover:text-positive-deep">
              pool section
            </a>{" "}
            below) to earn FLX from the same farm.
          </p>
          <div className="mt-4 space-y-6">
            <LpFarmDashboard />
            <LpFarmPanel />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            FLX supply
          </h2>
          <p className="mt-1 text-sm text-ink-body">
            Tracked from daily snapshots — how fast new FLX is being minted, for monitoring
            inflation.
          </p>
          <div className="mt-4">
            <SupplyPanel />
          </div>
        </div>

        <div id="pool" className="scroll-mt-20">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            WETH / FLX pool
          </h2>
          <p className="mt-1 text-sm text-ink-body">
            The constant-product pool that gives FLX its market price. Swap WETH and FLX, or add
            liquidity to receive WETH-FLEX-LP tokens you can stake in the LP farm above. Founding
            liquidity was permanently burned — nobody, including the team, can withdraw it.
          </p>
          <div className="mt-4 space-y-6">
            <PoolPanel />
            <SwapPanel />
            <LiquidityPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
