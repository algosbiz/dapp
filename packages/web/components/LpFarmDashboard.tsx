"use client";

import { useFarmData } from "@/hooks/useFarm";
import { useWethRwdPoolData } from "@/hooks/useWethRwdPool";
import { CONTRACTS, FARM_LP_PID } from "@/config/contracts";
import { computeAnnualPoolReward, computeAprPercent, convertByPoolPrice, formatAprDisplay } from "@/lib/apr";
import { formatToken } from "@/lib/format";

const PRECISION = 10n ** 18n;

export function LpFarmDashboard() {
  const { poolStaked, rewardPerSecond, allocPoint, totalAllocPoint } = useFarmData(
    FARM_LP_PID,
    CONTRACTS.wethRwdPool
  );
  const { reserve0, reserve1, totalSupply } = useWethRwdPoolData();

  let apr: number | undefined;
  if (
    rewardPerSecond.data !== undefined &&
    allocPoint !== undefined &&
    totalAllocPoint.data !== undefined &&
    reserve0 !== undefined &&
    reserve1 !== undefined &&
    totalSupply.data !== undefined &&
    poolStaked.data !== undefined
  ) {
    const rwdPriceInWeth = convertByPoolPrice(PRECISION, reserve1, reserve0);
    const annualReward = computeAnnualPoolReward(rewardPerSecond.data, allocPoint, totalAllocPoint.data);
    const annualRewardInWeth = convertByPoolPrice(annualReward, PRECISION, rwdPriceInWeth);
    // A balanced pool's total value in WETH terms is reserve0 + (reserve1 priced in WETH) = 2 * reserve0.
    const lpValueInWeth = convertByPoolPrice(poolStaked.data, totalSupply.data, 2n * reserve0);
    apr = computeAprPercent(annualRewardInWeth, lpValueInWeth);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total staked (WETH-FLEX-LP pool)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(poolStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">LP</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Farm-wide emission rate</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(rewardPerSecond.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">FLX / sec</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">APR (est.)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{formatAprDisplay(apr)}</p>
        <p className="mt-1 text-xs text-ink-body">Based on the current pool price &amp; TVL — moves as both change.</p>
      </div>
    </div>
  );
}
