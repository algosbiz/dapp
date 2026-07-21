import { formatPercent } from "@/lib/format";

export const SECONDS_PER_YEAR = 31_536_000n;
const PRECISION = 10n ** 18n;

/** FLX/year a given MasterChef pool receives, from its share of the global emission rate. */
export function computeAnnualPoolReward(
  rewardPerSecond: bigint,
  allocPoint: bigint,
  totalAllocPoint: bigint
): bigint {
  if (totalAllocPoint === 0n) return 0n;
  return (rewardPerSecond * allocPoint * SECONDS_PER_YEAR) / totalAllocPoint;
}

/**
 * Converts `amount` of one token into the equivalent amount of another, via a
 * constant-product pool's reserves (amount * reserveTo / reserveFrom).
 */
export function convertByPoolPrice(amount: bigint, reserveFrom: bigint, reserveTo: bigint): bigint {
  if (reserveFrom === 0n) return 0n;
  return (amount * reserveTo) / reserveFrom;
}

/**
 * APR as a percentage (e.g. 12.34). Both args must already be expressed in the SAME unit —
 * the unit itself doesn't matter, only that numerator and denominator match. Returns
 * undefined if `tvlValue` is 0 (nothing staked yet, or price unavailable) so callers can
 * render a clear "—" instead of a fake 0% or Infinity.
 */
export function computeAprPercent(annualRewardValue: bigint, tvlValue: bigint): number | undefined {
  if (tvlValue === 0n) return undefined;
  const scaled = (annualRewardValue * PRECISION * 100n) / tvlValue;
  return Number(scaled) / Number(PRECISION);
}

export { PRECISION as APR_PRECISION };

/**
 * Above this, the number is technically correct but meaningless as a display figure — it
 * just means the pool is minuscule relative to the emission rate (expected on a fresh
 * testnet pool with fractions-of-a-token TVL). Real DeFi UIs cap display the same way
 * rather than printing a literal multi-billion-percent APR.
 */
export const MAX_DISPLAY_APR_PERCENT = 10_000;

/** Formats an APR percentage for display, capping absurdly large values from a shallow pool. */
export function formatAprDisplay(apr: number | undefined): string {
  if (apr === undefined || !Number.isFinite(apr)) return "—";
  if (apr > MAX_DISPLAY_APR_PERCENT) return `>${MAX_DISPLAY_APR_PERCENT.toLocaleString()}%`;
  return formatPercent(apr);
}
