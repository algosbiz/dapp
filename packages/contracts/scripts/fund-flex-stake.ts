import { ethers } from "hardhat";

/**
 * Funds the FLX-for-FLX staking pool. It's a pre-funded (Synthetix-style) pool, so the
 * reward rate is a *consequence* of how much you deposit over `rewardsDuration` rather
 * than something you set directly — deposit `amount`, and the contract derives
 * rate = amount / duration and enforces it can actually cover that from its balance.
 *
 * FLX can only be created by the MasterChef, so the tokens are minted through
 * `ownerMint` first rather than by the token contract directly.
 */
const FUND_AMOUNT = ethers.parseEther("700");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chefAddress = process.env.MASTERCHEF_ADDRESS!;
  const flexAddress = process.env.RWD_TOKEN_ADDRESS!;
  const poolAddress = process.env.STAKE_POOL_ADDRESS!;
  if (!chefAddress || !flexAddress || !poolAddress) {
    throw new Error("Need MASTERCHEF_ADDRESS, RWD_TOKEN_ADDRESS, STAKE_POOL_ADDRESS");
  }

  const chef = await ethers.getContractAt("MasterChef", chefAddress);
  const flex = await ethers.getContractAt("RewardToken", flexAddress);
  const pool = await ethers.getContractAt("WethStakingRewards", poolAddress);

  const balance = await flex.balanceOf(deployer.address);
  if (balance < FUND_AMOUNT) {
    console.log(`Minting ${ethers.formatEther(FUND_AMOUNT - balance)} FLX...`);
    await (await chef.ownerMint(deployer.address, FUND_AMOUNT - balance)).wait();
  }

  console.log("Approving and funding...");
  await (await flex.approve(poolAddress, FUND_AMOUNT)).wait();
  await (await pool.notifyRewardAmount(FUND_AMOUNT)).wait();

  const rate = await pool.rewardRate();
  const finish = await pool.periodFinish();
  console.log(`\nFunded ${ethers.formatEther(FUND_AMOUNT)} FLX`);
  console.log(`rewardRate:   ${ethers.formatEther(rate)} FLX/sec`);
  console.log(`periodFinish: ${new Date(Number(finish) * 1000).toISOString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
