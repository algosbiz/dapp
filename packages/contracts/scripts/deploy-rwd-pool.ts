import { ethers } from "hardhat";

/**
 * Deploys a second WethStakingRewards instance for the "RWD for RWD" pool: stake RWD,
 * earn more RWD. Same contract as the WETH staking pool, just pointed at the farm's
 * RewardToken on both sides instead of WETH.
 *
 * This is a pre-funded model (like /stake), NOT mint-on-demand like MasterChef — so there's
 * no risk of comingling with MasterChef's own RWD balance. Fund it after deploying via
 * MasterChef.ownerMint() + notifyRewardAmount() (see console output below).
 *
 * Env:
 *   RWD_TOKEN_ADDRESS  required — the MasterChef farm's RewardToken (RWD) address,
 *                      NOT the same as REWARDS_TOKEN_ADDRESS (that's tRWD, used by /stake)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const rwdAddress = process.env.RWD_TOKEN_ADDRESS;
  if (!rwdAddress) {
    throw new Error("Set RWD_TOKEN_ADDRESS in packages/contracts/.env before deploying");
  }

  const Staking = await ethers.getContractFactory("WethStakingRewards");
  const staking = await Staking.deploy(rwdAddress, rwdAddress, deployer.address);
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log("RWD-for-RWD pool (WethStakingRewards) deployed to:", address);
  console.log("\nNext steps:");
  console.log(`1. Copy this address into NEXT_PUBLIC_RWD_STAKING_ADDRESS in packages/web/.env.local`);
  console.log("2. Fund it (MasterChef is the only RWD minter, so mint via the farm first):");
  console.log(`   masterChef.ownerMint("${deployer.address}", amount)`);
  console.log(`   rwd.approve("${address}", amount)`);
  console.log(`   pool.notifyRewardAmount(amount)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
