"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { SLIPPAGE_BPS, useWethRwdPoolActions, useWethRwdPoolData, withSlippage } from "@/hooks/useWethRwdPool";
import { useTransactionToast } from "@/hooks/useTransactionToast";
import { ButtonContent } from "@/components/Spinner";
import { TokenPill } from "@/components/TokenPill";
import { formatToken, formatTokenSmart } from "@/lib/format";

const SWAP_FEE_BPS = 30n;
const BPS_DENOMINATOR = 10_000n;
const PRECISION = 10n ** 18n;

/** Swaps above this move the pool price by more than this — requires explicit confirmation. */
const HIGH_IMPACT_BPS = 1000n; // 10%
/** Below this, don't even bother showing the impact figure — it's noise. */
const SHOW_IMPACT_BPS = 10n; // 0.1%

/** Mirrors WethRwdPool.getAmountOut exactly, for an instant client-side preview. */
function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * (BPS_DENOMINATOR - SWAP_FEE_BPS);
  return (amountInWithFee * reserveOut) / (reserveIn * BPS_DENOMINATOR + amountInWithFee);
}

/**
 * How much this trade moves the price away from the current spot price, in basis points.
 * Compares the execution price (amountOut/amountIn) against the pre-trade spot price
 * (reserveOut/reserveIn) — a large gap means this trade is big relative to the pool's
 * actual depth, not just "expensive due to fees".
 */
function getPriceImpactBps(amountIn: bigint, amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n || amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const spotPrice = (reserveOut * PRECISION) / reserveIn;
  const execPrice = (amountOut * PRECISION) / amountIn;
  if (execPrice >= spotPrice) return 0n;
  return ((spotPrice - execPrice) * 10_000n) / spotPrice;
}

function SwapArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v16M12 20l-6-6M12 20l6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwapPanel() {
  const { isConnected } = useAccount();
  const { reserve0, reserve1, wethBalance, rwdBalance, wethAllowance, rwdAllowance } = useWethRwdPoolData();
  const { approveToken0, approveToken1, swap, isPending, isConfirming, isConfirmed, error, reset } =
    useWethRwdPoolActions();
  const { run, activeLabel } = useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset });

  const [zeroForOne, setZeroForOne] = useState(true); // true = WETH -> RWD
  const [amount, setAmount] = useState("");
  const [acknowledgedImpact, setAcknowledgedImpact] = useState(false);

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

  const spotOutPerIn = useMemo(() => {
    if (reserveIn === undefined || reserveOut === undefined || reserveIn === 0n) return undefined;
    return (reserveOut * PRECISION) / reserveIn;
  }, [reserveIn, reserveOut]);

  const priceImpactBps = useMemo(() => {
    if (reserveIn === undefined || reserveOut === undefined || amountOut === undefined) return 0n;
    return getPriceImpactBps(parsedAmountIn, amountOut, reserveIn, reserveOut);
  }, [parsedAmountIn, amountOut, reserveIn, reserveOut]);
  const isHighImpact = priceImpactBps >= HIGH_IMPACT_BPS;

  const inTokenSymbol = zeroForOne ? "WETH" : "RWD";
  const outTokenSymbol = zeroForOne ? "RWD" : "WETH";
  const inTokenAddress = zeroForOne ? CONTRACTS.weth : CONTRACTS.rwdToken;
  const inBalance = zeroForOne ? wethBalance.data : rwdBalance.data;
  const outBalance = zeroForOne ? rwdBalance.data : wethBalance.data;
  const inAllowance = zeroForOne ? wethAllowance.data : rwdAllowance.data;
  const approveIn = zeroForOne ? approveToken0 : approveToken1;

  const needsApproval = useMemo(() => {
    if (inAllowance === undefined) return true;
    return inAllowance < parsedAmountIn;
  }, [inAllowance, parsedAmountIn]);

  const isBusy = isPending || isConfirming;

  // A high-impact swap must be re-acknowledged if the amount or direction changes.
  useEffect(() => {
    setAcknowledgedImpact(false);
  }, [amount, zeroForOne]);

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

  let buttonLabel: string;
  let buttonBusyLabel: string | undefined;
  let buttonDisabled: boolean;
  let onButtonClick: () => void;

  if (parsedAmountIn === 0n) {
    buttonLabel = "Enter an amount";
    buttonDisabled = true;
    onButtonClick = () => {};
  } else if (needsApproval) {
    buttonLabel = `Approve ${inTokenSymbol}`;
    buttonBusyLabel = "Approving…";
    buttonDisabled = isBusy;
    onButtonClick = () => run(buttonLabel, () => approveIn(parsedAmountIn));
  } else if (isHighImpact && !acknowledgedImpact) {
    buttonLabel = "Confirm price impact to continue";
    buttonDisabled = true;
    onButtonClick = () => {};
  } else {
    buttonLabel = "Swap";
    buttonBusyLabel = "Swapping…";
    buttonDisabled = isBusy || !amountOut;
    onButtonClick = () => run("Swap", () => swap(parsedAmountIn, inTokenAddress, withSlippage(amountOut ?? 0n)));
  }
  const isActionableButton = buttonLabel.startsWith("Approve") || buttonLabel === "Swap";

  return (
    <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
      <h2 className="mb-5 font-display text-lg font-extrabold tracking-tight text-ink">Swap</h2>

      <div className="space-y-1">
        {/* Sell */}
        <div className="rounded-control bg-canvas-soft p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="swap-amount" className="text-xs font-semibold text-ink-body">
              Sell
            </label>
            <div className="text-xs font-semibold text-ink-body">
              Balance: {formatToken(inBalance)} {inTokenSymbol}
              {inBalance !== undefined && inBalance > 0n && (
                <button
                  type="button"
                  onClick={() => setAmount(formatEther(inBalance))}
                  disabled={isBusy}
                  className="ml-1.5 font-bold text-positive transition-colors hover:text-positive-deep disabled:opacity-40"
                >
                  Max
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <input
              id="swap-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-extrabold tracking-tight text-ink outline-none placeholder:font-normal placeholder:text-ink-body/40"
            />
            <TokenPill code={inTokenSymbol} tone={zeroForOne ? "ink" : "green"} />
          </div>
        </div>

        {/* Direction toggle, sitting on the seam between the two boxes */}
        <div className="relative h-0">
          <div className="absolute inset-x-0 -top-4 flex justify-center">
            <button
              type="button"
              onClick={() => setZeroForOne((v) => !v)}
              disabled={isBusy}
              aria-label="Switch swap direction"
              className="grid h-9 w-9 place-items-center rounded-full border-4 border-canvas bg-canvas-soft text-ink transition-transform hover:scale-105 hover:bg-ink/5 disabled:opacity-40"
            >
              <SwapArrowIcon />
            </button>
          </div>
        </div>

        {/* Buy */}
        <div className="rounded-control bg-canvas-soft p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-body">Buy</span>
            <span className="text-xs font-semibold text-ink-body">
              Balance: {formatToken(outBalance)} {outTokenSymbol}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate font-display text-3xl font-extrabold tracking-tight text-ink">
              {amountOut !== undefined ? formatTokenSmart(amountOut) : "0"}
            </span>
            <TokenPill code={outTokenSymbol} tone={zeroForOne ? "green" : "ink"} />
          </div>
        </div>
      </div>

      {spotOutPerIn !== undefined && (
        <p className="mt-4 text-xs text-ink-body">
          1 {inTokenSymbol} ≈ {formatTokenSmart(spotOutPerIn)} {outTokenSymbol} · 0.3% fee ·{" "}
          {Number(SLIPPAGE_BPS) / 100}% slippage tolerance
        </p>
      )}

      {priceImpactBps >= SHOW_IMPACT_BPS && (
        <p className={`mt-1.5 text-xs font-semibold ${isHighImpact ? "text-negative-deep" : "text-warning-deep"}`}>
          Price impact: ~{(Number(priceImpactBps) / 100).toFixed(2)}%
        </p>
      )}

      {isHighImpact && (
        <label className="mt-4 flex items-start gap-2 rounded-control border border-negative/30 bg-negative/5 p-4 text-sm text-negative-deep">
          <input
            type="checkbox"
            checked={acknowledgedImpact}
            onChange={(e) => setAcknowledgedImpact(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            This trade is large relative to the pool and will move the price by roughly{" "}
            {(Number(priceImpactBps) / 100).toFixed(2)}%. I understand and want to proceed anyway.
          </span>
        </label>
      )}

      <button
        type="button"
        disabled={buttonDisabled}
        onClick={onButtonClick}
        className={`mt-5 w-full rounded-card px-4 py-3.5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isActionableButton ? "bg-brand text-ink hover:bg-brand-active" : "bg-canvas-soft text-ink-body"
        }`}
      >
        <ButtonContent busy={activeLabel === buttonLabel} label={buttonLabel} busyLabel={buttonBusyLabel} />
      </button>
    </div>
  );
}
