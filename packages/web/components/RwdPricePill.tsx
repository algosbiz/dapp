"use client";

import { formatUsdPrice, useFlxPrice } from "@/hooks/useFlxPrice";

/**
 * FLX price in the navbar. Reads the same `/api/flx-price` endpoint as the /pool spot-price
 * tile so the two can never disagree — they previously did, because this pill was a hardcoded
 * $0.05 placeholder from before FLX had a pool at all, roughly 260x the real derived price.
 *
 * Still labelled "est." rather than presented as a market price: the ETH/USD leg is real, but
 * the FLX/WETH leg comes from our own shallow testnet pool, so this is what FLX *would* be
 * worth at today's ETH price — not a traded price on any exchange.
 */
export function RwdPricePill() {
  const price = useFlxPrice();

  // Render nothing until there's a real number — showing a stand-in figure here is precisely
  // what caused the confusion this replaced.
  if (!price || price.usdPerFlx === null) return null;

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-canvas-soft py-1.5 pl-3 pr-1.5 lg:inline-flex"
      title="Derived from the live WETH/FLEX pool ratio and today's ETH/USD price. FLX isn't listed on any exchange, so this is an estimate, not a market price."
      aria-label={`Estimated price: 1 FLX is approximately ${formatUsdPrice(price.usdPerFlx)} US dollars, derived from the pool ratio and today's ETH price.`}
    >
      <span className="text-xs font-bold text-ink">1 FLX ≈ {formatUsdPrice(price.usdPerFlx)}</span>
      <span className="rounded-full bg-positive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-positive-deep">
        Est.
      </span>
    </span>
  );
}
