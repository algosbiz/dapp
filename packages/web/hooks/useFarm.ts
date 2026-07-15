"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { masterChefAbi } from "@/abi/masterChef";
import { CONTRACTS, FARM_PID } from "@/config/contracts";

/** Read-only farm data for the connected wallet + the WETH pool (pid 0). */
export function useFarmData() {
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
    args: address ? [address, CONTRACTS.masterChef] : undefined,
    query: { enabled: Boolean(address) },
  });

  // TVL for the pool = WETH held by the MasterChef.
  const poolStaked = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACTS.masterChef],
    query: { refetchInterval: 15_000 },
  });

  const userInfo = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "userInfo",
    args: address ? [FARM_PID, address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const pending = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "pendingReward",
    args: address ? [FARM_PID, address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  });

  const rewardPerSecond = useReadContract({
    address: CONTRACTS.masterChef,
    abi: masterChefAbi,
    functionName: "rewardPerSecond",
  });

  // userInfo returns a tuple [amount, rewardDebt].
  const stakedAmount = userInfo.data ? userInfo.data[0] : undefined;

  return { wethBalance, allowance, poolStaked, userInfo, stakedAmount, pending, rewardPerSecond };
}

/** Farm write actions (approve/deposit/withdraw/harvest/emergency) with shared tx status. */
export function useFarmActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.weth,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.masterChef, amount],
    });

  const deposit = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "deposit",
      args: [FARM_PID, amount],
    });

  const withdraw = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "withdraw",
      args: [FARM_PID, amount],
    });

  // Harvesting is a zero-amount deposit — it pays out pending rewards only.
  const harvest = () =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "deposit",
      args: [FARM_PID, 0n],
    });

  const emergencyWithdraw = () =>
    writeContract({
      address: CONTRACTS.masterChef,
      abi: masterChefAbi,
      functionName: "emergencyWithdraw",
      args: [FARM_PID],
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
