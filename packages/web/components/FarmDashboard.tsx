"use client";

import { useReadContract } from "wagmi";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { CONTRACTS } from "@/config/contracts";
import { computeAnnualPoolReward, computeAprPercent, convertByPoolPrice, formatAprDisplay } from "@/lib/apr";
import { useFarmData } from "@/hooks/useFarm";
import { formatToken } from "@/lib/format";

const PRECISION = 10n ** 18n;

export function FarmDashboard() {
  const { poolStaked, rewardPerSecond, allocPoint, totalAllocPoint } = useFarmData();

  const reserves = useReadContract({
    address: CONTRACTS.wethRwdPool,
    abi: wethRwdPoolAbi,
    functionName: "getReserves",
    query: { refetchInterval: 15_000 },
  });
  const reserve0 = reserves.data?.[0]; // WETH
  const reserve1 = reserves.data?.[1]; // FLX

  let apr: number | undefined;
  if (
    rewardPerSecond.data !== undefined &&
    allocPoint !== undefined &&
    totalAllocPoint.data !== undefined &&
    reserve0 !== undefined &&
    reserve1 !== undefined &&
    poolStaked.data !== undefined
  ) {
    const rwdPriceInWeth = convertByPoolPrice(PRECISION, reserve1, reserve0);
    const annualReward = computeAnnualPoolReward(rewardPerSecond.data, allocPoint, totalAllocPoint.data);
    const annualRewardInWeth = convertByPoolPrice(annualReward, PRECISION, rwdPriceInWeth);
    apr = computeAprPercent(annualRewardInWeth, poolStaked.data);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total staked (WETH pool)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(poolStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">WETH</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Emission rate</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(rewardPerSecond.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">FLX / sec</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">APR (est.)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{formatAprDisplay(apr)}</p>
        <p className="mt-1 text-xs text-ink-body">Based on the current /pool price &amp; TVL — moves as both change.</p>
      </div>
    </div>
  );
}
