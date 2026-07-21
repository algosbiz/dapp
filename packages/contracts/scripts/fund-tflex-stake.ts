import { ethers } from "hardhat";

/**
 * Funds the WETH -> tFLX staking pool. Unlike the FLX pool, tFLX mints its whole supply to
 * the deployer at construction, so this is just approve + notify — no minting step.
 */
const FUND_AMOUNT = ethers.parseEther("700");

async function main() {
  const tokenAddress = process.env.TFLEX_ADDRESS!;
  const poolAddress = process.env.STAKE_POOL_ADDRESS!;
  if (!tokenAddress || !poolAddress) throw new Error("Need TFLEX_ADDRESS and STAKE_POOL_ADDRESS");

  const token = await ethers.getContractAt("TestnetRewardToken", tokenAddress);
  const pool = await ethers.getContractAt("WethStakingRewards", poolAddress);

  console.log(`Token: ${await token.name()} (${await token.symbol()})`);
  await (await token.approve(poolAddress, FUND_AMOUNT)).wait();
  await (await pool.notifyRewardAmount(FUND_AMOUNT)).wait();

  const rate = await pool.rewardRate();
  const finish = await pool.periodFinish();
  console.log(`\nFunded ${ethers.formatEther(FUND_AMOUNT)} tFLX`);
  console.log(`rewardRate:   ${ethers.formatEther(rate)} tFLX/sec`);
  console.log(`periodFinish: ${new Date(Number(finish) * 1000).toISOString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
