"use client";

import { useAccount } from "wagmi";
import { useRwdStakingData } from "@/hooks/useRwdStaking";
import { computeAprPercent, formatAprDisplay, SECONDS_PER_YEAR } from "@/lib/apr";
import { formatToken } from "@/lib/format";

export function RwdStakingDashboard() {
  const { address } = useAccount();
  const { rwdBalance, totalStaked, rewardRate } = useRwdStakingData();

  let apr: number | undefined;
  if (rewardRate.data !== undefined && totalStaked.data !== undefined) {
    const annualReward = rewardRate.data * SECONDS_PER_YEAR;
    apr = computeAprPercent(annualReward, totalStaked.data);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total FLX locked in this pool</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(totalStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">FLX</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Your wallet FLX balance</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {address ? formatToken(rwdBalance.data) : "—"}{" "}
          <span className="text-lg font-semibold text-ink-body">
            {address ? "FLX" : "Connect wallet"}
          </span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">APR (est.)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{formatAprDisplay(apr)}</p>
        <p className="mt-1 text-xs text-ink-body">Based on the current funded reward rate &amp; pool size.</p>
      </div>
    </div>
  );
}
