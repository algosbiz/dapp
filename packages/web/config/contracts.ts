function requireAddress(value: string | undefined, name: string): `0x${string}` {
  if (!value) {
    // Falls back to the zero address in dev so the app can still render before
    // addresses are configured; reads will simply return empty data.
    return "0x0000000000000000000000000000000000000000";
  }
  return value as `0x${string}`;
}

export const CONTRACTS = {
  weth: requireAddress(process.env.NEXT_PUBLIC_WETH_ADDRESS, "NEXT_PUBLIC_WETH_ADDRESS"),
  stakingRewards: requireAddress(
    process.env.NEXT_PUBLIC_STAKING_ADDRESS,
    "NEXT_PUBLIC_STAKING_ADDRESS"
  ),
  rewardsToken: requireAddress(
    process.env.NEXT_PUBLIC_REWARD_TOKEN_ADDRESS,
    "NEXT_PUBLIC_REWARD_TOKEN_ADDRESS"
  ),
  // MasterChef farm — stakers deposit WETH into pid 0 and earn minted FLX.
  masterChef: requireAddress(
    process.env.NEXT_PUBLIC_MASTERCHEF_ADDRESS,
    "NEXT_PUBLIC_MASTERCHEF_ADDRESS"
  ),
  // The farm's reward token, FLEX/FLX — not the same as `rewardsToken` above (tFLX,
  // the separate reward token used by the /stake WETH pool).
  // NOTE: the *_RWD_* env var names are kept from the pre-rename deployment on purpose.
  // Renaming them would silently break any environment (Vercel, CI) still setting the old
  // keys, and the key name has no user-visible effect — only the on-chain symbol does.
  rwdToken: requireAddress(process.env.NEXT_PUBLIC_RWD_TOKEN_ADDRESS, "NEXT_PUBLIC_RWD_TOKEN_ADDRESS"),
  // WethStakingRewards instance where users stake FLX to earn more FLX.
  rwdStaking: requireAddress(
    process.env.NEXT_PUBLIC_RWD_STAKING_ADDRESS,
    "NEXT_PUBLIC_RWD_STAKING_ADDRESS"
  ),
  // WETH/RWD constant-product AMM pool. Also the WETH-RWD-LP token, and (once added)
  // the staking token for the LP-farming MasterChef pool.
  wethRwdPool: requireAddress(
    process.env.NEXT_PUBLIC_WETH_RWD_POOL_ADDRESS,
    "NEXT_PUBLIC_WETH_RWD_POOL_ADDRESS"
  ),
};

/** WETH is seeded as pool 0 by scripts/deploy-masterchef.ts. */
export const FARM_PID = 0n;
/** WETH-RWD-LP is added as pool 1 — stake LP tokens to earn RWD. */
export const FARM_LP_PID = 1n;
