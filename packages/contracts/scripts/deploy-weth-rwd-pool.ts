import { ethers } from "hardhat";

/**
 * Deploys the WETH/RWD constant-product AMM pool (WethRwdPool). Deploys ONLY the
 * contract — deliberately does not auto-seed liquidity or burn the founding LP, since
 * that burn is irreversible and moves real capital. Do those as separate, deliberate
 * follow-up transactions once reserves have been verified.
 *
 * Env:
 *   WETH_ADDRESS       required — token0
 *   RWD_TOKEN_ADDRESS  required — token1 (the MasterChef farm's RewardToken)
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const wethAddress = process.env.WETH_ADDRESS;
  const rwdAddress = process.env.RWD_TOKEN_ADDRESS;
  if (!wethAddress || !rwdAddress) {
    throw new Error("Set WETH_ADDRESS and RWD_TOKEN_ADDRESS in packages/contracts/.env before deploying");
  }

  const Pool = await ethers.getContractFactory("WethRwdPool");
  const pool = await Pool.deploy(wethAddress, rwdAddress, deployer.address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();

  console.log("WethRwdPool deployed to:", poolAddress);
  console.log("\nNext steps:");
  console.log(`1. Copy this address into NEXT_PUBLIC_WETH_RWD_POOL_ADDRESS in packages/web/.env.local`);
  console.log("2. Approve both tokens for the founding deposit, e.g.:");
  console.log(`     weth.approve("${poolAddress}", amount0)`);
  console.log(`     rwd.approve("${poolAddress}", amount1)`);
  console.log("3. Seed founding liquidity (mints LP to you):");
  console.log(`     pool.addLiquidity(amount0, amount1, amount0Min, amount1Min)`);
  console.log("4. Verify reserves look right: pool.getReserves()");
  console.log("5. PERMANENTLY LOCK founding liquidity (irreversible — double check first):");
  console.log(`     pool.burn(await pool.balanceOf("${deployer.address}"))`);
  console.log("6. Verify the lock: balanceOf(you) == 0, totalSupply() == MINIMUM_LIQUIDITY (1000)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
