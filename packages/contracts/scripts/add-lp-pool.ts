import { ethers } from "hardhat";

/**
 * Adds the WETH-FLEX LP token as MasterChef pool pid 1, so LPs can farm FLX on top of
 * their swap fees. allocPoint matches pid 0 (1000) for an even 50/50 emission split.
 *
 * `_withUpdate: true` settles pid 0 first — without it, pid 0's accrued rewards would be
 * recalculated against the new, larger totalAllocPoint and silently under-pay.
 */
async function main() {
  const chefAddress = process.env.MASTERCHEF_ADDRESS!;
  const lpAddress = process.env.POOL_ADDRESS!;
  if (!chefAddress || !lpAddress) throw new Error("Need MASTERCHEF_ADDRESS and POOL_ADDRESS");

  const chef = await ethers.getContractAt("MasterChef", chefAddress);
  await (await chef.add(1000, lpAddress, true)).wait();

  const length = await chef.poolLength();
  const totalAlloc = await chef.totalAllocPoint();
  console.log(`Pools now: ${length} (expect 2)`);
  console.log(`totalAllocPoint: ${totalAlloc} (expect 2000)`);
  for (let pid = 0n; pid < length; pid += 1n) {
    const info = await chef.poolInfo(pid);
    console.log(`  pid ${pid}: token=${info[0]} allocPoint=${info[1]}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
