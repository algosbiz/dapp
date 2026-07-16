"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { CONTRACTS } from "@/config/contracts";
import { convertByPoolPrice, APR_PRECISION } from "@/lib/apr";
import { useWethRwdPoolData } from "@/hooks/useWethRwdPool";
import { formatTokenSmart } from "@/lib/format";

const inputBase =
  "w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40";

function ratioHealth(ratioPercent: number): { label: string; color: string } {
  if (ratioPercent < 1) return { label: "Very fragile — small trades will swing the price a lot", color: "text-negative-deep" };
  if (ratioPercent < 5) return { label: "Thin — still risky", color: "text-warning-deep" };
  if (ratioPercent <= 20) return { label: "Reasonable starting point", color: "text-positive-deep" };
  return { label: "Very deep — conservative", color: "text-positive-deep" };
}

export function TokenomicsCalculator() {
  const [targetMarketCap, setTargetMarketCap] = useState("10000");
  const [liquidityBudget, setLiquidityBudget] = useState("1000");

  const totalSupplyRead = useReadContract({
    address: CONTRACTS.rwdToken,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });
  const { reserve0, reserve1 } = useWethRwdPoolData();

  const totalSupply = totalSupplyRead.data;
  const totalSupplyNumber = totalSupply !== undefined ? Number(totalSupply) / 1e18 : undefined;

  const mc = Number(targetMarketCap) || 0;
  const budget = Number(liquidityBudget) || 0;

  const pricePerRwd = totalSupplyNumber && totalSupplyNumber > 0 ? mc / totalSupplyNumber : undefined;
  const wethSide = budget / 2;
  const rwdSide = pricePerRwd && pricePerRwd > 0 ? wethSide / pricePerRwd : undefined;
  const targetRatio = mc > 0 ? (budget / mc) * 100 : undefined;
  const health = targetRatio !== undefined ? ratioHealth(targetRatio) : undefined;

  // Current live pool, for comparison — reuses the same math as the Market Cap tile on /farm.
  const current = useMemo(() => {
    if (reserve0 === undefined || reserve1 === undefined || totalSupply === undefined || reserve1 === 0n) {
      return undefined;
    }
    const priceRwdInWeth = convertByPoolPrice(APR_PRECISION, reserve1, reserve0);
    const marketCapInWeth = convertByPoolPrice(totalSupply, APR_PRECISION, priceRwdInWeth);
    const poolValueInWeth = 2n * reserve0;
    const ratio = marketCapInWeth > 0n ? (Number(poolValueInWeth) / Number(marketCapInWeth)) * 100 : undefined;
    return { poolValueInWeth, marketCapInWeth, ratio };
  }, [reserve0, reserve1, totalSupply]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Target scenario */}
      <div className="space-y-5 rounded-card bg-canvas p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Your target scenario</h2>

        <div>
          <label htmlFor="target-mc" className="mb-1.5 block text-sm font-semibold text-ink">
            Target market cap
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
              $
            </span>
            <input
              id="target-mc"
              type="text"
              inputMode="decimal"
              value={targetMarketCap}
              onChange={(e) => setTargetMarketCap(e.target.value)}
              className={`${inputBase} pl-8`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="liquidity-budget" className="mb-1.5 block text-sm font-semibold text-ink">
            Liquidity budget
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
              $
            </span>
            <input
              id="liquidity-budget"
              type="text"
              inputMode="decimal"
              value={liquidityBudget}
              onChange={(e) => setLiquidityBudget(e.target.value)}
              className={`${inputBase} pl-8`}
            />
          </div>
        </div>

        <div className="rounded-control bg-canvas-soft p-4 text-sm text-ink-body">
          Using the current live total supply:{" "}
          <span className="font-semibold text-ink">
            {totalSupplyNumber !== undefined ? totalSupplyNumber.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "…"} RWD
          </span>
        </div>

        <div className="space-y-3 border-t border-ink/10 pt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Implied price per RWD</span>
            <span className="text-lg font-bold text-ink">
              {pricePerRwd !== undefined ? `$${pricePerRwd.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Deposit — WETH side</span>
            <span className="text-lg font-bold text-ink">${wethSide.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Deposit — RWD side</span>
            <span className="text-lg font-bold text-ink">
              {rwdSide !== undefined
                ? `${rwdSide.toLocaleString(undefined, { maximumFractionDigits: 2 })} RWD`
                : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Liquidity ÷ market cap</span>
            <span className="text-lg font-bold text-ink">
              {targetRatio !== undefined ? `${targetRatio.toLocaleString(undefined, { maximumFractionDigits: 3 })}%` : "—"}
            </span>
          </div>
          {health && <p className={`text-sm font-semibold ${health.color}`}>{health.label}</p>}
        </div>
      </div>

      {/* Current live pool, for comparison */}
      <div className="space-y-5 rounded-card bg-canvas-soft p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Current live pool</h2>
        <p className="text-sm text-ink-body">
          Real numbers from the deployed contracts, in WETH terms (no USD price exists for
          testnet WETH — this is for comparing the <em>ratio</em> only).
        </p>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Pool value (both sides)</span>
            <span className="text-lg font-bold text-ink">
              {current ? `${formatTokenSmart(current.poolValueInWeth)} WETH` : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Market cap</span>
            <span className="text-lg font-bold text-ink">
              {current ? `${formatTokenSmart(current.marketCapInWeth)} WETH` : "—"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-body">Liquidity ÷ market cap</span>
            <span className="text-lg font-bold text-ink">
              {current?.ratio !== undefined ? `${current.ratio.toLocaleString(undefined, { maximumFractionDigits: 4 })}%` : "—"}
            </span>
          </div>
        </div>

        {current?.ratio !== undefined && targetRatio !== undefined && current.ratio > 0 && (
          <p className="rounded-control bg-canvas p-4 text-sm text-ink-body">
            Your target scenario's ratio is{" "}
            <span className="font-semibold text-ink">
              {(targetRatio / current.ratio).toLocaleString(undefined, { maximumFractionDigits: 0 })}x
            </span>{" "}
            higher (healthier) than the live pool's ratio right now.
          </p>
        )}
      </div>
    </div>
  );
}
