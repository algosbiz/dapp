"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useRwdStakingActions, useRwdStakingData } from "@/hooks/useRwdStaking";
import { formatToken } from "@/lib/format";

const buttonBase =
  "rounded-card px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function RwdStakingPanel() {
  const { isConnected } = useAccount();
  const { rwdBalance, allowance, stakedBalance, earned } = useRwdStakingData();
  const {
    approve,
    stake,
    withdraw,
    claimReward,
    exit,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  } = useRwdStakingActions();

  const [amount, setAmount] = useState("");

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const needsApproval = useMemo(() => {
    if (allowance.data === undefined) return true;
    return allowance.data < parsedAmount;
  }, [allowance.data, parsedAmount]);

  const isBusy = isPending || isConfirming;

  // Refresh balances/allowance once a transaction confirms.
  useEffect(() => {
    if (isConfirmed) {
      rwdBalance.refetch();
      allowance.refetch();
      stakedBalance.refetch();
      earned.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-pale">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="6" width="18" height="13" rx="3" stroke="#054d28" strokeWidth="1.8" />
            <path d="M16 12.5h2.5" stroke="#054d28" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-lg font-bold text-ink">Connect your wallet to start staking</p>
        <p className="mt-1 text-sm text-ink-body">
          Once connected, you can stake RWD and track your rewards right here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-card bg-canvas p-6 shadow-card sm:p-8">
      <p className="rounded-control bg-canvas-soft px-4 py-3 text-sm text-ink-body">
        This pool takes RWD and pays out RWD — the two tiles below are both denominated in
        RWD but track different things: what you've locked up, and what you've separately
        earned on top of it.
      </p>

      {/* Position summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-control bg-canvas-soft p-4">
          <p className="text-xs font-semibold text-ink-body">Staked</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">
            {stakedBalance.data !== undefined ? formatToken(stakedBalance.data) : "0"}
            <span className="ml-1 text-sm font-semibold text-ink-body">RWD</span>
          </p>
        </div>
        <div className="rounded-control bg-brand-pale p-4">
          <p className="text-xs font-semibold text-positive-deep">Earned</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">
            {earned.data !== undefined ? formatToken(earned.data) : "0"}
            <span className="ml-1 text-sm font-semibold text-positive-deep">RWD</span>
          </p>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label htmlFor="rwd-stake-amount" className="mb-1.5 block text-sm font-semibold text-ink">
          Amount to stake
        </label>
        <div className="relative">
          <input
            id="rwd-stake-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
            RWD
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-body">
            Balance: {rwdBalance.data !== undefined ? formatToken(rwdBalance.data) : "0"} RWD
          </span>
          <button
            type="button"
            disabled={rwdBalance.data === undefined}
            onClick={() => rwdBalance.data !== undefined && setAmount(formatEther(rwdBalance.data))}
            className="font-semibold text-positive transition-colors hover:text-positive-deep disabled:opacity-40"
          >
            Max
          </button>
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={!needsApproval || parsedAmount === 0n || isBusy}
          onClick={() => approve(parsedAmount)}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          {isPending ? "Confirm…" : "Approve"}
        </button>
        <button
          disabled={needsApproval || parsedAmount === 0n || isBusy}
          onClick={() => stake(parsedAmount)}
          className={`${buttonBase} bg-brand text-ink hover:bg-brand-active`}
        >
          Stake
        </button>
        <button
          disabled={parsedAmount === 0n || isBusy}
          onClick={() => withdraw(parsedAmount)}
          className={`${buttonBase} border border-ink/20 bg-canvas text-ink hover:border-ink`}
        >
          Withdraw
        </button>
        <button
          disabled={isBusy || !earned.data}
          onClick={() => claimReward()}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          Claim reward
        </button>
      </div>

      <button
        disabled={isBusy || !stakedBalance.data}
        onClick={() => exit()}
        className={`${buttonBase} w-full border border-ink/15 text-ink-body hover:border-ink/40 hover:text-ink`}
      >
        Exit — withdraw all &amp; claim
      </button>

      {/* Transaction status */}
      <div className="min-h-[1.25rem] text-sm">
        {isConfirming && (
          <p className="flex items-center gap-2 font-semibold text-warning-deep">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Waiting for confirmation…
          </p>
        )}
        {isConfirmed && <p className="font-semibold text-positive-deep">Transaction confirmed ✓</p>}
        {error && <p className="line-clamp-2 text-negative-deep">{error.message}</p>}
      </div>
    </div>
  );
}
