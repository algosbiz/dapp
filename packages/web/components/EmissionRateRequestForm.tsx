"use client";

import { useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { parseEther } from "viem";
import { masterChefAbi } from "@/abi/masterChef";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";
import { formatToken } from "@/lib/format";
import { computeRequiredTopUp } from "@/lib/rewardFunding";
import { useAdminActions, useAdminOwnership, useFundingState } from "@/hooks/useAdminControls";
import { useTransactionToast } from "@/hooks/useTransactionToast";
import { ButtonContent } from "@/components/Spinner";

const SECONDS_PER_DAY = 86_400;

type Target = "farm" | "stake" | "stake-rwd";

const TARGETS: Record<
  Target,
  {
    label: string;
    unit: string;
    address: `0x${string}`;
    contractName: string;
    note: string;
    rewardTokenAddress?: `0x${string}`;
  }
> = {
  farm: {
    label: "Farm (MasterChef) — farm-wide rate",
    unit: "FLX/sec",
    address: CONTRACTS.masterChef,
    contractName: "MasterChef",
    note: "Applies immediately and settles both pools first, split across the WETH and LP farm pools by their current allocation weights.",
  },
  stake: {
    label: "Stake (WETH → tFLX)",
    unit: "tFLX/sec",
    address: CONTRACTS.stakingRewards,
    contractName: "WethStakingRewards (Stake)",
    note: "This pool's rate comes from funding it (notifyRewardAmount), not a direct setter — the exact top-up needed will be computed at execution time.",
    rewardTokenAddress: CONTRACTS.rewardsToken,
  },
  "stake-rwd": {
    label: "Stake FLX (FLX → FLX)",
    unit: "FLX/sec",
    address: CONTRACTS.rwdStaking,
    contractName: "WethStakingRewards (Stake FLX)",
    note: "Same funding-based model as Stake above, in FLX instead of tFLX.",
    rewardTokenAddress: CONTRACTS.rwdToken,
  },
};

/** Turns a "/sec" unit label into its "/day" equivalent for the human-scale preview line. */
const perDayUnit = (unit: string) => unit.replace("/sec", "/day");
/** Turns a "/sec" rate unit into the bare token symbol (e.g. "tFLX/sec" -> "tFLX"). */
const tokenSymbol = (unit: string) => unit.replace("/sec", "");

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

  const parsedNewRateWei = useMemo(() => {
    try {
      return hasValidAmount ? parseEther(newRateStr) : 0n;
    } catch {
      return 0n;
    }
  }, [hasValidAmount, newRateStr]);

  // Owner-mode: is the connected wallet actually able to apply this directly on-chain?
  const { isFarmOwner, isStakeOwner, isRwdStakeOwner } = useAdminOwnership();
  const isOwnerByTarget: Record<Target, boolean> = {
    farm: isFarmOwner,
    stake: isStakeOwner,
    "stake-rwd": isRwdStakeOwner,
  };
  const isOwnerOfTarget = isOwnerByTarget[target];

  // WethStakingRewards pools need extra state to preview the funding top-up their rate
  // actually requires — called unconditionally for both (Rules of Hooks), picked by target.
  const stakeFunding = useFundingState(CONTRACTS.stakingRewards, CONTRACTS.rewardsToken);
  const rwdStakeFunding = useFundingState(CONTRACTS.rwdStaking, CONTRACTS.rwdToken);
  const funding = target === "stake" ? stakeFunding : target === "stake-rwd" ? rwdStakeFunding : undefined;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const requiredTopUp =
    funding &&
    parsedNewRateWei > 0n &&
    funding.rewardsDuration.data !== undefined &&
    funding.periodFinish.data !== undefined &&
    funding.rewardRate.data !== undefined
      ? computeRequiredTopUp({
          desiredRatePerSecond: parsedNewRateWei,
          rewardsDuration: funding.rewardsDuration.data,
          periodFinish: funding.periodFinish.data,
          currentRewardRate: funding.rewardRate.data,
          nowSeconds,
        })
      : undefined;

  const insufficientBalance =
    requiredTopUp !== undefined &&
    funding?.ownerRewardBalance.data !== undefined &&
    funding.ownerRewardBalance.data < requiredTopUp;
  const shortfall =
    insufficientBalance && funding?.ownerRewardBalance.data !== undefined
      ? requiredTopUp! - funding.ownerRewardBalance.data
      : undefined;
  const needsApproval =
    requiredTopUp !== undefined && (funding?.allowance.data === undefined || funding.allowance.data < requiredTopUp);
  const periodFinishLabel =
    funding?.periodFinish.data !== undefined
      ? new Date(Number(funding.periodFinish.data) * 1000).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  const { updateFarmRate, approveReward, fundPool, isPending, isConfirming, isConfirmed, error, reset } =
    useAdminActions();
  const { run, activeLabel } = useTransactionToast({ isPending, isConfirming, isConfirmed, error, reset });
  const isBusy = isPending || isConfirming;

  useEffect(() => {
    if (isConfirmed) {
      farmRate.refetch();
      stakeRate.refetch();
      rwdStakeRate.refetch();
      stakeFunding.periodFinish.refetch();
      stakeFunding.rewardRate.refetch();
      stakeFunding.ownerRewardBalance.refetch();
      stakeFunding.allowance.refetch();
      rwdStakeFunding.periodFinish.refetch();
      rwdStakeFunding.rewardRate.refetch();
      rwdStakeFunding.ownerRewardBalance.refetch();
      rwdStakeFunding.allowance.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

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

        {isOwnerOfTarget ? (
          <div className="space-y-3 rounded-control border border-positive/30 bg-positive/5 p-4">
            <p className="text-xs font-semibold text-positive-deep">
              Connected wallet is the owner of this contract — this applies directly on-chain,
              no request needed.
            </p>

            {target === "farm" ? (
              <button
                type="button"
                disabled={parsedNewRateWei <= 0n || isBusy}
                onClick={() => run("Update rate", () => updateFarmRate(parsedNewRateWei))}
                className="w-full rounded-card bg-brand px-4 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ButtonContent busy={activeLabel === "Update rate"} label="Update rate" busyLabel="Updating…" />
              </button>
            ) : (
              <>
                {parsedNewRateWei > 0n && requiredTopUp === undefined && (
                  <p className="text-xs font-semibold text-warning-content">
                    Can't reach this rate by topping up — it's below what's already committed
                    for the rest of the current period (ends {periodFinishLabel}). Choose a
                    higher rate, or wait until then.
                  </p>
                )}
                {requiredTopUp !== undefined && (
                  <p className="text-xs text-ink-body">
                    Requires funding this pool with{" "}
                    <span className="font-semibold text-ink">
                      {formatToken(requiredTopUp, 6)} {tokenSymbol(meta.unit)}
                    </span>
                    .
                    {insufficientBalance && shortfall !== undefined && (
                      <span className="mt-1 block font-semibold text-negative-deep">
                        You're short {formatToken(shortfall, 6)} {tokenSymbol(meta.unit)} in this
                        wallet — mint or acquire more before funding this rate.
                      </span>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={requiredTopUp === undefined || !needsApproval || insufficientBalance || isBusy}
                    onClick={() =>
                      requiredTopUp !== undefined &&
                      meta.rewardTokenAddress &&
                      run("Approve", () => approveReward(meta.rewardTokenAddress!, meta.address, requiredTopUp))
                    }
                    className="rounded-card bg-canvas-soft px-4 py-3.5 text-base font-bold text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ButtonContent busy={activeLabel === "Approve"} label="Approve" busyLabel="Approving…" />
                  </button>
                  <button
                    type="button"
                    disabled={requiredTopUp === undefined || needsApproval || insufficientBalance || isBusy}
                    onClick={() =>
                      requiredTopUp !== undefined &&
                      run("Fund & set rate", () => fundPool(meta.address, requiredTopUp))
                    }
                    className="rounded-card bg-brand px-4 py-3.5 text-base font-bold text-ink transition-colors hover:bg-brand-active disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ButtonContent
                      busy={activeLabel === "Fund & set rate"}
                      label="Fund & set rate"
                      busyLabel="Funding…"
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
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
              {copyState === "copied"
                ? "Copied!"
                : copyState === "failed"
                  ? "Couldn't copy — select the text above"
                  : "Copy request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
