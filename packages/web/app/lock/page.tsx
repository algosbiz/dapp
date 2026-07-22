import Link from "next/link";
import { LockedStakingPanel } from "@/components/LockedStakingPanel";

export const metadata = {
  title: "Lock FLX | $FLEX Staking",
};

export default function LockPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-warning-content/10 px-3 py-1 text-xs font-bold text-warning-content">
          Deflationary — early exit burns FLX
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Lock FLX
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Commit your FLX for 1, 2, or 3 months and earn more FLX — longer locks earn a higher
          rate. Leaving before the term ends burns 5% of your stake forever, so this is the one
          place FLX supply can go <em>down</em>: the mirror image of the farm&apos;s minting.
        </p>
      </header>

      <div className="mt-8">
        <LockedStakingPanel />
      </div>
    </div>
  );
}
