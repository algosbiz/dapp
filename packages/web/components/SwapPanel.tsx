"use client";

import { useEffect, useMemo, useState } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { SLIPPAGE_BPS, useWethRwdPoolActions, useWethRwdPoolData, withSlippage } from "@/hooks/useWethRwdPool";
import { formatToken } from "@/lib/format";

const SWAP_FEE_BPS = 30n;
const BPS_DENOMINATOR = 10_000n;

/** Mirrors WethRwdPool.getAmountOut exactly, for an instant client-side preview. */
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS);
  return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
}

const buttonBase =
  "rounded-card px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export function SwapPanel() {
  const { isConnected } = useAccount();
  const { reserve0, reserve1, wethBalance, rwdBalance, wethAllowance, rwdAllowance } = useWethRwdPoolData();
  const { approveToken0, approveToken1, swap, isPending, isConfirming, isConfirmed, error } =
    useWethRwdPoolActions();

  const [zeroForOne, setZeroForOne] = useState(true); // true = WETH -> RWD
  const [amount, setAmount] = useState("");

  const parsedAmountIn = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const [reserveIn, reserveOut] = zeroForOne ? [reserve0, reserve1] : [reserve1, reserve0];
  const amountOut = useMemo(() => {
    if (reserveIn === undefined || reserveOut === undefined) return undefined;
    return getAmountOut(parsedAmountIn, reserveIn, reserveOut);
  }, [parsedAmountIn, reserveIn, reserveOut]);

  const inTokenAddress = zeroForOne ? CONTRACTS.weth : CONTRACTS.rwdToken;
  const inBalance = zeroForOne ? wethBalance.data : rwdBalance.data;
  const inAllowance = zeroForOne ? wethAllowance.data : rwdAllowance.data;
  const approveIn = zeroForOne ? approveToken0 : approveToken1;

  const needsApproval = useMemo(() => {
    if (inAllowance === undefined) return true;
    return inAllowance < parsedAmountIn;
  }, [inAllowance, parsedAmountIn]);

  const isBusy = isPending || isConfirming;

  useEffect(() => {
    if (isConfirmed) {
      wethBalance.refetch();
      rwdBalance.refetch();
      wethAllowance.refetch();
      rwdAllowance.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <p className="text-lg font-bold text-ink">Connect your wallet to swap</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-card bg-canvas p-6 shadow-card sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Swap</h2>
        <button
          type="button"
          onClick={() => setZeroForOne((v) => !v)}
          disabled={isBusy}
          className="text-sm font-semibold text-positive transition-colors hover:text-positive-deep disabled:opacity-40"
        >
          Switch direction ⇅
        </button>
      </div>

      <div>
        <label htmlFor="swap-amount" className="mb-1.5 block text-sm font-semibold text-ink">
          {zeroForOne ? "From WETH" : "From RWD"}
        </label>
        <div className="relative">
          <input
            id="swap-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
            {zeroForOne ? "WETH" : "RWD"}
          </span>
        </div>
        <div className="mt-1.5 text-xs text-ink-body">
          Balance: {inBalance !== undefined ? formatToken(inBalance) : "0"} {zeroForOne ? "WETH" : "RWD"}
        </div>
      </div>

      <div className="rounded-control bg-canvas-soft p-4">
        <p className="text-xs font-semibold text-ink-body">
          You receive (≈, 0.3% fee included, {Number(SLIPPAGE_BPS) / 100}% slippage tolerance applied)
        </p>
        <p className="mt-1 text-xl font-extrabold tracking-tight text-ink">
          {amountOut !== undefined ? formatToken(amountOut, 6) : "0"}
          <span className="ml-1 text-sm font-semibold text-ink-body">{zeroForOne ? "RWD" : "WETH"}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          disabled={!needsApproval || parsedAmountIn === 0n || isBusy}
          onClick={() => approveIn(parsedAmountIn)}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          {isPending ? "Confirm…" : "Approve"}
        </button>
        <button
          disabled={needsApproval || parsedAmountIn === 0n || !amountOut || isBusy}
          onClick={() => swap(parsedAmountIn, inTokenAddress, withSlippage(amountOut ?? 0n))}
          className={`${buttonBase} bg-brand text-ink hover:bg-brand-active`}
        >
          Swap
        </button>
      </div>

      <div className="min-h-[1.25rem] text-sm">
        {isConfirming && <p className="font-semibold text-warning-deep">Waiting for confirmation…</p>}
        {isConfirmed && <p className="font-semibold text-positive-deep">Transaction confirmed ✓</p>}
        {error && <p className="line-clamp-2 text-negative-deep">{error.message}</p>}
      </div>
    </div>
  );
}
