import Link from "next/link";
import { RwdStakingDashboard } from "@/components/RwdStakingDashboard";
import { RwdStakingPanel } from "@/components/RwdStakingPanel";

export const metadata = {
  title: "Stake FLX | $FLEX Staking",
};

export default function StakeRwdPage() {
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
          Stake FLX
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Lock up FLX you've earned from the farm to earn more FLX on top of it. A
          fixed reward budget is funded upfront and pays out over a set period — not
          minted on demand.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <RwdStakingDashboard />
        <RwdStakingPanel />
      </div>
    </div>
  );
}
