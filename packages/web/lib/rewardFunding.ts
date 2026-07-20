/**
 * Reward-token amount that must be transferred into a WethStakingRewards pool via
 * `notifyRewardAmount` to make its `rewardRate` become `desiredRatePerSecond` — mirrors that
 * function's own fresh-period vs. mid-period blended-rate formula exactly, so the UI's
 * prediction always matches what the contract will actually compute.
 *
 * Returns `undefined` if the desired rate can't be reached by topping up: the contract can
 * only ever raise the blended rate for the rest of the current period, never lower it (that
 * only happens naturally once `periodFinish` passes and a fresh, smaller amount is funded).
 */
export function computeRequiredTopUp(params: {
  desiredRatePerSecond: bigint;
  rewardsDuration: bigint;
  periodFinish: bigint;
  currentRewardRate: bigint;
  nowSeconds: bigint;
}): bigint | undefined {
  const { desiredRatePerSecond, rewardsDuration, periodFinish, currentRewardRate, nowSeconds } = params;
  if (rewardsDuration === 0n) return undefined;

  const required = desiredRatePerSecond * rewardsDuration;
  if (nowSeconds >= periodFinish) return required;

  const leftover = (periodFinish - nowSeconds) * currentRewardRate;
  if (required <= leftover) return undefined;
  return required - leftover;
}
