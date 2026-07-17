"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useWrapActions, useWrapData } from "@/hooks/useWrap";
import { useTransactionToast } from "@/hooks/useTransactionToast";
import { ButtonContent } from "@/components/Spinner";
import { TokenPill } from "@/components/TokenPill";
import { formatToken } from "@/lib/format";

/**
 * Kept in reserve for gas when "Max"-wrapping, so the wallet is never left with 0 ETH and
 * unable to pay for the wrap tx itself. Gas on this L2 is tiny; this is a generous cushion.
 */
const GAS_BUFFER = parseEther("0.0002");

function WrapArrowIcon() {
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

export function WrapPanel() {
  const { isConnected } = useAccount();
  const { ethBalance, wethBalance } = useWrapData();
  const { wrap, unwrap, isPending, isConfirming, isConfirmed, error, reset } = useWrapActions();
  const { run, activeLabel } = useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset });

  const [ethToWeth, setEthToWeth] = useState(true); // true = wrap ETH -> WETH
  const [amount, setAmount] = useState("");

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseEther(amount) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const isBusy = isPending || isConfirming;

  useEffect(() => {
    if (isConfirmed) {
      ethBalance.refetch();
      wethBalance.refetch();
      setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <p className="text-lg font-bold text-ink">Connect your wallet to wrap ETH</p>
      </div>
    );
  }

  const inSymbol = ethToWeth ? "ETH" : "WETH";
  const outSymbol = ethToWeth ? "WETH" : "ETH";
  const inBalance = ethToWeth ? ethBalance.data?.value : wethBalance.data;
  const outBalance = ethToWeth ? wethBalance.data : ethBalance.data?.value;

  // Max: when wrapping ETH, keep a gas cushion; when unwrapping WETH, use the whole balance.
  const maxAmount =
    inBalance === undefined
      ? undefined
      : ethToWeth
        ? inBalance > GAS_BUFFER
          ? inBalance - GAS_BUFFER
          : 0n
        : inBalance;

  const exceedsBalance = inBalance !== undefined && parsedAmount > inBalance;

  const label = ethToWeth ? "Wrap" : "Unwrap";
  const busyLabel = ethToWeth ? "Wrapping…" : "Unwrapping…";
  const disabled = parsedAmount === 0n || isBusy || exceedsBalance;
  const onClick = () =>
    run(label, () => (ethToWeth ? wrap(parsedAmount) : unwrap(parsedAmount)));

  return (
    <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
      <h2 className="mb-5 font-display text-lg font-extrabold tracking-tight text-ink">
        {ethToWeth ? "Wrap ETH" : "Unwrap WETH"}
      </h2>

      <div className="space-y-1">
        {/* From */}
        <div className="rounded-control bg-canvas-soft p-4">
          <div className="flex items-center justify-between">
            <label htmlFor="wrap-amount" className="text-xs font-semibold text-ink-body">
              You pay
            </label>
            <div className="text-xs font-semibold text-ink-body">
              Balance: {formatToken(inBalance)} {inSymbol}
              {maxAmount !== undefined && maxAmount > 0n && (
                <button
                  type="button"
                  onClick={() => setAmount(formatEther(maxAmount))}
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
              id="wrap-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-extrabold tracking-tight text-ink outline-none placeholder:font-normal placeholder:text-ink-body/40"
            />
            <TokenPill code={inSymbol} tone={inSymbol === "WETH" ? "green" : "ink"} />
          </div>
        </div>

        {/* Direction toggle */}
        <div className="relative h-0">
          <div className="absolute inset-x-0 -top-4 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setEthToWeth((v) => !v);
                setAmount("");
              }}
              disabled={isBusy}
              aria-label="Switch wrap direction"
              className="grid h-9 w-9 place-items-center rounded-full border-4 border-canvas bg-canvas-soft text-ink transition-transform hover:scale-105 hover:bg-ink/5 disabled:opacity-40"
            >
              <WrapArrowIcon />
            </button>
          </div>
        </div>

        {/* To */}
        <div className="rounded-control bg-canvas-soft p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-body">You receive</span>
            <span className="text-xs font-semibold text-ink-body">
              Balance: {formatToken(outBalance)} {outSymbol}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            {/* 1:1 conversion — the receive amount always mirrors the input exactly. */}
            <span className="min-w-0 flex-1 truncate font-display text-3xl font-extrabold tracking-tight text-ink">
              {amount && parsedAmount > 0n ? amount : "0"}
            </span>
            <TokenPill code={outSymbol} tone={outSymbol === "WETH" ? "green" : "ink"} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-body">
        1 ETH = 1 WETH, always. Wrapping just locks ETH inside the WETH contract and gives you
        the same amount of WETH back; unwrapping reverses it. No fees, no price impact.
      </p>

      {exceedsBalance && (
        <p className="mt-2 text-xs font-semibold text-negative-deep">
          Amount is more than your {inSymbol} balance.
        </p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="mt-5 w-full rounded-card bg-brand px-4 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ButtonContent
          busy={activeLabel === label}
          label={parsedAmount === 0n ? "Enter an amount" : label}
          busyLabel={busyLabel}
        />
      </button>
    </div>
  );
}
