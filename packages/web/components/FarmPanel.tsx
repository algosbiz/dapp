"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useFarmActions, useFarmData } from "@/hooks/useFarm";
import { useTransactionToast } from "@/hooks/useTransactionToast";
import { ButtonContent } from "@/components/Spinner";
import { formatToken } from "@/lib/format";

const buttonBase =
  "rounded-card px-4 py-3 text-base font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function FarmPanel() {
  const { isConnected } = useAccount();
  const { wethBalance, allowance, poolStaked, userInfo, stakedAmount, pending } = useFarmData();
  const {
    approve,
    deposit,
    withdraw,
    harvest,
    emergencyWithdraw,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  } = useFarmActions();
  const { run, activeLabel } = useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset });

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

  useEffect(() => {
    if (isConfirmed) {
      wethBalance.refetch();
      allowance.refetch();
      poolStaked.refetch();
      userInfo.refetch();
      pending.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-pale">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v18M5 8c3 0 5 1.5 6 4M19 8c-3 0-5 1.5-6 4" stroke="#054d28" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="text-lg font-bold text-ink">Connect your wallet to start farming</p>
        <p className="mt-1 text-sm text-ink-body">
          Deposit WETH into the farm and earn freshly minted FLX every second.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-card bg-canvas p-6 shadow-card sm:p-8">
      {/* Position summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-control bg-canvas-soft p-4">
          <p className="text-xs font-semibold text-ink-body">Your stake</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">
            {stakedAmount !== undefined ? formatToken(stakedAmount) : "0"}
            <span className="ml-1 text-sm font-semibold text-ink-body">WETH</span>
          </p>
        </div>
        <div className="rounded-control bg-brand-pale p-4">
          <p className="text-xs font-semibold text-positive-deep">Pending reward</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">
            {pending.data !== undefined ? formatToken(pending.data) : "0"}
            <span className="ml-1 text-sm font-semibold text-positive-deep">FLX</span>
          </p>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <label htmlFor="farm-amount" className="mb-1.5 block text-sm font-semibold text-ink">
          Amount to deposit
        </label>
        <div className="relative">
          <input
            id="farm-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
            WETH
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-body">
            Balance: {wethBalance.data !== undefined ? formatToken(wethBalance.data) : "0"} WETH
          </span>
          <button
            type="button"
            disabled={wethBalance.data === undefined}
            onClick={() => wethBalance.data !== undefined && setAmount(formatEther(wethBalance.data))}
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
          onClick={() => run("Approve", () => approve(parsedAmount))}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          <ButtonContent busy={activeLabel === "Approve"} label="Approve" busyLabel="Approving…" />
        </button>
        <button
          disabled={needsApproval || parsedAmount === 0n || isBusy}
          onClick={() => run("Deposit", () => deposit(parsedAmount))}
          className={`${buttonBase} bg-brand text-ink hover:bg-brand-active`}
        >
          <ButtonContent busy={activeLabel === "Deposit"} label="Deposit" busyLabel="Depositing…" />
        </button>
        <button
          disabled={parsedAmount === 0n || isBusy || !stakedAmount}
          onClick={() => run("Withdraw", () => withdraw(parsedAmount))}
          className={`${buttonBase} border border-ink/20 bg-canvas text-ink hover:border-ink`}
        >
          <ButtonContent busy={activeLabel === "Withdraw"} label="Withdraw" busyLabel="Withdrawing…" />
        </button>
        <button
          disabled={isBusy || !pending.data}
          onClick={() => run("Harvest", () => harvest())}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          <ButtonContent busy={activeLabel === "Harvest"} label="Harvest" busyLabel="Harvesting…" />
        </button>
      </div>

      <button
        disabled={isBusy || !stakedAmount}
        onClick={() => run("Emergency withdraw", () => emergencyWithdraw())}
        className={`${buttonBase} w-full border border-negative/30 text-negative-deep hover:border-negative hover:bg-negative/5`}
      >
        <ButtonContent
          busy={activeLabel === "Emergency withdraw"}
          label="Emergency withdraw (forfeit rewards)"
          busyLabel="Withdrawing…"
        />
      </button>
    </div>
  );
}
