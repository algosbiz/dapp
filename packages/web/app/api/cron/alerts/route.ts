/**
 * Security and activity alerts — scans recent blocks for events that mean somebody changed
 * the protocol, and pushes them to Telegram.
 *
 * This is the half of the bot that answers "how do I know nobody is messing with my
 * contracts?" without anyone having to be trusted: if an owner-only action fires, the phone
 * buzzes within minutes, with the transaction hash to check.
 *
 * ## Why a lookback window instead of a cursor
 *
 * The right design is to remember the last block scanned and resume from it. Serverless has
 * nowhere to write that: the filesystem is read-only and there's no database in this project.
 * So each run scans a fixed window ending at the chain head, and the window is deliberately
 * LONGER than the cron interval (15 min window, 10 min cadence).
 *
 * That overlap means a rare duplicate alert around the boundary. That is the intended trade:
 * for a security alert, seeing it twice is a minor annoyance, while missing it entirely
 * defeats the point. If duplicates ever become a nuisance, the fix is a KV store for the
 * cursor — not a shorter window.
 */

import { NextResponse } from "next/server";
import { formatEther, parseAbiItem } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { blockNumberSecondsAgo, botClient } from "@/lib/botMetrics";
import { buildAlert } from "@/lib/botFormat";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";
import { cronIsUnprotected, isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_SECONDS = 15 * 60;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Human names for the addresses, so an alert doesn't just say "0x7b87…". */
function contractLabels(): Record<string, string> {
  const entries: [string, string][] = [
    [CONTRACTS.masterChef, "MasterChef (farm)"],
    [CONTRACTS.lockedStaking, "LockedStaking"],
    [CONTRACTS.rwdStaking, "FLX→FLX staking"],
    [CONTRACTS.stakingRewards, "WETH staking"],
    [CONTRACTS.wethRwdPool, "WETH/FLX pool"],
    [CONTRACTS.rwdToken, "FLX token"],
  ];
  return Object.fromEntries(entries.map(([addr, name]) => [addr.toLowerCase(), name]));
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry") === "1";
  // Widen the window for a manual sweep, e.g. ?lookback=86400 to review the last day.
  const lookback = Number(url.searchParams.get("lookback") ?? LOOKBACK_SECONDS);

  try {
    const client = botClient();
    const latest = await client.getBlock();
    const toBlock = latest.number ?? 0n;
    const fromBlock = await blockNumberSecondsAgo(client, latest, lookback);

    const labels = contractLabels();
    const watched = Object.keys(labels) as `0x${string}`[];

    const [ownership, emission, poolSet, mints, earlyExits] = await Promise.all([
      client.getLogs({
        address: watched,
        event: parseAbiItem(
          "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
        ),
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: CONTRACTS.masterChef,
        event: parseAbiItem("event EmissionRateUpdated(uint256 rewardPerSecond)"),
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: CONTRACTS.masterChef,
        event: parseAbiItem("event PoolSet(uint256 indexed pid, uint256 allocPoint)"),
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: CONTRACTS.masterChef,
        event: parseAbiItem("event OwnerMint(address indexed to, uint256 amount)"),
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: CONTRACTS.lockedStaking,
        event: parseAbiItem(
          "event EarlyWithdrawn(address indexed user, uint256 indexed positionId, uint256 returned, uint256 burned)"
        ),
        fromBlock,
        toBlock,
      }),
    ]);

    const alerts: string[] = [];

    for (const log of ownership) {
      const a = log.args as { previousOwner?: string; newOwner?: string };
      const label = labels[log.address.toLowerCase()] ?? shortAddr(log.address);

      // Every OpenZeppelin Ownable constructor emits OwnershipTransferred(0x0 -> initialOwner).
      // Treating that as a takeover means a single redeploy fires six red alarms saying "act
      // now" about contracts that were just created — and alert fatigue is exactly how the one
      // real alert gets scrolled past. Deployment is reported, but calmly.
      const isDeployment = (a.previousOwner ?? "").toLowerCase() === ZERO_ADDRESS;

      alerts.push(
        isDeployment
          ? buildAlert(
              `🆕 <b>Contract deployed</b>`,
              [`Contract: ${label}`, `Initial owner: <code>${a.newOwner ?? "?"}</code>`],
              log.transactionHash ?? undefined
            )
          : buildAlert(
              `🚨 <b>OWNERSHIP TRANSFERRED</b>`,
              [
                `Contract: ${label}`,
                `From: <code>${a.previousOwner ?? "?"}</code>`,
                `To: <code>${a.newOwner ?? "?"}</code>`,
                ``,
                `<b>If you did not authorise this, act now.</b>`,
              ],
              log.transactionHash ?? undefined
            )
      );
    }

    for (const log of emission) {
      const a = log.args as { rewardPerSecond?: bigint };
      alerts.push(
        buildAlert(
          `⚠️ <b>Emission rate changed</b>`,
          [`New farm-wide rate: ${formatEther(a.rewardPerSecond ?? 0n)} FLX/sec`],
          log.transactionHash ?? undefined
        )
      );
    }

    for (const log of poolSet) {
      const a = log.args as { pid?: bigint; allocPoint?: bigint };
      alerts.push(
        buildAlert(
          `⚠️ <b>Pool weighting changed</b>`,
          [`Pool #${a.pid ?? "?"} allocation set to ${a.allocPoint ?? "?"}`],
          log.transactionHash ?? undefined
        )
      );
    }

    for (const log of mints) {
      const a = log.args as { to?: string; amount?: bigint };
      alerts.push(
        buildAlert(
          `💰 <b>FLX minted</b>`,
          [`Amount: ${formatEther(a.amount ?? 0n)} FLX`, `To: <code>${a.to ?? "?"}</code>`],
          log.transactionHash ?? undefined
        )
      );
    }

    for (const log of earlyExits) {
      const a = log.args as { user?: string; returned?: bigint; burned?: bigint };
      alerts.push(
        buildAlert(
          `🔥 <b>Early exit — FLX burned</b>`,
          [
            `Burned: ${formatEther(a.burned ?? 0n)} FLX`,
            `Returned to staker: ${formatEther(a.returned ?? 0n)} FLX`,
            `Staker: <code>${a.user ?? "?"}</code>`,
          ],
          log.transactionHash ?? undefined
        )
      );
    }

    const scanned = { fromBlock: fromBlock.toString(), toBlock: toBlock.toString(), lookback };

    if (dryRun) return NextResponse.json({ ok: true, dryRun: true, count: alerts.length, alerts, scanned });
    if (alerts.length === 0) return NextResponse.json({ ok: true, count: 0, scanned });

    if (!isTelegramConfigured()) {
      return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN not set", count: alerts.length, alerts });
    }

    // Sent one per message rather than concatenated: each carries its own transaction link,
    // and a wall of merged alerts is easy to skim past.
    const results = await Promise.all(alerts.map((text) => sendTelegramMessage(text)));
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({
      ok: failed.length === 0,
      count: alerts.length,
      failed: failed.length,
      scanned,
      unprotected: cronIsUnprotected(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
