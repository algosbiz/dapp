import { ethers } from "hardhat";

/**
 * Deploys the MasterChef farm + its uncapped RewardToken and wires them together:
 *   1. RewardToken (owned by deployer at first)
 *   2. MasterChef (per-second emission, starting at the deploy timestamp)
 *   3. transferOwnership(RewardToken -> MasterChef) so only the farm can mint
 *   4. seed a WETH pool at pid 0
 *
 * Env:
 *   WETH_ADDRESS       required — token stakers deposit into pid 0
 *   REWARD_PER_SECOND  optional — RWD minted per second (default "0.01")
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const wethAddress = process.env.WETH_ADDRESS;
  if (!wethAddress) {
    throw new Error("Set WETH_ADDRESS in packages/contracts/.env before deploying");
  }
  const rewardPerSecond = ethers.parseEther(process.env.REWARD_PER_SECOND || "0.01");

  const RewardToken = await ethers.getContractFactory("RewardToken");
  const reward = await RewardToken.deploy(deployer.address);
  await reward.waitForDeployment();
  const rewardAddress = await reward.getAddress();

  const MasterChef = await ethers.getContractFactory("MasterChef");
  // startTimestamp 0 → the constructor uses block.timestamp at deploy.
  const chef = await MasterChef.deploy(rewardAddress, rewardPerSecond, 0, deployer.address);
  await chef.waitForDeployment();
  const chefAddress = await chef.getAddress();

  // Hand minting rights to the farm — from here only MasterChef can create RWD.
  await (await reward.transferOwnership(chefAddress)).wait();

  // Seed the WETH pool (pid 0, allocPoint 1000).
  await (await chef.add(1000, wethAddress, false)).wait();

  console.log("RewardToken (RWD) deployed to:", rewardAddress);
  console.log("MasterChef deployed to:       ", chefAddress);
  console.log("WETH pool added at pid 0 (allocPoint 1000)");
  console.log("rewardPerSecond:", ethers.formatEther(rewardPerSecond), "RWD/sec");
  console.log("\nNext steps:");
  console.log("1. RewardToken ownership is now the MasterChef — it is the sole minter.");
  console.log(`2. Stakers: weth.approve(${chefAddress}, amount) then masterChef.deposit(0, amount).`);
  console.log("3. Add more pools any time with masterChef.add(allocPoint, lpToken, true).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
