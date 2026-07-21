import { ethers } from "hardhat";

/**
 * Seeds the fresh WETH/FLEX AMM pool and permanently locks the founding liquidity.
 *
 * Deliberately seeded thicker than the previous generation's pool: that one was left so thin
 * (~0.0000001 WETH) that genuine swap outputs rounded to "0" in the UI and needed adaptive
 * formatters to stay honest. Starting with real depth avoids re-introducing that whole class
 * of display problem.
 *
 * The founding LP is burned at the end, which is irreversible — it's what lets the app
 * truthfully say nobody, including the team, can withdraw the founding liquidity.
 */
const WETH_AMOUNT = ethers.parseEther("0.001");
const FLEX_AMOUNT = ethers.parseEther("10000");

async function main() {
  const [deployer] = await ethers.getSigners();
  const wethAddress = process.env.WETH_ADDRESS!;
  const flexAddress = process.env.RWD_TOKEN_ADDRESS!;
  const poolAddress = process.env.POOL_ADDRESS!;
  const chefAddress = process.env.MASTERCHEF_ADDRESS!;

  if (!wethAddress || !flexAddress || !poolAddress || !chefAddress) {
    throw new Error("Need WETH_ADDRESS, RWD_TOKEN_ADDRESS, POOL_ADDRESS, MASTERCHEF_ADDRESS");
  }

  const weth = await ethers.getContractAt(
    ["function deposit() payable", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    wethAddress
  );
  const flex = await ethers.getContractAt("RewardToken", flexAddress);
  const chef = await ethers.getContractAt("MasterChef", chefAddress);
  const pool = await ethers.getContractAt("WethRwdPool", poolAddress);

  // 1. Wrap ETH so the deployer has a WETH side to contribute.
  const wethBalance = await weth.balanceOf(deployer.address);
  if (wethBalance < WETH_AMOUNT) {
    const shortfall = WETH_AMOUNT - wethBalance;
    console.log(`Wrapping ${ethers.formatEther(shortfall)} ETH -> WETH...`);
    await (await weth.deposit({ value: shortfall })).wait();
  }

  // 2. Mint the FLEX side. MasterChef is the sole minter, so it has to come through ownerMint.
  const flexBalance = await flex.balanceOf(deployer.address);
  if (flexBalance < FLEX_AMOUNT) {
    console.log(`Minting ${ethers.formatEther(FLEX_AMOUNT - flexBalance)} FLX...`);
    await (await chef.ownerMint(deployer.address, FLEX_AMOUNT - flexBalance)).wait();
  }

  // 3. Approve both sides.
  console.log("Approving pool for both tokens...");
  await (await weth.approve(poolAddress, WETH_AMOUNT)).wait();
  await (await flex.approve(poolAddress, FLEX_AMOUNT)).wait();

  // 4. Seed. Mins are 0 because an empty pool has no ratio to slip against.
  console.log("Adding founding liquidity...");
  await (await pool.addLiquidity(WETH_AMOUNT, FLEX_AMOUNT, 0, 0)).wait();

  const [reserve0, reserve1] = await pool.getReserves();
  const lp = await pool.balanceOf(deployer.address);
  console.log(`Reserves: ${ethers.formatEther(reserve0)} WETH / ${ethers.formatEther(reserve1)} FLX`);
  console.log(`LP minted to deployer: ${ethers.formatEther(lp)}`);

  // 5. Burn the founding LP — irreversible, and the reason the pool can be called locked.
  if (lp > 0n) {
    console.log("Burning founding LP (permanent)...");
    await (await pool.burn(lp)).wait();
  }

  const lpAfter = await pool.balanceOf(deployer.address);
  const totalSupply = await pool.totalSupply();
  console.log(`\nDeployer LP after burn: ${lpAfter} (want 0)`);
  console.log(`Pool LP totalSupply:    ${totalSupply} (want 1000 = MINIMUM_LIQUIDITY at dead address)`);
  console.log(`Price: 1 WETH = ${ethers.formatEther((reserve1 * 10n ** 18n) / reserve0)} FLX`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
