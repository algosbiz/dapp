import Link from "next/link";
import { TokenomicsCalculator } from "@/components/TokenomicsCalculator";

export const metadata = {
  title: "Tokenomics Calculator | WETH Staking",
};

export default function TokenomicsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5 max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-warning-content/10 px-3 py-1 text-xs font-bold text-warning-deep">
          Planning tool · does not touch the blockchain
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Tokenomics Calculator
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Explore a target market cap and liquidity budget for FLX before committing real
          funds. Numbers here are purely illustrative — testnet WETH has no USD value, and
          nothing on this page ever sends a transaction. Compare against the live pool below
          to see how much liquidity a given target would actually need.
        </p>
      </header>

      <div className="mt-8">
        <TokenomicsCalculator />
      </div>
    </div>
  );
}
