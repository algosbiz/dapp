import { formatEther } from "viem";

/**
 * Formats a wei-denominated bigint as a human-readable token amount.
 * Returns an em dash for undefined (unloaded) values so the UI never prints "NaN".
 */
export function formatToken(value: bigint | undefined, maxFractionDigits = 4): string {
  if (value === undefined) return "—";
  return Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}
