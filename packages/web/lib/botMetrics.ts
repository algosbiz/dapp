/**
 * Everything the Telegram bot reports, read straight from the chain.
 *
 * Lives server-side only (it's imported by API routes). Deliberately separate from the React
 * hooks: those are wallet-aware and per-component, while the bot needs one flat snapshot of
 * protocol-wide state with no connected account.
 */

import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";
import { robinhoodTestnet } from "@/config/chains";
import { CONTRACTS, FARM_PID, FARM_LP_PID } from "@/config/contracts";
import { erc20Abi } from "@/abi/erc20";
import { masterChefAbi } from "@/abi/masterChef";
import { lockedStakingAbi } from "@/abi/lockedStaking";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { wethRwdPoolAbi } from "@/abi/wethRwdPool";
import { fetchEthUsdPrice } from "@/lib/price";
import { computeAnnualPoolReward, computeAprPercent, convertByPoolPrice } from "@/lib/apr";

/** ERC20Capped's ceiling. Not in `erc20Abi` because only the FLX token has it. */
const cappedAbi = [
  { name: "cap", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export function botClient(): PublicClient {
  return createPublicClient({ chain: robinhoodTestnet, transport: http() });
}

export type SupplyFlow = {
  minted: bigint;
  burned: bigint;
  /** False when the log query failed or the range was unavailable — render "n/a", not "0". */
  available: boolean;
};

export type BotMetrics = {
  blockNumber: bigint;
  timestamp: Date;

  flxSupply: bigint;
  flxCap: bigint;
  /** Percent of the cap currently in existence. Burning frees room, so this can fall. */
  capUsedPercent: number;

  lockedTotal: bigint;
  lockedRewardBudget: bigint;

  emissionPerSecond: bigint;
  emissionWeth: bigint;
  emissionLp: bigint;
  emissionFlxFlx: bigint;

  farmWethTvl: bigint;
  farmLpTvl: bigint;
  flxStakedInFlxPool: bigint;

  reserveWeth: bigint;
  reserveFlx: bigint;
  wethPerFlx: number | null;
  usdPerFlx: number | null;
  ethUsd: number | null;

  aprWethPool: number | undefined;
  aprFlxPool: number | undefined;

  flow24h: SupplyFlow;
};

/**
 * Finds a block roughly `secondsAgo` in the past.
 *
 * Orbit L2 block times aren't fixed, so this samples the recent rate rather than assuming a
 * constant. Approximate by design: it only bounds a log query, and the query is inclusive at
 * both ends, so erring slightly old is harmless.
 */
async function blockNumberSecondsAgo(
  client: PublicClient,
  latestBlock: { number: bigint | null; timestamp: bigint },
  secondsAgo: number
): Promise<bigint> {
  const head = latestBlock.number ?? 0n;
  const sampleBack = head > 5_000n ? 5_000n : head > 1n ? head - 1n : 0n;
  if (sampleBack === 0n) return 0n;

  const older = await client.getBlock({ blockNumber: head - sampleBack });
  const elapsed = latestBlock.timestamp - older.timestamp;
  // A stalled or single-block chain gives elapsed <= 0; fall back to the sample window.
  if (elapsed <= 0n) return head > sampleBack ? head - sampleBack : 0n;

  const blocksPerSecond = Number(sampleBack) / Number(elapsed);
  const back = BigInt(Math.ceil(blocksPerSecond * secondsAgo));
  return head > back ? head - back : 0n;
}

/**
 * Net mint/burn of FLX over a block range, from Transfer events at the zero address.
 *
 * This exists because `totalSupply()` alone can no longer answer "how much was created?" —
 * the capped FLX token is burnable and LockedStaking burns the 5% early-exit penalty, so a
 * quiet day of 100 minted and 100 burned looks identical to a day where nothing happened.
 * Reporting the two legs separately is the whole point of the deflation feature being visible.
 */
export async function fetchSupplyFlow(
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint
): Promise<SupplyFlow> {
  const transferEvent = parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  );
  try {
    const [mints, burns] = await Promise.all([
      client.getLogs({ address: CONTRACTS.rwdToken, event: transferEvent, args: { from: ZERO }, fromBlock, toBlock }),
      client.getLogs({ address: CONTRACTS.rwdToken, event: transferEvent, args: { to: ZERO }, fromBlock, toBlock }),
    ]);
    const sum = (logs: typeof mints) =>
      logs.reduce((acc, log) => acc + ((log.args as { value?: bigint }).value ?? 0n), 0n);
    return { minted: sum(mints), burned: sum(burns), available: true };
  } catch {
    // Public RPCs cap getLogs ranges and rate-limit. A missing flow line shouldn't cost us the
    // whole report — the caller renders "n/a" so a zero is never mistaken for a real quiet day.
    return { minted: 0n, burned: 0n, available: false };
  }
}

export async function fetchBotMetrics(): Promise<BotMetrics> {
  const client = botClient();
  const latest = await client.getBlock();

  const [
    flxSupply,
    flxCap,
    lockedTotal,
    lockedRewardBudget,
    emissionPerSecond,
    totalAllocPoint,
    poolWeth,
    poolLp,
    flxFlxRate,
    flxStakedInFlxPool,
    reserves,
    lpTotalSupply,
    ethUsd,
  ] = await Promise.all([
    client.readContract({ address: CONTRACTS.rwdToken, abi: erc20Abi, functionName: "totalSupply" }),
    client.readContract({ address: CONTRACTS.rwdToken, abi: cappedAbi, functionName: "cap" }),
    client.readContract({ address: CONTRACTS.lockedStaking, abi: lockedStakingAbi, functionName: "totalStaked" }),
    client.readContract({ address: CONTRACTS.lockedStaking, abi: lockedStakingAbi, functionName: "rewardBudget" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "rewardPerSecond" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "totalAllocPoint" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "poolInfo", args: [FARM_PID] }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "poolInfo", args: [FARM_LP_PID] }),
    client.readContract({ address: CONTRACTS.rwdStaking, abi: wethStakingRewardsAbi, functionName: "rewardRate" }),
    client.readContract({ address: CONTRACTS.rwdStaking, abi: wethStakingRewardsAbi, functionName: "totalSupply" }),
    client.readContract({ address: CONTRACTS.wethRwdPool, abi: wethRwdPoolAbi, functionName: "getReserves" }),
    client.readContract({ address: CONTRACTS.wethRwdPool, abi: erc20Abi, functionName: "totalSupply" }),
    fetchEthUsdPrice(),
  ]);

  const [allocWeth] = [(poolWeth as readonly unknown[])[1] as bigint];
  const [allocLp] = [(poolLp as readonly unknown[])[1] as bigint];
  const wethToken = (poolWeth as readonly unknown[])[0] as `0x${string}`;
  const lpToken = (poolLp as readonly unknown[])[0] as `0x${string}`;

  // TVL of each farm pool = how much of its staking token the farm is holding.
  const [farmWethTvl, farmLpTvl] = await Promise.all([
    client.readContract({ address: wethToken, abi: erc20Abi, functionName: "balanceOf", args: [CONTRACTS.masterChef] }),
    client.readContract({ address: lpToken, abi: erc20Abi, functionName: "balanceOf", args: [CONTRACTS.masterChef] }),
  ]);

  const [reserveWeth, reserveFlx] = reserves as readonly [bigint, bigint];

  // Price legs. Reserves are both 18-decimal so the ratio is dimensionless.
  const hasPrice = reserveWeth > 0n && reserveFlx > 0n;
  const wethPerFlx = hasPrice ? Number(reserveWeth) / Number(reserveFlx) : null;
  const usdPerFlx = wethPerFlx !== null && ethUsd !== undefined ? wethPerFlx * ethUsd : null;

  // APR, in the same WETH-equivalent trick the dashboards use: expressing reward and TVL in a
  // common unit makes the USD price of WETH cancel out of the ratio.
  const flxPriceInWeth = hasPrice ? convertByPoolPrice(10n ** 18n, reserveFlx, reserveWeth) : 0n;
  const annualWethPool = computeAnnualPoolReward(emissionPerSecond, allocWeth, totalAllocPoint);
  const annualWethPoolInWeth = convertByPoolPrice(annualWethPool, 10n ** 18n, flxPriceInWeth);
  const aprWethPool = computeAprPercent(annualWethPoolInWeth, farmWethTvl);

  // FLX staked to earn FLX needs no conversion — same currency on both sides.
  const aprFlxPool = computeAprPercent(flxFlxRate * 31_536_000n, flxStakedInFlxPool);

  const dayAgo = await blockNumberSecondsAgo(client, latest, 24 * 60 * 60);
  const flow24h = await fetchSupplyFlow(client, dayAgo, latest.number ?? 0n);

  const share = (alloc: bigint) =>
    totalAllocPoint === 0n ? 0n : (emissionPerSecond * alloc) / totalAllocPoint;

  return {
    blockNumber: latest.number ?? 0n,
    timestamp: new Date(Number(latest.timestamp) * 1000),

    flxSupply,
    flxCap,
    capUsedPercent: flxCap === 0n ? 0 : (Number(flxSupply) / Number(flxCap)) * 100,

    lockedTotal,
    lockedRewardBudget,

    emissionPerSecond,
    emissionWeth: share(allocWeth),
    emissionLp: share(allocLp),
    emissionFlxFlx: flxFlxRate,

    farmWethTvl,
    farmLpTvl,
    flxStakedInFlxPool,

    reserveWeth,
    reserveFlx,
    wethPerFlx,
    usdPerFlx,
    ethUsd: ethUsd ?? null,

    aprWethPool,
    aprFlxPool,

    flow24h,
  };
}

export { blockNumberSecondsAgo };
