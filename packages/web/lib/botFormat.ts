/**
 * Message text for the Telegram bot.
 *
 * All output is ENGLISH by requirement — the person reading these reports doesn't speak
 * Indonesian, and it also matches the app's own UI language. Keep it that way.
 *
 * Formatting is Telegram HTML (see lib/telegram.ts for why not MarkdownV2). Lines are kept
 * short and left-aligned rather than column-aligned: these are read on a phone, where a wide
 * monospace block would wrap and destroy the alignment it was trying to buy.
 */

import { formatEther } from "viem";
import { formatToken, formatPercent } from "@/lib/format";
import type { BotMetrics } from "@/lib/botMetrics";

const EXPLORER = "https://explorer.testnet.chain.robinhood.com";

function flx(value: bigint, digits = 2): string {
  return `${formatToken(value, digits)} FLX`;
}

/** Rate values are tiny (0.007 FLX/sec), so they need more decimals than balances. */
function rate(value: bigint): string {
  return `${formatToken(value, 6)} FLX/sec`;
}

function pct(part: bigint, whole: bigint): string {
  if (whole === 0n) return "0%";
  return `${Math.round((Number(part) / Number(whole)) * 100)}%`;
}

function usd(value: number | null): string {
  if (value === null) return "n/a";
  // Sub-cent prices are normal for a fresh token — fixed 2 decimals would render them as $0.00.
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}`;
}

function weth(value: number | null): string {
  if (value === null) return "n/a";
  return `${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })} WETH`;
}

function utcStamp(date: Date): string {
  return `${date.toUTCString().replace("GMT", "UTC")}`;
}

/** The supply block — the headline the boss actually asked for. */
export function supplySection(m: BotMetrics): string {
  const flow = m.flow24h.available
    ? `+${formatToken(m.flow24h.minted, 2)} minted · −${formatToken(m.flow24h.burned, 2)} burned`
    : "n/a (log query unavailable)";

  return [
    `<b>SUPPLY</b>`,
    `Total: ${flx(m.flxSupply)}`,
    `Cap: ${flx(m.flxCap, 0)} (${m.capUsedPercent.toFixed(2)}% used)`,
    `Last 24h: ${flow}`,
  ].join("\n");
}

export function lockedSection(m: BotMetrics): string {
  return [
    `<b>LOCKED STAKING</b>`,
    `Locked: ${flx(m.lockedTotal)}`,
    `Reward budget left: ${flx(m.lockedRewardBudget)}`,
  ].join("\n");
}

export function emissionSection(m: BotMetrics): string {
  // Percentages are of ALL THREE pools, not of the farm alone. The agreed split is
  // 10 / 60 / 30, but the FLX→FLX pool is a separate contract funded from its own reward
  // budget, so it isn't part of MasterChef's allocPoint total. Dividing by the farm-only
  // total prints 14% / 86% and makes the split look nothing like what was agreed.
  const total = m.emissionWeth + m.emissionLp + m.emissionFlxFlx;
  return [
    `<b>EMISSION</b>`,
    `Total: ${rate(total)}`,
    `• WETH pool: ${rate(m.emissionWeth)} (${pct(m.emissionWeth, total)})`,
    `• LP pool: ${rate(m.emissionLp)} (${pct(m.emissionLp, total)})`,
    `• FLX→FLX pool: ${rate(m.emissionFlxFlx)} (${pct(m.emissionFlxFlx, total)})`,
    `<i>Farm-wide (MasterChef only): ${rate(m.emissionPerSecond)}</i>`,
  ].join("\n");
}

export function priceSection(m: BotMetrics): string {
  return [
    `<b>PRICE</b>`,
    `1 FLX = ${weth(m.wethPerFlx)} ≈ ${usd(m.usdPerFlx)}`,
    `Pool: ${formatToken(m.reserveWeth, 6)} WETH / ${flx(m.reserveFlx)}`,
    `<i>Hypothetical — priced off our own shallow testnet pool, not a real market.</i>`,
  ].join("\n");
}

export function poolsSection(m: BotMetrics): string {
  return [
    `<b>POOLS</b>`,
    `WETH farm: ${formatToken(m.farmWethTvl, 6)} WETH · APR ${formatPercent(m.aprWethPool)}`,
    `LP farm: ${formatToken(m.farmLpTvl, 6)} LP`,
    `FLX→FLX: ${flx(m.flxStakedInFlxPool)} · APR ${formatPercent(m.aprFlxPool)}`,
  ].join("\n");
}

/** The scheduled daily digest. */
export function buildDailyReport(m: BotMetrics): string {
  return [
    `📊 <b>$FLEX Daily Report</b>`,
    `<i>${utcStamp(m.timestamp)} · block ${m.blockNumber}</i>`,
    ``,
    supplySection(m),
    ``,
    lockedSection(m),
    ``,
    emissionSection(m),
    ``,
    poolsSection(m),
    ``,
    priceSection(m),
  ].join("\n");
}

/** Everything, on demand — same content as the digest, for /report. */
export const buildFullReport = buildDailyReport;

export function buildSupplyReply(m: BotMetrics): string {
  return [
    `📊 <b>$FLEX Supply</b>`,
    ``,
    supplySection(m),
    ``,
    lockedSection(m),
    ``,
    `<i>Block ${m.blockNumber} · ${utcStamp(m.timestamp)}</i>`,
  ].join("\n");
}

export function buildPriceReply(m: BotMetrics): string {
  return [`💵 <b>$FLEX Price</b>`, ``, priceSection(m)].join("\n");
}

export function buildEmissionReply(m: BotMetrics): string {
  return [`⚙️ <b>$FLEX Emission</b>`, ``, emissionSection(m), ``, poolsSection(m)].join("\n");
}

export function buildLockedReply(m: BotMetrics): string {
  return [`🔒 <b>$FLEX Locked Staking</b>`, ``, lockedSection(m)].join("\n");
}

export function buildHelpReply(): string {
  return [
    `🤖 <b>$FLEX Monitor</b>`,
    ``,
    `I read the $FLEX contracts on Robinhood Chain Testnet and report what I find.`,
    ``,
    `<b>Commands</b>`,
    `/supply — total supply, cap usage, 24h mint vs burn`,
    `/price — FLX price in WETH and USD`,
    `/emission — emission rate and the pool split`,
    `/locked — locked staking totals`,
    `/report — everything at once`,
    `/help — this message`,
    ``,
    `<i>Read-only. I cannot move funds, mint, or change any setting — those still require a wallet signature.</i>`,
  ].join("\n");
}

/** Security and activity alerts. `txHash` links to the explorer so it can be checked directly. */
export function buildAlert(title: string, lines: string[], txHash?: string): string {
  const body = [title, ``, ...lines];
  if (txHash) body.push(``, `<a href="${EXPLORER}/tx/${txHash}">View transaction</a>`);
  return body.join("\n");
}

export { formatEther };
