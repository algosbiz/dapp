import Link from "next/link";
import { Dashboard } from "@/components/Dashboard";
import { StakingPanel } from "@/components/StakingPanel";
import { RwdStakingDashboard } from "@/components/RwdStakingDashboard";
import { RwdStakingPanel } from "@/components/RwdStakingPanel";

export const metadata = {
  title: "Stake | $FLEX Staking",
};

export default function StakePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5 max-w-2xl">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Stake
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Two ways to earn, in one place. Stake WETH to earn FLX, or stake the FLX you've
          earned to make even more FLX.
        </p>
      </header>

      {/* Stake WETH — deposit WETH, earn FLX rewards */}
      <section className="mt-10" aria-labelledby="stake-weth-heading">
        <h2
          id="stake-weth-heading"
          className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
        >
          Stake WETH
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-ink-body">
          Deposit WETH to start earning reward tokens. Rewards accrue every second — claim,
          withdraw, or exit at any time.
        </p>
        <div className="mt-6 space-y-6">
          <Dashboard />
          <StakingPanel />
        </div>
      </section>

      {/* Stake FLX — lock earned FLX, earn more FLX */}
      <section
        className="mt-12 border-t border-ink/10 pt-12"
        aria-labelledby="stake-flx-heading"
      >
        <h2
          id="stake-flx-heading"
          className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
        >
          Stake FLX
        </h2>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-ink-body">
          Lock up FLX you've earned from the farm to earn more FLX on top of it. A fixed
          reward budget is funded upfront and pays out over a set period — not minted on
          demand.
        </p>
        <div className="mt-6 space-y-6">
          <RwdStakingDashboard />
          <RwdStakingPanel />
        </div>
      </section>
    </div>
  );
}
