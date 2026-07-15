# HANDOFF — WETH Staking / MasterChef farm / RWD-for-RWD pool / WETH-RWD AMM (Robinhood Chain)

_Last updated: 2026-07-15. Repo is now on GitHub: https://github.com/algosbiz/dapp_

## Current state (2026-07-15)

Four products live side by side on `/stake`, `/farm`, `/stake-rwd`, `/pool`, plus an RWD
supply-inflation dashboard embedded in `/farm`. All contracts below are the **current**
ones — older addresses from previous sessions are dead/deprecated, see "Dead contracts"
below.

### 1. Staking (`/stake`) — WethStakingRewards, Synthetix pre-funded model

Unchanged from earlier sessions. Deployed & working. Reward token is `tRWD`
(`TestnetRewardToken.sol`), separate from the farm's `RWD`.

### 2. Farm (`/farm`) — MasterChef, mint-on-demand, per-second emission

Emits `rewardPerSecond` RWD (`block.timestamp`-based — Robinhood Chain is an Arbitrum Orbit
L2 where `block.number` tracks the slow parent chain, so never meter by block). Verified
on-chain: `pendingReward` climbs at exactly the configured rate.

**New this session:** added `ownerMint(address to, uint256 amount) external onlyOwner` +
`OwnerMint` event to `MasterChef.sol` — a clean, auditable escape hatch for the owner to
mint RWD directly (e.g. to fund the RWD-for-RWD pool below), without touching pool accrual
accounting. This required a redeploy (3rd generation of MasterChef now — see table).

### 3. Stake RWD (`/stake-rwd`) — second WethStakingRewards instance, RWD for RWD

New this session. Same `WethStakingRewards.sol` contract as `/stake`, but both
`stakingToken` and `rewardsToken` point at the farm's `RewardToken` (RWD) — stake RWD you
earned from farming, earn more RWD. **Pre-funded model, NOT mint-on-demand** — deliberately
kept separate from MasterChef to avoid balance comingling (see rationale in
`C:\Users\Gigabyte\.claude\plans\rustling-churning-cosmos.md` if it still exists).

Funded via: `masterChef.ownerMint(deployer, amount)` → `rwd.approve(pool, amount)` →
`pool.notifyRewardAmount(amount)`. Currently funded with 70 RWD over 7 days (~10 RWD/day),
started 2026-07-15 — re-run this runbook manually whenever it needs topping up.

### 4. RWD supply dashboard (bottom of `/farm`)

`SupplyPanel.tsx` (Server Component) reads `packages/web/data/rwd-supply-snapshots.json`
and shows total supply + RWD minted in the last 7/30 days (rolling windows, not calendar).
Fed by `packages/contracts/scripts/snapshot-supply.ts` — read-only, no private key, safe to
run unattended. `RewardToken` has no burn function so `totalSupply()` only grows; a daily
snapshot diff is sufficient, no event indexer needed.

**Scheduled task `rwd-supply-snapshot`** (`C:\Users\Gigabyte\.claude\scheduled-tasks\rwd-supply-snapshot\SKILL.md`)
runs daily at 00:06 local time: `npm run contracts:snapshot` → commit + push
`rwd-supply-snapshots.json` to `origin main` if it changed. **First automated run may hit a
permission prompt** for the git commit/push (same as this session did) — click "Run now" in
the Scheduled sidebar once to approve manually; approval persists for later runs.

### 5. WETH/RWD Pool (`/pool`) — minimal single-pair constant-product AMM, founding LP burned

New this session (`packages/contracts/contracts/WethRwdPool.sol`). Not a generic DEX —
one contract dedicated to exactly this pair. The contract itself is the LP token
(`ERC20` + `ERC20Burnable`, symbol `WETH-RWD-LP`). `addLiquidity`/`removeLiquidity`/
`swap` (0.3% fee), `Ownable2Step` + `Pausable` (blocks new liquidity/swaps, not
withdrawals) + `recoverERC20` (blocks token0/token1) — same hardening conventions as
`MasterChef`/`WethStakingRewards`. Reserves are internal accounting state, never read
from a raw `balanceOf`, so direct token donations can't skew pricing (documented
trade-off: that dust also isn't recoverable).

