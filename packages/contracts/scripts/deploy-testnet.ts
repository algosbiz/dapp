import { ethers } from "hardhat";

/**
 * One-shot deploy for Robinhood Chain Testnet:
 *  1. Deploys a placeholder TestnetRewardToken (skip if REWARDS_TOKEN_ADDRESS is already set)
 *  2. Deploys WethStakingRewards wired to the real testnet WETH + the reward token
 *
 * Requires the deployer wallet (DEPLOYER_PRIVATE_KEY in .env) to hold testnet ETH for gas.
 */
const TESTNET_WETH = "0x7943e237c7F95DA44E0301572D358911207852Fa"; // official Robinhood Chain Testnet L2 WETH

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
  if (balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has 0 testnet ETH. Fund it before deploying (see README).`
    );
  }

  const wethAddress = process.env.WETH_ADDRESS || TESTNET_WETH;

  let rewardsTokenAddress = process.env.REWARDS_TOKEN_ADDRESS;
  if (!rewardsTokenAddress) {
    console.log("REWARDS_TOKEN_ADDRESS not set — deploying placeholder TestnetRewardToken...");
    const RewardToken = await ethers.getContractFactory("TestnetRewardToken");
    const rewardToken = await RewardToken.deploy(deployer.address);
    await rewardToken.waitForDeployment();
    rewardsTokenAddress = await rewardToken.getAddress();
    console.log("TestnetRewardToken deployed to:", rewardsTokenAddress);
  }

  const Staking = await ethers.getContractFactory("WethStakingRewards");
  const staking = await Staking.deploy(wethAddress, rewardsTokenAddress, deployer.address);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();

  console.log("\n=== Deployed to Robinhood Chain Testnet ===");
  console.log("WETH (official):      ", wethAddress);
  console.log("Reward token:         ", rewardsTokenAddress);
  console.log("WethStakingRewards:   ", stakingAddress);
  console.log("\nNext: paste these into packages/web/.env.local as");
  console.log(`NEXT_PUBLIC_WETH_ADDRESS=${wethAddress}`);
  console.log(`NEXT_PUBLIC_REWARD_TOKEN_ADDRESS=${rewardsTokenAddress}`);
  console.log(`NEXT_PUBLIC_STAKING_ADDRESS=${stakingAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
