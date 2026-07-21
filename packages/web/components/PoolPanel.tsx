"use client";

import { useWethRwdPoolData } from "@/hooks/useWethRwdPool";
import { formatUsdPrice, useFlxPrice } from "@/hooks/useFlxPrice";
import { formatTokenSmart } from "@/lib/format";

export function PoolPanel() {
  const { reserve0, reserve1 } = useWethRwdPoolData();
  const price = useFlxPrice();

  const spotPrice =
    reserve0 !== undefined && reserve1 !== undefined && reserve0 > 0n
      ? (reserve1 * 10n ** 18n) / reserve0
      : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">WETH in pool</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatTokenSmart(reserve0)} <span className="text-lg font-semibold text-ink-body">WETH</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">FLX in pool</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatTokenSmart(reserve1)} <span className="text-lg font-semibold text-ink-body">FLX</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">FLX price</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatUsdPrice(price?.usdPerFlx)}
        </p>
        {/* The pool ratio still matters when sizing a swap or a liquidity add, so it stays —
            demoted to a caption rather than removed. */}
        <p className="mt-1.5 text-xs text-ink-body">
          {formatTokenSmart(spotPrice)} FLX / WETH · via live ETH price
        </p>
      </div>
    </div>
  );
}
