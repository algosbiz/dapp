"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { lockedStakingAbi } from "@/abi/lockedStaking";
import { CONTRACTS } from "@/config/contracts";

export type LockedPosition = {
  amount: bigint;
  startTime: bigint;
  unlockTime: bigint;
  aprBps: bigint;
  withdrawn: boolean;
};

const BPS = 10_000n;
const YEAR = 31_536_000n; // 365 days in seconds

/**
 * Reward accrued on a position so far, matching the contract's linear-APR formula and its
 * cap at the unlock time. Computed client-side (from data already read) so the position list
 * doesn't need one extra RPC call per position.
 */
export function computePendingReward(position: LockedPosition, nowSeconds: bigint): bigint {
  if (position.withdrawn || position.amount === 0n) return 0n;
  const end = nowSeconds < position.unlockTime ? nowSeconds : position.unlockTime;
  if (end <= position.startTime) return 0n;
  const elapsed = end - position.startTime;
  return (position.amount * position.aprBps * elapsed) / (BPS * YEAR);
}

/** Read-only data for the locked-staking panel + the connected wallet's positions. */
export function useLockedStakingData() {
  const { address } = useAccount();

  const flxBalance = useReadContract({
    address: CONTRACTS.rwdToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const allowance = useReadContract({
    address: CONTRACTS.rwdToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.lockedStaking] : undefined,
    query: { enabled: Boolean(address) },
  });

  const minStake = useReadContract({
    address: CONTRACTS.lockedStaking,
    abi: lockedStakingAbi,
    functionName: "minStake",
  });

  const totalStaked = useReadContract({
    address: CONTRACTS.lockedStaking,
    abi: lockedStakingAbi,
    functionName: "totalStaked",
    query: { refetchInterval: 15_000 },
  });

  const apr0 = useReadContract({ address: CONTRACTS.lockedStaking, abi: lockedStakingAbi, functionName: "aprBps", args: [0n] });
  const apr1 = useReadContract({ address: CONTRACTS.lockedStaking, abi: lockedStakingAbi, functionName: "aprBps", args: [1n] });
  const apr2 = useReadContract({ address: CONTRACTS.lockedStaking, abi: lockedStakingAbi, functionName: "aprBps", args: [2n] });

  const positions = useReadContract({
    address: CONTRACTS.lockedStaking,
    abi: lockedStakingAbi,
    functionName: "getPositions",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  return {
    flxBalance,
    allowance,
    minStake,
    totalStaked,
    aprBps: [apr0.data, apr1.data, apr2.data] as const,
    positions,
  };
}

/** Write actions (approve / stake / withdraw / withdrawEarly) with shared tx status. */
export function useLockedStakingActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.rwdToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.lockedStaking, amount],
    });

  const stake = (amount: bigint, tier: number) =>
    writeContract({
      address: CONTRACTS.lockedStaking,
      abi: lockedStakingAbi,
      functionName: "stake",
      args: [amount, tier],
    });

  const withdraw = (positionId: bigint) =>
    writeContract({
      address: CONTRACTS.lockedStaking,
      abi: lockedStakingAbi,
      functionName: "withdraw",
      args: [positionId],
    });

  const withdrawEarly = (positionId: bigint) =>
    writeContract({
      address: CONTRACTS.lockedStaking,
      abi: lockedStakingAbi,
      functionName: "withdrawEarly",
      args: [positionId],
    });

  return { approve, stake, withdraw, withdrawEarly, hash, isPending, isConfirming, isConfirmed, error, reset };
}
