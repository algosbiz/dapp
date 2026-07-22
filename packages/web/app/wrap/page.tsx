import Link from "next/link";
import { WrapPanel } from "@/components/WrapPanel";

export const metadata = {
  title: "Wrap ETH | $FLEX Staking",
};

export default function WrapPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-body transition-colors hover:text-ink"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <header className="mt-5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Wrap ETH → WETH
        </h1>
        <p className="mt-2 text-pretty text-base leading-relaxed text-ink-body">
          Everything in this app uses WETH (wrapped ETH). Convert the ETH in your wallet into
          WETH here — it&apos;s a 1:1 swap you can reverse any time. New to testnet? Grab some ETH
          from the{" "}
          <a
            href="https://faucet.testnet.chain.robinhood.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-positive underline decoration-positive/40 underline-offset-2 transition-colors hover:text-positive-deep"
          >
            Robinhood Chain faucet
          </a>{" "}
          first, then wrap it below.
        </p>
      </header>

      <div className="mt-8">
        <WrapPanel />
      </div>
    </div>
  );
}
