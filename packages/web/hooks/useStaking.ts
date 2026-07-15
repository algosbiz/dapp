"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";

/** Read-only staking/wallet data used across the dashboard and staking panel. */
export function useStakingData() {
  const { address } = useAccount();

  const wethBalance = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const allowance = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.stakingRewards] : undefined,
    query: { enabled: Boolean(address) },
  });

  const stakedBalance = useReadContract({
    address: CONTRACTS.stakingRewards,
    abi: wethStakingRewardsAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const totalStaked = useReadContract({
    address: CONTRACTS.stakingRewards,
    abi: wethStakingRewardsAbi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });

  const earned = useReadContract({
    address: CONTRACTS.stakingRewards,
    abi: wethStakingRewardsAbi,
    functionName: "earned",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  return { wethBalance, allowance, stakedBalance, totalStaked, earned };
}

/** Write actions (approve/stake/withdraw/claim/exit) with shared tx status tracking. */
export function useStakingActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.weth,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.stakingRewards, amount],
    });

  const stake = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.stakingRewards,
      abi: wethStakingRewardsAbi,
      functionName: "stake",
      args: [amount],
    });

  const withdraw = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.stakingRewards,
      abi: wethStakingRewardsAbi,
      functionName: "withdraw",
      args: [amount],
    });

  const claimReward = () =>
    writeContract({
      address: CONTRACTS.stakingRewards,
      abi: wethStakingRewardsAbi,
      functionName: "claimReward",
    });

  const exit = () =>
    writeContract({
      address: CONTRACTS.stakingRewards,
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
