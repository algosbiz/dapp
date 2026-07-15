"use client";

import { useReadContract } from "wagmi";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { CONTRACTS } from "@/config/contracts";

/** Read-only pool data — reserves only, no swap/add-liquidity actions yet. */
export function useWethRwdPoolData() {
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

  // getReserves returns a tuple [reserve0, reserve1].
  const reserve0 = reserves.data ? reserves.data[0] : undefined;
  const reserve1 = reserves.data ? reserves.data[1] : undefined;

  return { reserve0, reserve1, reserves, totalSupply };
}
