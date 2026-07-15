"use client";

import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { CONTRACTS } from "@/config/contracts";

/** Applied client-side to protect against reserve movement between quote and confirmation. */
export const SLIPPAGE_BPS = 50n; // 0.5%
const BPS_DENOMINATOR = 10_000n;

/** Reduces `amount` by the fixed slippage tolerance, floor-rounded (never over-promises). */
export function withSlippage(amount: bigint): bigint {
  return (amount * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
}

/** Read-only pool + wallet-aware data: reserves, LP supply, balances, and allowances. */
export function useWethRwdPoolData() {
  const { address } = useAccount();

  const reserves = useReadContract({
    address: CONTRACTS.wethRwdPool,
    abi: wethRwdPoolAbi,
    functionName: "getReserves",
    query: { refetchInterval: 15_000 },
  });

  const totalSupply = useReadContract({
    address: CONTRACTS.wethRwdPool,
    abi: wethRwdPoolAbi,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });

  const wethBalance = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const rwdBalance = useReadContract({
    address: CONTRACTS.rwdToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const lpBalance = useReadContract({
    address: CONTRACTS.wethRwdPool,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const wethAllowance = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.wethRwdPool] : undefined,
    query: { enabled: Boolean(address) },
  });

  const rwdAllowance = useReadContract({
    address: CONTRACTS.rwdToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.wethRwdPool] : undefined,
    query: { enabled: Boolean(address) },
  });

  // getReserves returns a tuple [reserve0, reserve1].
  const reserve0 = reserves.data ? reserves.data[0] : undefined;
  const reserve1 = reserves.data ? reserves.data[1] : undefined;

  return {
    reserve0,
    reserve1,
    reserves,
    totalSupply,
    wethBalance,
    rwdBalance,
    lpBalance,
    wethAllowance,
    rwdAllowance,
  };
}

/** Write actions (approve both sides/addLiquidity/removeLiquidity/swap) with shared tx status. */
export function useWethRwdPoolActions() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const approveToken0 = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.weth,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.wethRwdPool, amount],
    });

  const approveToken1 = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.rwdToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.wethRwdPool, amount],
    });

  const addLiquidity = (
    amount0Desired: bigint,
    amount1Desired: bigint,
    amount0Min: bigint,
    amount1Min: bigint
  ) =>
    writeContract({
      address: CONTRACTS.wethRwdPool,
      abi: wethRwdPoolAbi,
      functionName: "addLiquidity",
      args: [amount0Desired, amount1Desired, amount0Min, amount1Min],
    });

  const removeLiquidity = (liquidity: bigint, amount0Min: bigint, amount1Min: bigint) =>
    writeContract({
      address: CONTRACTS.wethRwdPool,
      abi: wethRwdPoolAbi,
      functionName: "removeLiquidity",
      args: [liquidity, amount0Min, amount1Min],
    });

  const swap = (amountIn: bigint, tokenIn: `0x${string}`, amountOutMin: bigint) => {
    if (!address) return;
    writeContract({
      address: CONTRACTS.wethRwdPool,
      abi: wethRwdPoolAbi,
      functionName: "swap",
      args: [amountIn, tokenIn, amountOutMin, address],
    });
  };

  return {
    approveToken0,
    approveToken1,
    addLiquidity,
    removeLiquidity,
    swap,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    reset,
  };
}
