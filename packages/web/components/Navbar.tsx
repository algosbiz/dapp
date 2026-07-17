"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RwdPricePill } from "./RwdPricePill";

const navLinks = [
  { href: "/wrap", label: "Wrap" },
  { href: "/stake", label: "Stake" },
  { href: "/farm", label: "Farm" },
  { href: "/stake-rwd", label: "Stake RWD" },
  { href: "/pool", label: "Pool" },
  { href: "/tokenomics", label: "Tokenomics" },
  { href: "/#security", label: "Security" },
];

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <RwdPricePill />
          <div className="hidden md:block">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-control text-ink transition-colors hover:bg-ink/5 md:hidden"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="border-t border-ink/10 bg-canvas px-4 py-3 sm:px-6 md:hidden"
        >
          <div className="flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-control px-2 py-3 text-base font-semibold text-ink-body transition-colors hover:bg-ink/5 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 border-t border-ink/10 pt-4">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
        </nav>
      )}
    </header>
  );
}
