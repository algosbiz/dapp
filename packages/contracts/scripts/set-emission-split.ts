import { ethers } from "hardhat";

/**
 * Re-weights FLX emission to 10% WETH pool / 60% LP pool / 30% FLX-FLX, at a total of
 * 0.01 FLX/sec (the boss's requested split).
 *
 * The three targets do NOT live in one contract, so this touches two systems:
 *   - WETH pool + LP pool are both MasterChef pools; their split is their allocPoint ratio,
 *     and their combined rate is the farm-wide `rewardPerSecond`. So: farm-wide = 0.007
 *     (= 0.001 + 0.006), allocPoints 100 : 600.
 *   - FLX-FLX is a separate pre-funded WethStakingRewards pool. Its rate isn't an allocPoint —
 *     it's a consequence of funding, so we top it up to 0.003/sec via notifyRewardAmount.
 *     That means it only holds the 30% share as a snapshot and needs periodic re-funding,
 *     unlike the two farm pools whose ratio is permanent.
 *
 * Run with DRY=1 to print current state and the planned top-up without sending any tx.
 */
const MASTERCHEF = "0x92448e5eC14b969EC0960aa418295dE7a97De417";
const FLX = "0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e";
const FLX_STAKE = "0x8F02f6B7A05095B43ee2cb64085CAcc578a53CC1";

const FARM_WIDE_RATE = ethers.parseEther("0.007"); // WETH 0.001 + LP 0.006
const ALLOC_WETH = 100n;
const ALLOC_LP = 600n;
const FLX_FLX_TARGET_RATE = ethers.parseEther("0.003");

const fmt = (v: bigint) => ethers.formatEther(v);

async function main() {
  const [deployer] = await ethers.getSigners();
  const chef = await ethers.getContractAt("MasterChef", MASTERCHEF);
  const flx = await ethers.getContractAt("RewardToken", FLX);
  const flxStake = await ethers.getContractAt("WethStakingRewards", FLX_STAKE);

  const p0 = await chef.poolInfo(0);
  const p1 = await chef.poolInfo(1);
  console.log("BEFORE");
  console.log(`  farm rewardPerSecond: ${fmt(await chef.rewardPerSecond())} FLX/sec`);
  console.log(`  allocPoint WETH/LP:   ${p0.allocPoint} / ${p1.allocPoint}  (total ${await chef.totalAllocPoint()})`);
  console.log(`  FLX-FLX rate:         ${fmt(await flxStake.rewardRate())} FLX/sec`);

  // Compute the FLX-FLX top-up up front so DRY can preview it.
  const duration = await flxStake.rewardsDuration();
  const periodFinish = await flxStake.periodFinish();
  const currentRate = await flxStake.rewardRate();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const leftover = now >= periodFinish ? 0n : (periodFinish - now) * currentRate;
  const topUp = FLX_FLX_TARGET_RATE * duration - leftover;
  if (topUp <= 0n) {
    throw new Error("Target FLX-FLX rate is below what's already committed; can only raise mid-period.");
  }
  const flxBalance = await flx.balanceOf(deployer.address);
  const toMint = topUp > flxBalance ? topUp - flxBalance : 0n;

  console.log("\nPLAN");
  console.log(`  farm-wide -> ${fmt(FARM_WIDE_RATE)} FLX/sec, alloc ${ALLOC_WETH}:${ALLOC_LP} (WETH 10% / LP 60% of total)`);
  console.log(`  FLX-FLX top-up: ${fmt(topUp)} FLX  (mint ${fmt(toMint)}, wallet already holds ${fmt(flxBalance)})`);

  if (process.env.DRY === "1") {
    console.log("\nDRY run — no transactions sent.");
    return;
  }

  console.log("\nExecuting...");
  await (await chef.updateEmissionRate(FARM_WIDE_RATE)).wait();
  console.log("  farm-wide rate set");
  await (await chef.set(0, ALLOC_WETH, true)).wait();
  console.log("  WETH pool allocPoint set");
  await (await chef.set(1, ALLOC_LP, true)).wait();
  console.log("  LP pool allocPoint set");

  if (toMint > 0n) {
    await (await chef.ownerMint(deployer.address, toMint)).wait();
    console.log(`  minted ${fmt(toMint)} FLX`);
  }
  await (await flx.approve(FLX_STAKE, topUp)).wait();
  await (await flxStake.notifyRewardAmount(topUp)).wait();
  console.log("  FLX-FLX funded");

  // --- after ---
  const a0 = await chef.poolInfo(0);
  const a1 = await chef.poolInfo(1);
  const totalAlloc = await chef.totalAllocPoint();
  const farmRate = await chef.rewardPerSecond();
  const wethPoolRate = (farmRate * a0.allocPoint) / totalAlloc;
  const lpPoolRate = (farmRate * a1.allocPoint) / totalAlloc;
  console.log("\nAFTER");
  console.log(`  farm-wide:  ${fmt(farmRate)} FLX/sec`);
  console.log(`  WETH pool:  ${fmt(wethPoolRate)} FLX/sec  (alloc ${a0.allocPoint}/${totalAlloc})`);
  console.log(`  LP pool:    ${fmt(lpPoolRate)} FLX/sec  (alloc ${a1.allocPoint}/${totalAlloc})`);
  console.log(`  FLX-FLX:    ${fmt(await flxStake.rewardRate())} FLX/sec`);
  console.log(`  FLX supply: ${fmt(await flx.totalSupply())}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
