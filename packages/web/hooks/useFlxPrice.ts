"use client";

import { useEffect, useState } from "react";

export type FlxPrice = {
  /** USD per 1 FLX. Null when the pool is empty or the ETH/USD feed is unavailable. */
  usdPerFlx: number | null;
  /** FLX received per 1 WETH — the raw pool ratio, shown as supporting detail. */
  flxPerWeth: number | null;
  ethUsd: number | null;
};

/**
 * Reads the shared price endpoint so every surface showing an FLX price shows the same one.
 * Deliberately not a per-component calculation: the navbar pill and the pool tile disagreeing
 * is the exact problem this replaced.
 */
export function useFlxPrice() {
  const [price, setPrice] = useState<FlxPrice | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/flx-price")
      .then((res) => (res.ok ? res.json() : undefined))
      .then((data) => {
        if (!cancelled && data) setPrice(data as FlxPrice);
      })
      .catch(() => {
        // Leave undefined — callers render a dash rather than a wrong number.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return price;
}

/**
 * Formats a USD price that can span several orders of magnitude. A fixed 2-decimal format
 * would render a genuine $0.00019 as "$0.00" — the same "fixed decimals hide real values"
 * trap this project has hit repeatedly — so small values switch to significant digits.
 */
export function formatUsdPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  if (value >= 0.01) {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString(undefined, { maximumSignificantDigits: 4 })}`;
}
