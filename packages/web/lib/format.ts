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

/**
 * Compact display for a WETH-denominated headline figure shown in a narrow stat tile:
 * caps at 2 decimals for ordinary values and switches to compact notation past a million,
 * so a big market cap like 2,490.38 never overflows its card. Keeps extra precision only
 * for sub-0.0001 dust (where 2 decimals would misleadingly read as "0").
 */
export function formatWethHeadline(value: bigint | undefined): string {
  if (value === undefined) return "—";
  const num = Number(formatEther(value));
  if (num === 0) return "0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return num.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
  }
  if (abs >= 1) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  // Below 1, fixed decimals lie: a 2-decimal cap turned a real 0.00107 WETH market cap into
  // a flat "0". Significant digits keep small-but-real values honest at any magnitude.
  return num.toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

/**
 * Compact "$" display for a headline USD figure in a narrow stat tile — same overflow-safe
 * shape as formatWethHeadline (2 decimals normally, compact notation past a million).
 */
export function formatUsdHeadline(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `$${value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 })}`;
  }
  if (abs < 0.01) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  }
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats a percentage value (e.g. 12.34 -> "12.34%"). Returns an em dash for undefined,
 * NaN, or non-finite values so a missing price/zero-TVL case never prints "NaN%" or "Infinity%".
 */
export function formatPercent(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}
