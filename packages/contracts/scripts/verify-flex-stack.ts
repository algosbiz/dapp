import { ethers } from "hardhat";

/** End-to-end sanity check of the freshly deployed FLEX stack before the app is pointed at it. */
const A = {
  weth: "0x7943e237c7F95DA44E0301572D358911207852Fa",
  flex: "0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e",
  chef: "0x92448e5eC14b969EC0960aa418295dE7a97De417",
  pool: "0x83715727e023FFb88847B02d98d39f63eD8eb09e",
  stakeFlex: "0x8F02f6B7A05095B43ee2cb64085CAcc578a53CC1",
  tflex: "0xC77b859Ac99fB812386BE76e51dEf57774785ef9",
  stakeWeth: "0x85a2C8703611C68f5c2571428837d56Fb4bbbccD",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const flex = await ethers.getContractAt("RewardToken", A.flex);
  const tflex = await ethers.getContractAt("TestnetRewardToken", A.tflex);
  const chef = await ethers.getContractAt("MasterChef", A.chef);
  const pool = await ethers.getContractAt("WethRwdPool", A.pool);
  const stakeFlex = await ethers.getContractAt("WethStakingRewards", A.stakeFlex);
  const stakeWeth = await ethers.getContractAt("WethStakingRewards", A.stakeWeth);

  console.log("TOKENS");
  console.log(`  FLEX      ${await flex.name()} (${await flex.symbol()}) supply=${ethers.formatEther(await flex.totalSupply())}`);
  console.log(`  tFLX      ${await tflex.name()} (${await tflex.symbol()})`);
  console.log(`  LP        ${await pool.name()} (${await pool.symbol()})`);

  console.log("\nFARM");
  console.log(`  minter is MasterChef: ${(await flex.owner()) === A.chef}`);
  console.log(`  rewardPerSecond: ${ethers.formatEther(await chef.rewardPerSecond())} FLX/sec`);
  console.log(`  pools: ${await chef.poolLength()}  totalAllocPoint: ${await chef.totalAllocPoint()}`);

  console.log("\nAMM POOL");
  const [r0, r1] = await pool.getReserves();
  console.log(`  reserves: ${ethers.formatEther(r0)} WETH / ${ethers.formatEther(r1)} FLX`);
  console.log(`  price: 1 WETH = ${ethers.formatEther((r1 * 10n ** 18n) / r0)} FLX`);
  console.log(`  founding LP locked: deployerLP=${await pool.balanceOf(deployer.address)} totalSupply=${await pool.totalSupply()} (1000 = dead-address minimum only)`);

  console.log("\nSTAKING POOLS");
  console.log(`  Stake FLX: rate=${ethers.formatEther(await stakeFlex.rewardRate())}/sec  staked=${ethers.formatEther(await stakeFlex.totalSupply())}`);
  console.log(`  Stake WETH: rate=${ethers.formatEther(await stakeWeth.rewardRate())}/sec  staked=${ethers.formatEther(await stakeWeth.totalSupply())}`);

  console.log(`\nGas left: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
