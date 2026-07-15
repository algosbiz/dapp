import { ethers } from "hardhat";

/**
 * Local-only convenience script: mints WETH to the deployer, funds the reward
 * pool via notifyRewardAmount, and stakes a small amount so the frontend has
 * non-zero TVL/balances to show immediately after `npm run web:dev`.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  const wethAddress = process.env.WETH_ADDRESS;
  const rewardsTokenAddress = process.env.REWARDS_TOKEN_ADDRESS;
  const stakingAddress = process.env.STAKING_ADDRESS;

  if (!wethAddress || !rewardsTokenAddress || !stakingAddress) {
    throw new Error("Set WETH_ADDRESS, REWARDS_TOKEN_ADDRESS and STAKING_ADDRESS in .env");
  }

  const weth = await ethers.getContractAt("MockERC20", wethAddress);
  const rewardToken = await ethers.getContractAt("MockERC20", rewardsTokenAddress);
  const staking = await ethers.getContractAt("WethStakingRewards", stakingAddress);

  const rewardAmount = ethers.parseEther("700"); // 100 RWD/day over the 7-day default period
  await (await rewardToken.approve(stakingAddress, rewardAmount)).wait();
  await (await staking.notifyRewardAmount(rewardAmount)).wait();
  console.log(`Funded reward pool with ${ethers.formatEther(rewardAmount)} RWD over 7 days`);

  console.log(`Deployer WETH balance: ${ethers.formatEther(await weth.balanceOf(deployer.address))}`);
  console.log(`Deployer reward token balance: ${ethers.formatEther(await rewardToken.balanceOf(deployer.address))}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
