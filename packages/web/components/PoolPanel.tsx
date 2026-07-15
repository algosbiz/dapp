"use client";

import { useWethRwdPoolData } from "@/hooks/useWethRwdPool";
import { formatTokenSmart } from "@/lib/format";

export function PoolPanel() {
  const { reserve0, reserve1 } = useWethRwdPoolData();

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
        <p className="text-sm font-semibold text-ink-body">RWD in pool</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatTokenSmart(reserve1)} <span className="text-lg font-semibold text-ink-body">RWD</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Spot price</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatTokenSmart(spotPrice)} <span className="text-lg font-semibold text-ink-body">RWD / WETH</span>
        </p>
      </div>
    </div>
  );
}
