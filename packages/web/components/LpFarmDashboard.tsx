"use client";

import { useFarmData } from "@/hooks/useFarm";
import { CONTRACTS, FARM_LP_PID } from "@/config/contracts";
import { formatToken } from "@/lib/format";

export function LpFarmDashboard() {
  const { poolStaked, rewardPerSecond } = useFarmData(FARM_LP_PID, CONTRACTS.wethRwdPool);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total staked (WETH-RWD-LP pool)</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(poolStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">LP</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Farm-wide emission rate</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(rewardPerSecond.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">RWD / sec</span>
        </p>
      </div>
    </div>
  );
}
