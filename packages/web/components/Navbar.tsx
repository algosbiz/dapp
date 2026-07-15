"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-control bg-brand text-base font-black text-ink">
            W
          </span>
          <span className="font-display text-base font-extrabold tracking-tight text-ink">
            WETH Staking
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-body md:flex">
          <Link href="/stake" className="transition-colors hover:text-ink">
            Stake
          </Link>
          <Link href="/farm" className="transition-colors hover:text-ink">
            Farm
          </Link>
          <Link href="/stake-rwd" className="transition-colors hover:text-ink">
            Stake RWD
          </Link>
          <Link href="/#security" className="transition-colors hover:text-ink">
            Security
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
          <Link
            href="/stake"
            className="rounded-card bg-brand px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-brand-active"
          >
            Start staking
          </Link>
        </div>
      </div>
    </header>
  );
}