**Founding liquidity permanently locked (2026-07-15):** deployer seeded 0.0005 WETH +
0.002 RWD (arbitrary 1:4 testnet ratio — RWD has no established market price), then
called the inherited `burn(uint256)` on their entire received LP balance. Verified
on-chain: `balanceOf(deployer) == 0`, `totalSupply() == 1000` (just `MINIMUM_LIQUIDITY`,
permanently stuck at the dead address `0x…dEaD`). This is irreversible — nobody,
including the team, can ever withdraw that liquidity. The pool remains fully functional
for any future LP; only the founder's burned share is gone forever.

All 35 contract tests pass (`test/WethRwdPool.test.ts`, 19 cases).

**Swap + add/remove-liquidity UI (2026-07-15, later same day):** `/pool` now has
`SwapPanel.tsx` (direction toggle, client-side live preview mirroring
`getAmountOut`'s exact formula, 0.5% fixed slippage tolerance — not user-configurable
yet) and `LiquidityPanel.tsx` (two-token add with ratio-assist auto-fill from current
reserves, single-input remove with live payout preview, no approval needed to remove
since it burns the caller's own LP balance directly). Verified on-chain via a scripted
swap (0.00002 WETH → RWD) — reserves and the `k` invariant updated exactly as computed
client-side. MetaMask's own confirmation popup can't be driven by this session's browser
automation (separate extension window, outside the tracked tab), so on-chain correctness
was confirmed via a Hardhat script replicating the exact calldata the UI builds, plus the
UI's live preview math checked by hand against the deployed contract's reserves.

### 6. LP Farm (bottom of `/farm`) — stake `WETH-RWD-LP` to earn RWD

New this session. `masterChef.add(1000, wethRwdPoolAddress, true)` created **pid 1**
(`WETH-RWD-LP` as the staking token), `allocPoint` equal to pid 0 (WETH) — a 50/50
emission split between direct WETH staking and LP staking, adjustable later via
`masterChef.set(pid, allocPoint, true)`. No contract changes needed —
`deposit`/`withdraw`/`pendingReward`/`userInfo` already took an arbitrary `pid`.

`hooks/useFarm.ts` was generalized with optional `pid`/`stakingToken` parameters
(defaulting to the original pid-0/WETH values, so `FarmPanel.tsx`/`FarmDashboard.tsx`
are unchanged) rather than duplicated — this is the same underlying MasterChef
integration with different args, unlike `/stake` vs `/stake-rwd` (genuinely different
deployed contracts, where duplication was the right call). New
`LpFarmDashboard.tsx`/`LpFarmPanel.tsx` call the parameterized hooks with
`(FARM_LP_PID, CONTRACTS.wethRwdPool)`.

Verified on-chain via script: staked 19 wei of LP into pid 1, `pendingReward` climbed
to 0.045 RWD after ~8s (≈ 0.005 RWD/sec = 50% of the 0.01 RWD/sec farm-wide rate,
matching the 50/50 allocPoint split exactly).

**Note on tiny numbers:** LP token amounts can be extremely small after the founding
burn (each remaining LP token unit represents a large share of pooled value once
`totalSupply` is down near `MINIMUM_LIQUIDITY`). The UI shows LP balances in **raw
units**, not `formatToken`-formatted ether, since amounts like `19` wei would just
round to "0" at 4 decimal places and look broken otherwise.

## Repo is now on GitHub

`git init` + initial commit + push done this session. Remote: `origin` →
`https://github.com/algosbiz/dapp.git`, branch `main`. This was also a prerequisite noted
for an eventual Vercel deploy (discussed but not yet done). `.env`/`.env.local` (private
key, RPC secrets) confirmed excluded via `.gitignore` before the first commit — verified
with `git check-ignore`, not assumed.

Note: pushing initially failed with a 403 (local git credentials were logged in as GitHub
user `wira97-tech`, who lacked write access to `algosbiz/dapp`) — user fixed access on their
end, then push succeeded.

## Deployed on Robinhood Chain **Testnet** (chainId 46630)

| What | Address |
|---|---|
| MasterChef (current — per-second + `ownerMint`; pid 0 = WETH, pid 1 = WETH-RWD-LP) | `0x6E530044df48cFfa245aA2b1102AfF5D9c4e02E6` |
| RewardToken / RWD (current, farm's mint-on-demand token) | `0x3e71e09aF9278ed68d5D12df8edb2Ae1b69f8666` |
| Stake-RWD pool (WethStakingRewards, RWD↔RWD) | `0x0Fb2421c5BB75c4eE883Dd76725dbbEBEdfb72ea` |
| WethRwdPool (AMM, LP token `WETH-RWD-LP`, founding liquidity burned) | `0x6b9929D2cb7037C2d637cDb01540384a1aE00B4c` |
| WethStakingRewards (`/stake`, WETH↔tRWD) | `0x81453690904DD3Ce2EAFF49224b5F9960F9651f4` |
| TestnetRewardToken / tRWD (`/stake`'s reward) | `0x2FcEAfE77702fE1A915a483F2CFEea27e5ee74a9` |
| WETH (testnet) | `0x7943e237c7F95DA44E0301572D358911207852Fa` |
| Deployer wallet | `0x062B37Ff25204B30936E8b77A5f94EA5eFd2241B` |

### Dead contracts (do not point the web app at these)

| What | Address | Why dead |
|---|---|---|
| MasterChef gen 2 (per-second, no `ownerMint`) | `0x0e38363Cb657E82E44F0ccaad2A44a469C3AdA9d` | Superseded by current gen 3 above. Deployer's 0.0005 WETH test stake still sits here — low priority to reclaim (`withdraw(0, ...)`). |
| RewardToken gen 2 | `0x70c7e20a09671CD02244D85135255FDb388ee6eE` | Belonged to gen-2 MasterChef. **Browser test staker `0xB2FE8...233e9` has 21.52 RWD sitting here** (from harvesting gen-2 before the redeploy) — this is the address they have imported into MetaMask as "RWD", so MetaMask shows a nonzero balance while `/stake-rwd` (which reads the CURRENT gen-3 RewardToken) correctly shows 0 for that wallet. Not a bug — confirmed on-chain 2026-07-15. To see gen-3 RWD in MetaMask, import `0x3e71e09aF9278ed68d5D12df8edb2Ae1b69f8666` instead/additionally. Every MasterChef redeploy mints a fresh RewardToken, so this "wrong generation imported" confusion will recur if MasterChef is redeployed again — always re-check which RWD address a wallet has imported after a redeploy. |
| MasterChef gen 1 (per-BLOCK, the original bug) | `0x0E3a21D76b065f19FC3733044Bb9955e16a1b65c` | Per-block emission barely accrued on this L2. **Browser test staker `0xB2FE805A538E05a79a5a37AEc093D0b2a79233e9` still has 0.001 WETH stuck here** — only that wallet can `emergencyWithdraw(0)` it out. No rush (accrues ~nothing), but don't forget. |
| RewardToken gen 1 | `0x99C99b98139cD577f2109C2995058064b274e7F2` | Belonged to gen-1 MasterChef. |

`packages/contracts/.env` has `DEPLOYER_PRIVATE_KEY`, `WETH_ADDRESS`, `ROBINHOOD_TESTNET_RPC_URL`,
and `RWD_TOKEN_ADDRESS` (current RWD — used by `deploy-rwd-pool.ts`, `deploy-weth-rwd-pool.ts`
and `snapshot-supply.ts`; do NOT confuse with `REWARDS_TOKEN_ADDRESS`, which is tRWD).
`packages/web/.env.local` has all `NEXT_PUBLIC_*` incl. `NEXT_PUBLIC_MASTERCHEF_ADDRESS`,
`NEXT_PUBLIC_RWD_TOKEN_ADDRESS`, `NEXT_PUBLIC_RWD_STAKING_ADDRESS`,
`NEXT_PUBLIC_WETH_RWD_POOL_ADDRESS`. **Do not print the private key.**

## Deferred (not built) — price oracle, configurable slippage

Everything from the original whiteboard is now built. Two smaller items remain
deliberately deferred, both low priority until something actually needs them:
- Any TWAP/price-oracle mechanism (current spot price is a raw reserve ratio, manipulable
  by a large single swap — fine for display, not safe for anything else to depend on).
  Nothing in this repo consumes a price feed yet.
- User-configurable slippage tolerance on swap/add-liquidity (currently a fixed 0.5%
  constant in `hooks/useWethRwdPool.ts` — `SLIPPAGE_BPS`). Easy to expose as a setting
  later; not built now to keep the first UI pass simple.

## Project shape

npm-workspaces monorepo. Solidity 0.8.20 + OpenZeppelin 5 + Hardhat. Next.js 14 (App Router) +
Tailwind + wagmi v2 + RainbowKit. UI theme = **Wise** (light sage/lime/ink), added via
`npx getdesign add wise` → `packages/web/DESIGN.md`, implemented with the **impeccable**
skill (see the user memory). The impeccable design hook is active and scans UI files on edit.

## Key files

- Contracts: `packages/contracts/contracts/{WethStakingRewards,MasterChef,RewardToken,WethRwdPool}.sol`.
- Deploy scripts: `scripts/deploy.ts` (generic WethStakingRewards deployer, used for both
  `/stake` and `/stake-rwd` via different env vars), `scripts/deploy-masterchef.ts`,
  `scripts/deploy-rwd-pool.ts`, `scripts/deploy-weth-rwd-pool.ts`, `scripts/snapshot-supply.ts`.
- Tests: `test/MasterChef.test.ts` (7), `test/WethRwdPool.test.ts` (19),
  `test/WethStakingRewards.test.ts` (9) — 35 total.
- Web farm: `app/farm/page.tsx`, `components/{FarmPanel,FarmDashboard,LpFarmPanel,
  LpFarmDashboard,SupplyPanel}.tsx`, `hooks/useFarm.ts` (generalized with optional
  `pid`/`stakingToken` params — pid 0/WETH is the default), `abi/masterChef.ts`.
- Web pool: `app/pool/page.tsx`, `components/{PoolPanel,SwapPanel,LiquidityPanel}.tsx`,
  `hooks/useWethRwdPool.ts` (also exports `SLIPPAGE_BPS`/`withSlippage`),
  `abi/wethRwdPool.ts`.
- Web RWD staking: `app/stake-rwd/page.tsx`, `components/RwdStaking{Panel,Dashboard}.tsx`,
  `hooks/useRwdStaking.ts` (reuses `abi/wethStakingRewards.ts` + `abi/erc20.ts`, no new ABI).
- Web WETH staking: `app/stake/page.tsx`, `components/{StakingPanel,Dashboard}.tsx`,
  `hooks/useStaking.ts`.
- Shared config: `config/contracts.ts` (`weth`, `stakingRewards`, `rewardsToken`,
  `masterChef`, `rwdToken`, `rwdStaking`, `wethRwdPool`, `FARM_PID`, `FARM_LP_PID`),
  `config/chains.ts`.
- Landing: `app/page.tsx`, `components/landing/{Hero,Steps,Guarantees,CtaBand}.tsx`,
  `components/Footer.tsx`, `components/Navbar.tsx` (now has Stake / Farm / Stake RWD / Pool /
  Security links). Theme tokens: `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`.
- Snapshot data: `packages/web/data/rwd-supply-snapshots.json` (git-tracked, updated daily
  by the scheduled task).

## Run / verify

```bash
npm run web:dev                       # http://localhost:3000  (/, /stake, /farm, /stake-rwd, /pool)
npm run contracts:test                # 35 tests (9 staking + 7 farm + 19 pool) — should pass
npm run --workspace packages/contracts deploy:masterchef:robinhood-testnet
npm run --workspace packages/contracts deploy:rwd-pool:robinhood-testnet
npm run --workspace packages/contracts deploy:weth-rwd-pool:robinhood-testnet
npm run contracts:snapshot            # manual snapshot run (root package.json alias)
```

## Pre-existing fixes already applied (needed to build the web app at all)

- `packages/web/tsconfig.json`: `target` `ES2017` → **`ES2020`** (code uses BigInt `0n` literals).
- `packages/web/tsconfig.json`: added **`"types": ["node"]`** (a broken `@types/minimatch` stub in
  the hoisted monorepo `node_modules` broke `next build` type-checking).

## Gotchas

- Windows: `next build` sometimes throws `EPERM` on `.next/trace`; `rm -rf .next` and retry, or kill
  stray `node.exe`. Verify builds with a real exit code (`npm run build; echo $?`), not the piped
  `tail` exit.
- The impeccable skill is installed **globally** (`~/.claude/skills/impeccable`), not in the project;
  run its scripts from the global base dir. See the `use-impeccable-skill` memory.
- This session's auto-mode permission classifier blocks on-chain mint/redeploy actions and
  git commit/push as "shared resource" changes, even mid-plan — expect to re-confirm with
  the user at each of those steps rather than assuming plan approval covers them.
