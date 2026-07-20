"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { masterChefAbi } from "@/abi/masterChef";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";
import { formatToken } from "@/lib/format";

const SECONDS_PER_DAY = 86_400;

type Target = "farm" | "stake" | "stake-rwd";

const TARGETS: Record<
  Target,
  { label: string; unit: string; address: `0x${string}`; contractName: string; note: string }
> = {
  farm: {
    label: "Farm (MasterChef) — farm-wide rate",
    unit: "RWD/sec",
    address: CONTRACTS.masterChef,
    contractName: "MasterChef",
    note: "Applies immediately and settles both pools first, split across the WETH and LP farm pools by their current allocation weights.",
  },
  stake: {
    label: "Stake (WETH → tRWD)",
    unit: "tRWD/sec",
    address: CONTRACTS.stakingRewards,
    contractName: "WethStakingRewards (Stake)",
    note: "This pool's rate comes from funding it (notifyRewardAmount), not a direct setter — the exact top-up needed will be computed at execution time.",
  },
  "stake-rwd": {
    label: "Stake RWD (RWD → RWD)",
    unit: "RWD/sec",
    address: CONTRACTS.rwdStaking,
    contractName: "WethStakingRewards (Stake RWD)",
    note: "Same funding-based model as Stake above, in RWD instead of tRWD.",
  },
};

/** Turns a "/sec" unit label into its "/day" equivalent for the human-scale preview line. */
const perDayUnit = (unit: string) => unit.replace("/sec", "/day");

export function EmissionRateRequestForm() {
  const [target, setTarget] = useState<Target>("farm");
  const [newRateStr, setNewRateStr] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const farmRate = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "rewardPerSecond",
  });
  const stakeRate = useReadContract({
    address: CONTRACTS.stakingRewards,
    abi: wethStakingRewardsAbi,
    functionName: "rewardRate",
  });
  const rwdStakeRate = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "rewardRate",
  });

  const currentRateByTarget: Record<Target, bigint | undefined> = {
    farm: farmRate.data,
    stake: stakeRate.data,
    "stake-rwd": rwdStakeRate.data,
  };
  const currentRate = currentRateByTarget[target];
  const meta = TARGETS[target];

  const newRateNum = Number(newRateStr) || 0;
  const hasValidAmount = newRateStr.trim() !== "" && newRateNum > 0;

  const requestText = useMemo(() => {
    if (!hasValidAmount) return "";
    const newRatePerDay = newRateNum * SECONDS_PER_DAY;
    return [
      `Emission rate change request — ${new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
      `Target: ${meta.label}`,
      `Contract: ${meta.contractName} (${meta.address})`,
      `Current rate: ${currentRate !== undefined ? formatToken(currentRate, 6) : "—"} ${meta.unit}`,
      `Requested new rate: ${newRateStr} ${meta.unit} (≈ ${newRatePerDay.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${perDayUnit(meta.unit)})`,
      `Note: ${meta.note}`,
      "",
      "Nothing has changed on-chain yet — send this to whoever manages the contracts to apply it.",
    ].join("\n");
  }, [hasValidAmount, newRateNum, newRateStr, currentRate, meta]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
      <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Request a rate change</h2>
      <p className="mt-1 text-sm text-ink-body">
        Fill this in, then copy the summary and send it to the admin who manages the
        contracts. This form doesn't change anything by itself — every setting here is
        owner-only, so a person still applies it after review.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="rate-target" className="mb-1.5 block text-sm font-semibold text-ink">
            Which one?
          </label>
          <select
            id="rate-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-base font-semibold text-ink outline-none transition-shadow focus:border-ink focus:ring-4 focus:ring-brand/40"
          >
            {Object.entries(TARGETS).map(([id, t]) => (
              <option key={id} value={id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-body">
            Current rate: {currentRate !== undefined ? formatToken(currentRate, 6) : "—"} {meta.unit}
          </p>
        </div>

        <div>
          <label htmlFor="new-rate" className="mb-1.5 block text-sm font-semibold text-ink">
            New rate ({meta.unit})
          </label>
          <input
            id="new-rate"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={newRateStr}
            onChange={(e) => setNewRateStr(e.target.value)}
            className="w-full rounded-control border border-ink/20 bg-canvas px-4 py-3 text-lg font-semibold text-ink outline-none transition-shadow placeholder:font-normal placeholder:text-ink-body/40 focus:border-ink focus:ring-4 focus:ring-brand/40"
          />
          {hasValidAmount && (
            <p className="mt-1.5 text-xs text-ink-body">
              ≈ {(newRateNum * SECONDS_PER_DAY).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
              {perDayUnit(meta.unit)}
            </p>
          )}
        </div>

        {hasValidAmount && (
          <div>
            <label htmlFor="request-summary" className="mb-1.5 block text-sm font-semibold text-ink">
              Summary to send
            </label>
            <textarea
              id="request-summary"
              readOnly
              value={requestText}
              rows={8}
              className="w-full rounded-control border border-ink/20 bg-canvas-soft px-4 py-3 font-mono text-xs leading-relaxed text-ink outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleCopy}
          disabled={!hasValidAmount}
          className="w-full rounded-card bg-brand px-4 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Couldn't copy — select the text above" : "Copy request"}
        </button>
      </div>
    </div>
  );
}
