import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const wethAddress = process.env.WETH_ADDRESS;
  const rewardsTokenAddress = process.env.REWARDS_TOKEN_ADDRESS;

  if (!wethAddress || !rewardsTokenAddress) {
    throw new Error(
      "Set WETH_ADDRESS and REWARDS_TOKEN_ADDRESS in packages/contracts/.env before deploying"
    );
  }

  const Staking = await ethers.getContractFactory("WethStakingRewards");
  const staking = await Staking.deploy(wethAddress, rewardsTokenAddress, deployer.address);
  await staking.waitForDeployment();

  const address = await staking.getAddress();
  console.log("WethStakingRewards deployed to:", address);
  console.log("\nNext steps:");
  console.log(`1. Copy this address into NEXT_PUBLIC_STAKING_ADDRESS in packages/web/.env.local`);
  console.log(`2. Fund rewards: rewardsToken.approve(${address}, amount) then staking.notifyRewardAmount(amount)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
