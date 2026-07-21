"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";

/**
 * "FLX for FLX" pool — same WethStakingRewards contract as /stake, but both the staked
 * token and the reward token are FLX. Staked and earned amounts are both denominated
 * in FLX; the UI must label them clearly so users don't mistake one for the other.
 */
export function useRwdStakingData() {
  const { address } = useAccount();

  const rwdBalance = useReadContract({
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
    args: address ? [address, CONTRACTS.rwdStaking] : undefined,
    query: { enabled: Boolean(address) },
  });

  const stakedBalance = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const totalStaked = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });

  const earned = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const rewardRate = useReadContract({
    address: CONTRACTS.rwdStaking,
    abi: wethStakingRewardsAbi,
    functionName: "rewardRate",
  });

  return { rwdBalance, allowance, stakedBalance, totalStaked, earned, rewardRate };
}

/** Write actions (approve/stake/withdraw/claim/exit) with shared tx status tracking. */
export function useRwdStakingActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.rwdToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.rwdStaking, amount],
    });

  const stake = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.rwdStaking,
      abi: wethStakingRewardsAbi,
      functionName: "stake",
      args: [amount],
    });

  const withdraw = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.rwdStaking,
      abi: wethStakingRewardsAbi,
      functionName: "withdraw",
      args: [amount],
    });

  const claimReward = () =>
    writeContract({
      address: CONTRACTS.rwdStaking,
      abi: wethStakingRewardsAbi,
      functionName: "claimReward",
    });

  const exit = () =>
    writeContract({
      address: CONTRACTS.rwdStaking,
      abi: wethStakingRewardsAbi,
      functionName: "exit",
    });

  return {
    approve,
    stake,
    withdraw,
    claimReward,
    exit,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  };
}
