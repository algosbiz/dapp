"use client";

import { useAccount } from "wagmi";
import { useStakingData } from "@/hooks/useStaking";
import { formatToken } from "@/lib/format";

export function Dashboard() {
  const { address } = useAccount();
  const { wethBalance, totalStaked } = useStakingData();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total value locked</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(totalStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">WETH</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Your WETH balance</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {address ? formatToken(wethBalance.data) : "—"}{" "}
          <span className="text-lg font-semibold text-ink-body">
            {address ? "WETH" : "Connect wallet"}
          </span>
        </p>
      </div>
    </div>
  );
}
