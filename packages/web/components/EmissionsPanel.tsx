import { createPublicClient, http } from "viem";
import { robinhoodTestnet } from "@/config/chains";
import { erc20Abi } from "@/abi/erc20";
import { masterChefAbi } from "@/abi/masterChef";
import { wethStakingRewardsAbi } from "@/abi/wethStakingRewards";
import { CONTRACTS } from "@/config/contracts";
import { formatToken } from "@/lib/format";

/**
 * Read-only snapshot of supply + every reward-emission setting across all three products.
 * All owner-only to change (MasterChef.updateEmissionRate, WethStakingRewards.notifyRewardAmount,
 * MasterChef.ownerMint) — this page only ever reads, never writes, so it needs no wallet
 * connection and no owner-gating. Changes still go through chat + a script against the
 * deployer wallet, same as the RWD pre-mint — see HANDOFF.md.
 */
async function fetchEmissionsData() {
  const client = createPublicClient({ chain: robinhoodTestnet, transport: http() });

  const [
    rwdTotalSupply,
    rewardPerSecond,
    totalAllocPoint,
    pool0,
    pool1,
    stakeRewardRate,
    stakePeriodFinish,
    rwdStakeRewardRate,
    rwdStakePeriodFinish,
  ] = await Promise.all([
    client.readContract({ address: CONTRACTS.rwdToken, abi: erc20Abi, functionName: "totalSupply" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "rewardPerSecond" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "totalAllocPoint" }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "poolInfo", args: [0n] }),
    client.readContract({ address: CONTRACTS.masterChef, abi: masterChefAbi, functionName: "poolInfo", args: [1n] }),
    client.readContract({ address: CONTRACTS.stakingRewards, abi: wethStakingRewardsAbi, functionName: "rewardRate" }),
    client.readContract({
      address: CONTRACTS.stakingRewards,
      abi: wethStakingRewardsAbi,
      functionName: "periodFinish",
    }),
    client.readContract({ address: CONTRACTS.rwdStaking, abi: wethStakingRewardsAbi, functionName: "rewardRate" }),
    client.readContract({
      address: CONTRACTS.rwdStaking,
      abi: wethStakingRewardsAbi,
      functionName: "periodFinish",
    }),
  ]);

  const wethAlloc = pool0[1];
  const lpAlloc = pool1[1];
  const wethPoolRate = totalAllocPoint > 0n ? (rewardPerSecond * wethAlloc) / totalAllocPoint : 0n;
  const lpPoolRate = totalAllocPoint > 0n ? (rewardPerSecond * lpAlloc) / totalAllocPoint : 0n;

  return {
    rwdTotalSupply,
    farm: { rewardPerSecond, totalAllocPoint, wethAlloc, lpAlloc, wethPoolRate, lpPoolRate },
    stake: { rewardRate: stakeRewardRate, periodFinish: stakePeriodFinish },
    rwdStake: { rewardRate: rwdStakeRewardRate, periodFinish: rwdStakePeriodFinish },
  };
}

/** A funding period that already ended isn't a bug — rewardRate just stops accruing new
 *  earnings past periodFinish until the owner calls notifyRewardAmount again. */
function fundingStatus(periodFinish: bigint): { label: string; active: boolean } {
  const nowSec = Math.floor(Date.now() / 1000);
  const finishSec = Number(periodFinish);
  const active = finishSec > nowSec;
  const date = new Date(finishSec * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return { label: active ? `Funded until ${date}` : `Funding period ended ${date}`, active };
}

function allocPercent(alloc: bigint, total: bigint): string {
  if (total === 0n) return "—";
  return `${((Number(alloc) / Number(total)) * 100).toFixed(0)}%`;
}

export async function EmissionsPanel() {
  const data = await fetchEmissionsData();
  const stakeStatus = fundingStatus(data.stake.periodFinish);
  const rwdStakeStatus = fundingStatus(data.rwdStake.periodFinish);

  return (
    <div className="space-y-6">
      <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
        <p className="text-sm font-semibold text-ink-body">Total RWD supply</p>
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">
          {formatToken(data.rwdTotalSupply)} <span className="text-lg font-semibold text-ink-body">RWD</span>
        </p>
        <p className="mt-2 text-xs text-ink-body">
          Read live from the contract. Can only ever increase — there is no burn function.
        </p>
      </div>

      <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Farm (MasterChef)</h2>
        <p className="mt-1 text-sm text-ink-body">
          Mint-on-demand — new RWD is created every second and split across two pools.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-control bg-canvas-soft p-4">
            <p className="text-xs font-semibold text-ink-body">Farm-wide rate</p>
            <p className="mt-1 text-xl font-bold text-ink">{formatToken(data.farm.rewardPerSecond, 6)}</p>
            <p className="text-xs text-ink-body">RWD / sec</p>
          </div>
          <div className="rounded-control bg-canvas-soft p-4">
            <p className="text-xs font-semibold text-ink-body">
              → WETH pool ({allocPercent(data.farm.wethAlloc, data.farm.totalAllocPoint)})
            </p>
            <p className="mt-1 text-xl font-bold text-ink">{formatToken(data.farm.wethPoolRate, 6)}</p>
            <p className="text-xs text-ink-body">RWD / sec</p>
          </div>
          <div className="rounded-control bg-canvas-soft p-4">
            <p className="text-xs font-semibold text-ink-body">
              → LP pool ({allocPercent(data.farm.lpAlloc, data.farm.totalAllocPoint)})
            </p>
            <p className="mt-1 text-xl font-bold text-ink">{formatToken(data.farm.lpPoolRate, 6)}</p>
            <p className="text-xs text-ink-body">RWD / sec</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Stake (WETH → tRWD)</h2>
          <p className="mt-1 text-sm text-ink-body">Pre-funded — pays from a reward budget deposited upfront.</p>
          <div className="mt-4 rounded-control bg-canvas-soft p-4">
            <p className="text-xs font-semibold text-ink-body">Reward rate</p>
            <p className="mt-1 text-xl font-bold text-ink">{formatToken(data.stake.rewardRate, 6)}</p>
            <p className="text-xs text-ink-body">tRWD / sec</p>
          </div>
          <p
            className={`mt-3 text-xs font-semibold ${stakeStatus.active ? "text-positive-deep" : "text-negative-deep"}`}
          >
            {stakeStatus.label}
          </p>
        </div>

        <div className="rounded-card bg-canvas p-6 shadow-card sm:p-8">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Stake RWD (RWD → RWD)</h2>
          <p className="mt-1 text-sm text-ink-body">Pre-funded — a separate reward budget, same model as above.</p>
          <div className="mt-4 rounded-control bg-canvas-soft p-4">
            <p className="text-xs font-semibold text-ink-body">Reward rate</p>
            <p className="mt-1 text-xl font-bold text-ink">{formatToken(data.rwdStake.rewardRate, 6)}</p>
            <p className="text-xs text-ink-body">RWD / sec</p>
          </div>
          <p
            className={`mt-3 text-xs font-semibold ${rwdStakeStatus.active ? "text-positive-deep" : "text-negative-deep"}`}
          >
            {rwdStakeStatus.label}
          </p>
        </div>
      </div>
    </div>
  );
}
