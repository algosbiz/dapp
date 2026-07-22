"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  computePendingReward,
  useLockedStakingActions,
  useLockedStakingData,
  type LockedPosition,
} from "@/hooks/useLockedStaking";
import { useTransactionToast } from "@/hooks/useTransactionToast";
import { ButtonContent } from "@/components/Spinner";
import { formatToken } from "@/lib/format";

const buttonBase =
  "rounded-card px-4 py-3 text-base font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const TIERS = [
  { id: 0, label: "1 month", months: 1 },
  { id: 1, label: "2 months", months: 2 },
  { id: 2, label: "3 months", months: 3 },
] as const;

/** "3d 4h" / "5h 20m" / "12m" style countdown from a future unix time. */
function formatCountdown(unlock: bigint, now: bigint): string {
  if (now >= unlock) return "Unlocked";
  let s = Number(unlock - now);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function LockedStakingPanel() {
  const { isConnected } = useAccount();
  const { flxBalance, allowance, minStake, totalStaked, aprBps, positions } = useLockedStakingData();
  const { approve, stake, withdraw, withdrawEarly, isPending, isConfirming, isConfirmed, error, reset } =
    useLockedStakingActions();
  const { run, activeLabel } = useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset });

  const [tier, setTier] = useState(0);
  const [amountStr, setAmountStr] = useState("");
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  // A once-a-second tick so countdowns and accruing rewards stay live without re-fetching.
  useEffect(() => {
    const id = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(id);
  }, []);

  const parsedAmount = useMemo(() => {
    try {
      return amountStr ? parseEther(amountStr) : 0n;
    } catch {
      return 0n;
    }
  }, [amountStr]);

  const min = minStake.data ?? 0n;
  const belowMin = parsedAmount > 0n && parsedAmount < min;
  const insufficient = flxBalance.data !== undefined && parsedAmount > flxBalance.data;
  const needsApproval = allowance.data === undefined || allowance.data < parsedAmount;
  const isBusy = isPending || isConfirming;

  const activePositions = useMemo(
    () => ((positions.data as LockedPosition[] | undefined) ?? []).map((p, i) => ({ ...p, id: i })).filter((p) => !p.withdrawn),
    [positions.data]
  );

  useEffect(() => {
    if (isConfirmed) {
      flxBalance.refetch();
      allowance.refetch();
      totalStaked.refetch();
      positions.refetch();
      setAmountStr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  if (!isConnected) {
    return (
      <div className="rounded-card bg-canvas p-8 text-center shadow-card">
        <p className="text-lg font-bold text-ink">Connect your wallet to lock FLX</p>
        <p className="mt-1 text-sm text-ink-body">
          Lock FLX for a fixed term and earn more FLX. Leaving early burns 5% of your stake.
        </p>
      </div>
    );
  }

  const selectedApr = aprBps[tier];

  return (
    <div className="space-y-6 rounded-card bg-canvas p-6 shadow-card sm:p-8">
      {/* Lock form */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Lock period</p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const apr = aprBps[t.id];
            const selected = tier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                className={`rounded-control border p-3 text-center transition-colors ${
                  selected ? "border-ink bg-brand-pale" : "border-ink/15 bg-canvas hover:border-ink/40"
                }`}
              >
                <span className="block text-sm font-bold text-ink">{t.label}</span>
                <span className="mt-0.5 block text-xs font-semibold text-positive-deep">
                  {apr !== undefined ? `${(Number(apr) / 100).toFixed(0)}% APR` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="lock-amount" className="mb-1.5 block text-sm font-semibold text-ink">
          Amount to lock
        </label>
        <div className="relative">
          <input
            id="lock-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-[#6b6d6a] focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-body">
            FLX
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-body">
            Balance: {flxBalance.data !== undefined ? formatToken(flxBalance.data) : "0"} FLX
          </span>
          <button
            type="button"
            disabled={flxBalance.data === undefined}
            onClick={() => flxBalance.data !== undefined && setAmountStr(formatEther(flxBalance.data))}
            className="font-semibold text-positive transition-colors hover:text-positive-deep disabled:opacity-40"
          >
            Max
          </button>
        </div>
        {belowMin && (
          <p className="mt-1.5 text-xs font-semibold text-warning-content">
            Minimum lock is {formatToken(min)} FLX.
          </p>
        )}
        {insufficient && (
          <p className="mt-1.5 text-xs font-semibold text-negative-deep">More FLX than your wallet holds.</p>
        )}
        {parsedAmount > 0n && !belowMin && selectedApr !== undefined && (
          <p className="mt-1.5 text-xs text-ink-body">
            At {(Number(selectedApr) / 100).toFixed(0)}% APR over {TIERS[tier].months} month
            {TIERS[tier].months > 1 ? "s" : ""}, you&apos;d earn ~
            {formatToken((parsedAmount * selectedApr * BigInt(TIERS[tier].months * 30 * 86400)) / (10_000n * 31_536_000n))}{" "}
            FLX if you hold to term.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={!needsApproval || parsedAmount === 0n || belowMin || insufficient || isBusy}
          onClick={() => run("Approve FLX", () => approve(parsedAmount))}
          className={`${buttonBase} bg-canvas-soft text-ink hover:bg-ink/5`}
        >
          <ButtonContent busy={activeLabel === "Approve FLX"} label="Approve FLX" busyLabel="Approving…" />
        </button>
        <button
          disabled={needsApproval || parsedAmount === 0n || belowMin || insufficient || isBusy}
          onClick={() => run("Lock FLX", () => stake(parsedAmount, tier))}
          className={`${buttonBase} bg-brand text-ink hover:bg-brand-active`}
        >
          <ButtonContent busy={activeLabel === "Lock FLX"} label="Lock FLX" busyLabel="Locking…" />
        </button>
      </div>

      {/* Positions */}
      <div className="border-t border-ink/10 pt-5">
        <p className="text-sm font-semibold text-ink">Your locked positions</p>
        {activePositions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-body">No active locks yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {activePositions.map((p) => {
              const unlocked = now >= p.unlockTime;
              const reward = computePendingReward(p, now);
              const label = `pos-${p.id}`;
              return (
                <li key={p.id} className="rounded-control bg-canvas-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-ink">
                        {formatToken(p.amount)} <span className="text-sm font-semibold text-ink-body">FLX</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-body">
                        {(Number(p.aprBps) / 100).toFixed(0)}% APR · reward so far{" "}
                        <span className="font-semibold text-positive-deep">{formatToken(reward)} FLX</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                        unlocked ? "bg-brand-pale text-positive-deep" : "bg-ink/5 text-ink-body"
                      }`}
                    >
                      {unlocked ? "Unlocked" : `Unlocks in ${formatCountdown(p.unlockTime, now)}`}
                    </span>
                  </div>

                  {unlocked ? (
                    <button
                      disabled={isBusy}
                      onClick={() => run("Withdraw", () => withdraw(BigInt(p.id)))}
                      className={`${buttonBase} mt-3 w-full bg-brand text-ink hover:bg-brand-active`}
                    >
                      <ButtonContent busy={activeLabel === "Withdraw"} label="Withdraw principal + reward" busyLabel="Withdrawing…" />
                    </button>
                  ) : (
                    <>
                      {/* The burn amount is deliberately OUTSIDE the button label. Inside a
                          whitespace-nowrap button it grew with the number and spilled past the
                          button edge on narrow screens — a 1,234,567 FLX lock needs ~301px of
                          label against ~278px available on a 390px phone. As its own wrapping
                          line the warning is width-proof, and reads better besides. */}
                      <p className="mt-3 text-xs leading-relaxed text-negative-deep">
                        Leaving now burns{" "}
                        <span className="font-bold">{formatToken((p.amount * 500n) / 10_000n)} FLX</span> (5%)
                        and forfeits the reward.
                      </p>
                      <button
                        disabled={isBusy}
                        onClick={() => run("Withdraw early", () => withdrawEarly(BigInt(p.id)))}
                        className={`${buttonBase} mt-1.5 w-full border border-negative/40 text-negative-deep hover:bg-negative/5`}
                      >
                        <ButtonContent
                          busy={activeLabel === "Withdraw early"}
                          label="Withdraw early"
                          busyLabel="Withdrawing…"
                        />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
