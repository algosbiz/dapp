"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useWethRwdPoolActions, useWethRwdPoolData, withSlippage } from "@/hooks/useWethRwdPool";
import { formatToken } from "@/lib/format";

const buttonBase =
  "rounded-card px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function parseAmount(value: string): bigint {
  try {
    return value ? parseEther(value) : 0n;
  } catch {
    return 0n;
  }
}

export function LiquidityPanel() {
  const { isConnected } = useAccount();
  const {
    reserve0,
    reserve1,
    totalSupply,
    wethBalance,
    rwdBalance,
    lpBalance,
    wethAllowance,
    rwdAllowance,
  } = useWethRwdPoolData();
  const {
    approveToken0,
    approveToken1,
    addLiquidity,
    removeLiquidity,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  } = useWethRwdPoolActions();

  const [amount0Str, setAmount0Str] = useState("");
  const [amount1Str, setAmount1Str] = useState("");
  const [removeAmountStr, setRemoveAmountStr] = useState("");

  const hasReserves = reserve0 !== undefined && reserve1 !== undefined && reserve0 > 0n && reserve1 > 0n;

  // Ratio-assist: editing one side auto-fills the other from the current pool ratio.
  const onChangeAmount0 = (value: string) => {
    setAmount0Str(value);
    if (hasReserves) {
      const parsed = parseAmount(value);
      setAmount1Str(parsed > 0n ? formatEther((parsed * reserve1!) / reserve0!) : "");
    }
  };
  const onChangeAmount1 = (value: string) => {
    setAmount1Str(value);
    if (hasReserves) {
      const parsed = parseAmount(value);
      setAmount0Str(parsed > 0n ? formatEther((parsed * reserve0!) / reserve1!) : "");
    }
  };

  const amount0 = parseAmount(amount0Str);
  const amount1 = parseAmount(amount1Str);

  const needsApproval0 = wethAllowance.data === undefined || wethAllowance.data < amount0;
  const needsApproval1 = rwdAllowance.data === undefined || rwdAllowance.data < amount1;

  const removeAmount = parseAmount(removeAmountStr);
  const removePreview = useMemo(() => {
    if (!totalSupply.data || totalSupply.data === 0n || reserve0 === undefined || reserve1 === undefined) {
      return undefined;
    }
    return {
      amount0: (removeAmount * reserve0) / totalSupply.data,
      amount1: (removeAmount * reserve1) / totalSupply.data,
    };
  }, [removeAmount, reserve0, reserve1, totalSupply.data]);

  const isBusy = isPending || isConfirming;

  useEffect(() => {
    if (isConfirmed) {
      wethBalance.refetch();
      rwdBalance.refetch();
      lpBalance.refetch();
      wethAllowance.refetch();
      rwdAllowance.refetch();
      totalSupply.refetch();
      setAmount0Str("");
      setAmount1Str("");
      setRemoveAmountStr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <p className="text-lg font-bold text-ink">Connect your wallet to manage liquidity</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Add liquidity */}
      <div className="space-y-4 rounded-card bg-canvas p-6 shadow-card">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Add Liquidity</h2>

        <div>
          <label htmlFor="add-amount0" className="mb-1.5 block text-sm font-semibold text-ink">
            WETH
          </label>
          <input
            id="add-amount0"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount0Str}
            onChange={(e) => onChangeAmount0(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <p className="mt-1 text-xs text-ink-body">
            Balance: {wethBalance.data !== undefined ? formatToken(wethBalance.data) : "0"} WETH
          </p>
        </div>

        <div>
          <label htmlFor="add-amount1" className="mb-1.5 block text-sm font-semibold text-ink">
            RWD
          </label>
          <input
            id="add-amount1"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount1Str}
            onChange={(e) => onChangeAmount1(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <p className="mt-1 text-xs text-ink-body">
            Balance: {rwdBalance.data !== undefined ? formatToken(rwdBalance.data) : "0"} RWD
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            disabled={!needsApproval0 || amount0 === 0n || isBusy}
            onClick={() => approveToken0(amount0)}
            className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
          >
            Approve WETH
          </button>
          <button
            disabled={!needsApproval1 || amount1 === 0n || isBusy}
            onClick={() => approveToken1(amount1)}
            className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
          >
            Approve RWD
          </button>
          <button
            disabled={
              needsApproval0 || needsApproval1 || amount0 === 0n || amount1 === 0n || isBusy
            }
            onClick={() =>
              addLiquidity(amount0, amount1, withSlippage(amount0), withSlippage(amount1))
            }
            className={`${buttonBase} bg-brand text-ink hover:bg-brand-active`}
          >
            Add
          </button>
        </div>
      </div>

      {/* Remove liquidity */}
      <div className="space-y-4 rounded-card bg-canvas p-6 shadow-card">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Remove Liquidity</h2>

        <div>
          <label htmlFor="remove-amount" className="mb-1.5 block text-sm font-semibold text-ink">
            LP tokens
          </label>
          <div className="relative">
            <input
              id="remove-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={removeAmountStr}
              onChange={(e) => setRemoveAmountStr(e.target.value)}
              className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
              WETH-RWD-LP
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-ink-body">
              Balance: {lpBalance.data !== undefined ? lpBalance.data.toString() : "0"} (raw units)
            </span>
            <button
              type="button"
              disabled={lpBalance.data === undefined}
              onClick={() => lpBalance.data !== undefined && setRemoveAmountStr(formatEther(lpBalance.data))}
              className="font-semibold text-positive transition-colors hover:text-positive-deep disabled:opacity-40"
            >
              Max
            </button>
          </div>
        </div>

        <div className="rounded-control bg-canvas-soft p-4">
          <p className="text-xs font-semibold text-ink-body">You receive (≈)</p>
          <p className="mt-1 text-base font-bold text-ink">
            {removePreview ? formatToken(removePreview.amount0, 6) : "0"} WETH +{" "}
            {removePreview ? formatToken(removePreview.amount1, 6) : "0"} RWD
          </p>
        </div>

        <button
          disabled={removeAmount === 0n || isBusy}
          onClick={() =>
            removeLiquidity(
              removeAmount,
              withSlippage(removePreview?.amount0 ?? 0n),
              withSlippage(removePreview?.amount1 ?? 0n)
            )
          }
          className={`${buttonBase} w-full border border-ink/20 bg-canvas text-ink hover:border-ink`}
        >
          Remove
        </button>
      </div>

      <div className="lg:col-span-2 min-h-[1.25rem] text-sm">
        {isConfirming && <p className="font-semibold text-warning-deep">Waiting for confirmation…</p>}
        {isConfirmed && <p className="font-semibold text-positive-deep">Transaction confirmed ✓</p>}
        {error && <p className="line-clamp-2 text-negative-deep">{error.message}</p>}
      </div>
    </div>
  );
}
