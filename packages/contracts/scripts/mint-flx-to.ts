import { ethers } from "hardhat";

/**
 * Mints FLX to an address via MasterChef.ownerMint (the only FLX minter). Handy for topping up
 * a test wallet so it can add liquidity / try flows that need FLX on hand.
 *
 *   TO=0x... AMOUNT=10000 npx hardhat run scripts/mint-flx-to.ts --network robinhoodTestnet
 */
const MASTERCHEF = "0x92448e5eC14b969EC0960aa418295dE7a97De417";
const FLX = "0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e";

async function main() {
  const to = process.env.TO;
  const amountStr = process.env.AMOUNT;
  if (!to || !amountStr) throw new Error("Set TO and AMOUNT (e.g. TO=0x.. AMOUNT=10000)");

  const amount = ethers.parseEther(amountStr);
  const chef = await ethers.getContractAt("MasterChef", MASTERCHEF);
  const flx = await ethers.getContractAt("RewardToken", FLX);

  const before = await flx.balanceOf(to);
  console.log(`Minting ${amountStr} FLX to ${to} ...`);
  await (await chef.ownerMint(to, amount)).wait();
  const after = await flx.balanceOf(to);

  console.log(`  balance: ${ethers.formatEther(before)} -> ${ethers.formatEther(after)} FLX`);
  console.log(`  new total supply: ${ethers.formatEther(await flx.totalSupply())} FLX`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
