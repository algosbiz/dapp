import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { robinhoodTestnet } from "@/config/chains";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { CONTRACTS } from "@/config/contracts";
import { fetchEthUsdPrice } from "@/lib/price";

/**
 * The single source of truth for "what is 1 FLX worth in USD".
 *
 * Exists as a server route rather than being computed in each component for two reasons:
 * the navbar pill and the /pool spot-price tile MUST agree (a visitor seeing two different
 * FLX prices on one screen is exactly the confusion this endpoint was created to end), and
 * the ETH/USD leg is a rate-limited public API that shouldn't be called once per browser.
 * Computing both legs here means one cached read serves every surface.
 *
 * The FLX/WETH leg is real but comes from our own shallow testnet pool, so the USD figure is
 * a hypothetical ("what FLX would be worth if it traded at today's real ETH price"), not a
 * market fact. Callers should label it accordingly.
 */
export const revalidate = 60;

export async function GET() {
  try {
    const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });
    const [reserves, ethUsd] = await Promise.all([
      client.readContract({
        address: CONTRACTS.wethRwdPool,
        abi: wethRwdPoolAbi,
        functionName: "getReserves",
      }),
      fetchEthUsdPrice(),
    ]);

    const [reserve0, reserve1] = reserves as readonly [bigint, bigint];

    // An empty pool has no price at all — say so rather than dividing by zero.
    if (reserve0 === 0n || reserve1 === 0n) {
      return NextResponse.json({ usdPerFlx: null, flxPerWeth: null, ethUsd: ethUsd ?? null });
    }

    // Work in floats only after the division: both reserves are 18-decimal, so the ratio is
    // dimensionless and safe to convert without losing the magnitude to bigint truncation.
    const flxPerWeth = Number(reserve1) / Number(reserve0);
    const wethPerFlx = 1 / flxPerWeth;
    const usdPerFlx = ethUsd !== undefined ? wethPerFlx * ethUsd : null;

    return NextResponse.json({ usdPerFlx, flxPerWeth, ethUsd: ethUsd ?? null });
  } catch {
    // Price is decoration, never a blocker: callers render a dash and move on.
    return NextResponse.json({ usdPerFlx: null, flxPerWeth: null, ethUsd: null });
  }
}
