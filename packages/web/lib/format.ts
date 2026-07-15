import { formatEther } from "viem";

/**
 * Formats a wei-denominated bigint as a human-readable token amount.
 * Returns an em dash for undefined (unloaded) values so the UI never prints "NaN".
 */
export function formatToken(value: bigint | undefined, maxFractionDigits = 4): string {
  if (value === undefined) return "—";
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

/**
 * Adaptive formatting for values that can span extreme magnitudes — e.g. a pool reserve
 * or spot price after a lopsided trade, where a fixed 4-decimal format either shows a
 * misleading "0" for a real (tiny) nonzero balance, or an unwieldy 8-digit number for a
 * spot price that's spiked. Falls back to formatToken's fixed-decimal behavior for
 * ordinary-sized values.
 */
export function formatTokenSmart(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const num = Number(formatEther(value));
  if (num === 0) return "0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return num.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
  }
  if (abs < 0.0001) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 10 });
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
