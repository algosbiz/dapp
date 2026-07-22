import { ethers } from "hardhat";

/**
 * Diagnoses "I added liquidity, tx succeeded, but LP balance shows 0."
 * Checks the boss's wallet against BOTH the current FLEX pool and the dead RWD pool, plus
 * whether any liquidity has been added to the FLEX pool since founding.
 */
const BOSS = "0xB2FE805A538E05a79a5a37AEc093D0b2a79233e9";

const FLEX_POOL = "0x83715727e023FFb88847B02d98d39f63eD8eb09e"; // current, WETH-FLEX-LP
const RWD_POOL = "0x6b9929D2cb7037C2d637cDb01540384a1aE00B4c"; // dead, WETH-RWD-LP
const FLX = "0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e";
const WETH = "0x7943e237c7F95DA44E0301572D358911207852Fa";

const erc20 = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  const p = ethers.provider;
  const at = (addr: string) => new ethers.Contract(addr, erc20, p);
  const f = (v: bigint) => ethers.formatEther(v);

  console.log("Boss wallet:", BOSS, "\n");

  const weth = at(WETH);
  const flx = at(FLX);
  console.log("WALLET BALANCES");
  console.log(`  WETH: ${f(await weth.balanceOf(BOSS))}`);
  console.log(`  FLX:  ${f(await flx.balanceOf(BOSS))}   <- need >0 to add liquidity`);

  const flexPool = at(FLEX_POOL);
  console.log("\nCURRENT FLEX POOL (WETH-FLEX-LP)", FLEX_POOL);
  console.log(`  symbol:       ${await flexPool.symbol()}`);
  console.log(`  totalSupply:  ${await flexPool.totalSupply()}  (1000 = only the burned founding liquidity, nobody else has added)`);
  console.log(`  boss LP:      ${await flexPool.balanceOf(BOSS)}`);

  const rwdPool = at(RWD_POOL);
  console.log("\nOLD RWD POOL (dead)", RWD_POOL);
  console.log(`  symbol:       ${await rwdPool.symbol()}`);
  console.log(`  boss LP:      ${await rwdPool.balanceOf(BOSS)}  (any LP here is from before the FLEX rename)`);

  // Any LiquidityAdded events on the FLEX pool at all? Scan a wide recent window.
  const current = await p.getBlockNumber();
  const iface = new ethers.Interface([
    "event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity)",
  ]);
  const topic = iface.getEvent("LiquidityAdded")!.topicHash;
  const from = current - 200000 > 0 ? current - 200000 : 0;
  console.log(`\nLiquidityAdded events on FLEX pool, blocks ${from}..${current}:`);
  try {
    const logs = await p.getLogs({ address: FLEX_POOL, topics: [topic], fromBlock: from, toBlock: current });
    if (logs.length === 0) {
      console.log("  none — no addLiquidity has landed on this pool since founding.");
    } else {
      for (const log of logs) {
        const d = iface.parseLog(log)!;
        console.log(`  block ${log.blockNumber}: provider ${d.args.provider} liquidity ${d.args.liquidity} (tx ${log.transactionHash})`);
      }
    }
  } catch (e) {
    console.log("  (event scan failed — RPC archive limit; skip)", (e as Error).message.slice(0, 80));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
