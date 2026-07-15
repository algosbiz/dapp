"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { masterChefAbi } from "@/abi/masterChef";
import { CONTRACTS, FARM_PID } from "@/config/contracts";

/**
 * Read-only farm data for the connected wallet + a given MasterChef pool. Defaults to
 * pid 0 / WETH (the original pool) so existing callers are unaffected; pass a different
 * pid + stakingToken to read another pool on the same MasterChef contract (e.g. the LP
 * farming pool).
 */
export function useFarmData(pid: bigint = FARM_PID, stakingToken: `0x${string}` = CONTRACTS.weth) {
  const { address } = useAccount();

  const wethBalance = useReadContract({
    address: stakingToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const allowance = useReadContract({
    address: stakingToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.masterChef] : undefined,
    query: { enabled: Boolean(address) },
  });

  // TVL for the pool = staking token held by the MasterChef.
  const poolStaked = useReadContract({
    address: stakingToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.masterChef],
    query: { refetchInterval: 15_000 },
  });

  const userInfo = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "userInfo",
    args: address ? [pid, address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const pending = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "pendingReward",
    args: address ? [pid, address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const rewardPerSecond = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "rewardPerSecond",
  });

  const poolInfo = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "poolInfo",
    args: [pid],
  });

  const totalAllocPoint = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "totalAllocPoint",
  });

  // userInfo returns a tuple [amount, rewardDebt]; poolInfo returns [lpToken, allocPoint, lastRewardTime, accRewardPerShare].
  const stakedAmount = userInfo.data ? userInfo.data[0] : undefined;
  const allocPoint = poolInfo.data ? poolInfo.data[1] : undefined;

  return {
    wethBalance,
    allowance,
    poolStaked,
    userInfo,
    stakedAmount,
    pending,
    rewardPerSecond,
    poolInfo,
    allocPoint,
    totalAllocPoint,
  };
}

/** Farm write actions (approve/deposit/withdraw/harvest/emergency) with shared tx status. */
export function useFarmActions(pid: bigint = FARM_PID, stakingToken: `0x${string}` = CONTRACTS.weth) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: stakingToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.masterChef, amount],
    });

  const deposit = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "deposit",
      args: [pid, amount],
    });

  const withdraw = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "withdraw",
      args: [pid, amount],
    });

  // Harvesting is a zero-amount deposit — it pays out pending rewards only.
  const harvest = () =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "deposit",
      args: [pid, 0n],
    });

  const emergencyWithdraw = () =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "emergencyWithdraw",
      args: [pid],
    });

  return {
    approve,
    deposit,
    withdraw,
    harvest,
    emergencyWithdraw,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  };
}
