"use client";

import { useAccount } from "wagmi";
import { useRwdStakingData } from "@/hooks/useRwdStaking";
import { formatToken } from "@/lib/format";

export function RwdStakingDashboard() {
  const { address } = useAccount();
  const { rwdBalance, totalStaked } = useRwdStakingData();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Total RWD locked in this pool</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(totalStaked.data)}{" "}
          <span className="text-lg font-semibold text-ink-body">RWD</span>
        </p>
      </div>
      <div className="rounded-card bg-canvas p-6 shadow-card">
        <p className="text-sm font-semibold text-ink-body">Your wallet RWD balance</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {address ? formatToken(rwdBalance.data) : "—"}{" "}
          <span className="text-lg font-semibold text-ink-body">
            {address ? "RWD" : "Connect wallet"}
          </span>
        </p>
      </div>
    </div>
  );
}
