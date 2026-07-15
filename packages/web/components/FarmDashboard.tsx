"use client";

import { useFarmData } from "@/hooks/useFarm";
import { formatToken } from "@/lib/format";

export function FarmDashboard() {
  const { poolStaked, rewardPerSecond } = useFarmData();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <span className="text-lg font-semibold text-ink-body">RWD / sec</span>
        </p>
      </div>
    </div>
  );
}
