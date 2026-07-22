import { ethers } from "hardhat";

/**
 * Full redeploy for the capped/burnable FLX token + the LockedStaking feature.
 *
 * Only the FLX-touching contracts are redeployed. The WETH→tFLX stake pool and the tFLX token
 * are deliberately KEPT — they never reference FLX, so the token change doesn't affect them.
 *
 * The 10/60/30 emission split is baked in at deploy: farm-wide 0.007/sec with allocPoints
 * 100 (WETH) : 600 (LP) gives WETH 0.001 / LP 0.006, and the FLX-FLX pool is funded to 0.003 —
 * total 0.01 FLX/sec, split 10/60/30. No separate split step needed.
 *
 * Prints each address as it lands, so a mid-run gas-out is recoverable.
 */
const WETH = "0x7943e237c7F95DA44E0301572D358911207852Fa";
const BOSS = "0xB2FE805A538E05a79a5a37AEc093D0b2a79233e9";

const FOUNDING_WETH = ethers.parseEther("0.0003");
const FOUNDING_FLX = ethers.parseEther("3000"); // keeps 1 WETH = 10M FLX
const BOSS_MINT = ethers.parseEther("10000");
const LOCKED_BUDGET = ethers.parseEther("20000");

const FARM_WIDE_RATE = ethers.parseEther("0.007"); // WETH 0.001 + LP 0.006
const ALLOC_WETH = 100n;
const ALLOC_LP = 600n;
const FLX_FLX_RATE = ethers.parseEther("0.003");

const f = (v: bigint) => ethers.formatEther(v);

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("ETH:", f(await ethers.provider.getBalance(deployer.address)), "\n");

  // 1. FLX token (capped 10M + burnable)
  const flx = await (await ethers.getContractFactory("RewardToken")).deploy(deployer.address);
  await flx.waitForDeployment();
  const flxAddr = await flx.getAddress();
  console.log("FLX token:      ", flxAddr);

  // 2. MasterChef at the farm-wide rate, WETH pool at allocPoint 100 (= 10% of total emission)
  const chef = await (await ethers.getContractFactory("MasterChef")).deploy(
    flxAddr,
    FARM_WIDE_RATE,
    0,
    deployer.address
  );
  await chef.waitForDeployment();
  const chefAddr = await chef.getAddress();
  await (await flx.transferOwnership(chefAddr)).wait();
  await (await chef.add(ALLOC_WETH, WETH, false)).wait();
  console.log("MasterChef:     ", chefAddr);

  // 3. AMM pool, seeded and founding LP burned
  const pool = await (await ethers.getContractFactory("WethRwdPool")).deploy(WETH, flxAddr, deployer.address);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("WethRwdPool:    ", poolAddr);

  const weth = await ethers.getContractAt(
    ["function deposit() payable", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    WETH
  );
  await (await weth.deposit({ value: FOUNDING_WETH })).wait();
  await (await chef.ownerMint(deployer.address, FOUNDING_FLX)).wait();
  await (await weth.approve(poolAddr, FOUNDING_WETH)).wait();
  await (await flx.approve(poolAddr, FOUNDING_FLX)).wait();
  await (await pool.addLiquidity(FOUNDING_WETH, FOUNDING_FLX, 0, 0)).wait();
  const lp = await pool.balanceOf(deployer.address);
  if (lp > 0n) await (await pool.burn(lp)).wait();
  const [r0, r1] = await pool.getReserves();
  console.log(`  seeded ${f(r0)} WETH / ${f(r1)} FLX, founding LP burned (LP left ${await pool.balanceOf(deployer.address)})`);

  // 4. LP farm pool at allocPoint 600 (= 60%); withUpdate settles pid 0 first
  await (await chef.add(ALLOC_LP, poolAddr, true)).wait();
  console.log("  LP pool added at pid 1");

  // 5. Stake-FLX pool, funded to 0.003/sec (fresh pool → reward = rate × duration)
  const stakeFlx = await (await ethers.getContractFactory("WethStakingRewards")).deploy(flxAddr, flxAddr, deployer.address);
  await stakeFlx.waitForDeployment();
  const stakeFlxAddr = await stakeFlx.getAddress();
  console.log("Stake-FLX pool: ", stakeFlxAddr);
  const duration = await stakeFlx.rewardsDuration();
  const flxFlxFund = FLX_FLX_RATE * duration;
  await (await chef.ownerMint(deployer.address, flxFlxFund)).wait();
  await (await flx.approve(stakeFlxAddr, flxFlxFund)).wait();
  await (await stakeFlx.notifyRewardAmount(flxFlxFund)).wait();
  console.log(`  funded ${f(flxFlxFund)} FLX → rate ${f(await stakeFlx.rewardRate())} FLX/sec`);

  // 6. LockedStaking, reward budget funded
  const locked = await (await ethers.getContractFactory("LockedStaking")).deploy(flxAddr, deployer.address);
  await locked.waitForDeployment();
  const lockedAddr = await locked.getAddress();
  console.log("LockedStaking:  ", lockedAddr);
  await (await chef.ownerMint(deployer.address, LOCKED_BUDGET)).wait();
  await (await flx.approve(lockedAddr, LOCKED_BUDGET)).wait();
  await (await locked.fundRewards(LOCKED_BUDGET)).wait();
  console.log(`  funded reward budget ${f(await locked.rewardBudget())} FLX`);

  // 7. Top up the boss's test wallet
  await (await chef.ownerMint(BOSS, BOSS_MINT)).wait();
  console.log(`  minted ${f(BOSS_MINT)} FLX to boss`);

  // Summary
  const totalAlloc = await chef.totalAllocPoint();
  const rate = await chef.rewardPerSecond();
  console.log("\n=== EMISSION (baked-in 10/60/30) ===");
  console.log(`  farm-wide ${f(rate)} | WETH ${f((rate * ALLOC_WETH) / totalAlloc)} | LP ${f((rate * ALLOC_LP) / totalAlloc)} | FLX-FLX ${f(await stakeFlx.rewardRate())}`);
  console.log(`  FLX totalSupply: ${f(await flx.totalSupply())} / cap ${f(await flx.cap())}`);
  console.log(`  gas left: ${f(await ethers.provider.getBalance(deployer.address))} ETH`);

  console.log("\n=== ENV (packages/web/.env.local) ===");
  console.log(`NEXT_PUBLIC_MASTERCHEF_ADDRESS=${chefAddr}`);
  console.log(`NEXT_PUBLIC_RWD_TOKEN_ADDRESS=${flxAddr}`);
  console.log(`NEXT_PUBLIC_RWD_STAKING_ADDRESS=${stakeFlxAddr}`);
  console.log(`NEXT_PUBLIC_WETH_RWD_POOL_ADDRESS=${poolAddr}`);
  console.log(`NEXT_PUBLIC_LOCKED_STAKING_ADDRESS=${lockedAddr}`);
  console.log("(STAKING_ADDRESS and REWARD_TOKEN_ADDRESS unchanged — tFLX stake pool kept.)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
