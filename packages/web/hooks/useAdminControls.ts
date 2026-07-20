"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { masterChefAbi } from "@/abi/masterChef";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";

const sameAddress = (a: string | undefined, b: string | undefined) =>
  Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/** Whether the connected wallet is the owner of each contract this admin panel can act on. */
export function useAdminOwnership() {
  const { address } = useAccount();

  const farmOwner = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "owner",
  });
  const stakeOwner = useReadContract({
    address: CONTRACTS.stakingRewards,
    abi: wethStakingRewardsAbi,
    functionName: "owner",
  });
  const rwdStakeOwner = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "owner",
  });

  const isFarmOwner = sameAddress(address, farmOwner.data);
  const isStakeOwner = sameAddress(address, stakeOwner.data);
  const isRwdStakeOwner = sameAddress(address, rwdStakeOwner.data);

  return {
    isFarmOwner,
    isStakeOwner,
    isRwdStakeOwner,
    isAnyOwner: isFarmOwner || isStakeOwner || isRwdStakeOwner,
  };
}

/** Extra read-only state needed to preview/execute a WethStakingRewards funding top-up. */
export function useFundingState(poolAddress: `0x${string}`, rewardTokenAddress: `0x${string}`) {
  const { address } = useAccount();

  const rewardsDuration = useReadContract({
    address: poolAddress,
    abi: wethStakingRewardsAbi,
    functionName: "rewardsDuration",
  });
  const periodFinish = useReadContract({
    address: poolAddress,
    abi: wethStakingRewardsAbi,
    functionName: "periodFinish",
  });
  const rewardRate = useReadContract({
    address: poolAddress,
    abi: wethStakingRewardsAbi,
    functionName: "rewardRate",
  });
  const ownerRewardBalance = useReadContract({
    address: rewardTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const allowance = useReadContract({
    address: rewardTokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, poolAddress] : undefined,
    query: { enabled: Boolean(address) },
  });

  return { rewardsDuration, periodFinish, rewardRate, ownerRewardBalance, allowance };
}

/** Owner-only write actions: a direct farm-rate setter, plus approve+fund for the two WethStakingRewards pools. */
export function useAdminActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const updateFarmRate = (newRatePerSecond: bigint) =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "updateEmissionRate",
      args: [newRatePerSecond],
    });

  const approveReward = (tokenAddress: `0x${string}`, poolAddress: `0x${string}`, amount: bigint) =>
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [poolAddress, amount],
    });

  const fundPool = (poolAddress: `0x${string}`, amount: bigint) =>
    writeContract({
      address: poolAddress,
      abi: wethStakingRewardsAbi,
      functionName: "notifyRewardAmount",
      args: [amount],
    });

  return {
    updateFarmRate,
    approveReward,
    fundPool,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  };
}
