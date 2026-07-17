"use client";

import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { wethAbi } from "@/abi/weth";
import { CONTRACTS } from "@/config/contracts";

/** Native ETH balance + wrapped WETH balance for the connected wallet. */
export function useWrapData() {
  const { address } = useAccount();

  const ethBalance = useBalance({
    address,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  const wethBalance = useReadContract({
    address: CONTRACTS.weth,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });

  return { ethBalance, wethBalance };
}

/** Wrap (ETH -> WETH via payable deposit) and unwrap (WETH -> ETH via withdraw). */
export function useWrapActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const wrap = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.weth,
      abi: wethAbi,
      functionName: "deposit",
      value: amount,
    });

  const unwrap = (amount: bigint) =>
    writeContract({
      address: CONTRACTS.weth,
      abi: wethAbi,
      functionName: "withdraw",
      args: [amount],
    });

  return { wrap, unwrap, hash, isPending, isConfirming, isConfirmed, error, reset };
}
