"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RwdPricePill } from "./RwdPricePill";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const navEntries: NavEntry[] = [
  { href: "/wrap", label: "Wrap" },
  {
    label: "Earn",
    items: [
      { href: "/stake", label: "Stake" },
      { href: "/farm", label: "Farm" },
      { href: "/stake-rwd", label: "Stake FLX" },
      { href: "/lock", label: "Lock FLX" },
    ],
  },
  { href: "/pool", label: "Pool" },
  {
    label: "More",
    items: [
      { href: "/tokenomics", label: "Tokenomics" },
      { href: "/emissions", label: "Emissions" },
      { href: "/#security", label: "Security" },
    ],
  },
];

const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

/** Route-path portion of an href (drops any #hash), for active-state matching. */
const pathOf = (href: string) => href.split("#")[0];

/**
 * The FLEX mark. `token-mark.png` is the supplied `token.png` cropped to just the globe emblem
 * (dropping the "$FLEX" wordmark, which is redundant next to the "$FLEX Staking" text and
 * illegible at 32px) and resized down from 500px. Not round-clipped: the emblem sits on
 * transparency and its orbit lines reach the corners, so a circular mask would clip them.
 * Regenerate after swapping token.png:
 *   ffmpeg -y -i token.png -vf "crop=400:400:50:0,scale=160:160:flags=lanczos" token-mark.png
 */
function FlexMark() {
  return <Image src="/token-mark.png" alt="" width={32} height={32} priority className="h-8 w-8" />;
}

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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Desktop-only dropdown grouping several same-function links under one trigger. */
function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = group.items.some((item) => pathname === pathOf(item.href) && pathOf(item.href) !== "/");

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close after navigating to one of its items.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    // Click-to-open (not hover): a hover menu closes the moment the cursor crosses the gap
    // between trigger and menu, which reads as "it disappears when I try to click it".
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {group.label}
        <Chevron open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 min-w-[11rem] rounded-control border border-ink/10 bg-canvas p-1.5 shadow-card"
        >
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={`block rounded-control px-3 py-2 text-sm font-semibold transition-colors hover:bg-ink/5 hover:text-ink ${
                pathname === pathOf(item.href) && pathOf(item.href) !== "/" ? "text-ink" : "text-ink-body"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
          <FlexMark />
          <span className="font-display text-base font-extrabold tracking-tight text-ink">
            $FLEX Staking
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-body md:flex">
          {navEntries.map((entry) =>
            isGroup(entry) ? (
              <NavDropdown key={entry.label} group={entry} pathname={pathname} />
            ) : (
              <Link key={entry.href} href={entry.href} className="transition-colors hover:text-ink">
                {entry.label}
              </Link>
            )
          )}
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
        <nav id="mobile-nav" className="border-t border-ink/10 bg-canvas px-4 py-3 sm:px-6 md:hidden">
          <div className="flex flex-col">
            {navEntries.map((entry) =>
              isGroup(entry) ? (
                <div key={entry.label} className="py-1">
                  <p className="px-2 pt-2 text-xs font-semibold text-ink-body/60">{entry.label}</p>
                  {entry.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-control px-2 py-3 text-base font-semibold text-ink-body transition-colors hover:bg-ink/5 hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="rounded-control px-2 py-3 text-base font-semibold text-ink-body transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  {entry.label}
                </Link>
              )
            )}
          </div>
          <div className="mt-2 border-t border-ink/10 pt-4">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
        </nav>
      )}
    </header>
  );
}
