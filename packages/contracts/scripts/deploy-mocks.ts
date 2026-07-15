import { ethers } from "hardhat";

/**
 * Local-only helper: deploys mock WETH + reward token so you can run the full
 * stake → notifyRewardAmount → claim flow against `hardhat node` without needing
 * real WETH. Do NOT use this script against Robinhood Chain mainnet.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
  await weth.waitForDeployment();

  const rewardToken = await MockERC20.deploy("Internal Reward Token", "RWD");
  await rewardToken.waitForDeployment();

  console.log("Mock WETH deployed to:", await weth.getAddress());
  console.log("Mock Reward Token deployed to:", await rewardToken.getAddress());
  console.log("Deployer (holds 1,000,000 of each):", deployer.address);
  console.log("\nSet these as WETH_ADDRESS / REWARDS_TOKEN_ADDRESS in .env, then run deploy.ts");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
