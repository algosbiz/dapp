import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

/**
 * Read-only snapshot of RWD total supply, appended to a JSON history file. RewardToken
 * has no burn function, so totalSupply() only ever grows — diffing snapshots over time
 * is enough to answer "how much RWD was minted this week/month" without needing to
 * index mint events.
 *
 * No signer/private key required — safe to run unattended on a schedule.
 *
 * Env:
 *   RWD_TOKEN_ADDRESS  required — the MasterChef farm's RewardToken (RWD) address
 */
const SNAPSHOT_FILE = path.join(__dirname, "..", "..", "web", "data", "rwd-supply-snapshots.json");
const MIN_INTERVAL_MS = 60 * 60 * 1000; // dedupe guard: skip if last snapshot is <1h old

type Snapshot = {
  timestamp: string;
  blockNumber: number;
  totalSupply: string;
};

async function main() {
  const rwdAddress = process.env.RWD_TOKEN_ADDRESS;
  if (!rwdAddress) {
    throw new Error("Set RWD_TOKEN_ADDRESS in packages/contracts/.env before snapshotting");
  }

  const rewardToken = await ethers.getContractAt("RewardToken", rwdAddress);
  const totalSupply: bigint = await rewardToken.totalSupply();
  const block = await ethers.provider.getBlock("latest");
  if (!block) {
    throw new Error("Could not fetch latest block");
  }

  let history: Snapshot[] = [];
  if (fs.existsSync(SNAPSHOT_FILE)) {
    history = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
  }

  const last = history[history.length - 1];
  if (last && Date.now() - new Date(last.timestamp).getTime() < MIN_INTERVAL_MS) {
    console.log("Last snapshot is less than 1h old, skipping.");
    return;
  }

  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    blockNumber: block.number,
    totalSupply: totalSupply.toString(),
  };
  history.push(snapshot);

  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(history, null, 2) + "\n");

  console.log("Snapshot recorded:", snapshot);
  console.log("Total snapshots on file:", history.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
