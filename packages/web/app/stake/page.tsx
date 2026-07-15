import Link from "next/link";
import { Dashboard } from "@/components/Dashboard";
import { StakingPanel } from "@/components/StakingPanel";

export const metadata = {
  title: "Stake WETH | WETH Staking",
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
          Stake WETH
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Deposit WETH to start earning reward tokens. Rewards accrue every second — claim,
          withdraw, or exit at any time.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <Dashboard />
        <StakingPanel />
      </div>
    </div>
  );
}
