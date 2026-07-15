# HANDOFF — WETH Staking / MasterChef farm (Robinhood Chain)

_Last updated: 2026-07-14 (later session). The per-block problem below is SOLVED._

## RESOLVED — farm converted to per-second emission (2026-07-14)

The old problem: MasterChef emitted **per block** (`block.number`), but Robinhood Chain is an
**Arbitrum Orbit L2** where `block.number` tracks the slow parent chain, so rewards barely accrued.

**Fix applied (the previously agreed plan, executed in full):** `MasterChef.sol` now emits per
second (`block.timestamp`, `rewardPerSecond`, `startTimestamp`, `PoolInfo.lastRewardTime`). Deploy
script takes `REWARD_PER_SECOND` (default 0.01 RWD/sec) and passes `startTimestamp = 0` (constructor
snaps to deploy time). Tests rewritten with `time.increase()` — all 15 pass. Web ABI/hook/label
renamed to `rewardPerSecond` / "RWD / sec"; `tsc --noEmit` clean.

**Redeployed & verified on testnet:** deployer wrapped 0.0005 ETH → WETH, deposited into pid 0;
`pendingReward` went 0.01 → 0.15 RWD in 15 s = exactly 0.01 RWD/sec. ✔

**Leftover:** the browser test staker `0xB2FE805A538E05a79a5a37AEc093D0b2a79233e9` still has
0.001 WETH in the OLD MasterChef (`0x0E3a21D76b065f19FC3733044Bb9955e16a1b65c`). Only that wallet
can pull it out — call `emergencyWithdraw(0)` (or `withdraw(0, 1e15)`) on the old contract from
the browser wallet. The old farm accrues ~nothing, so no rush, but don't forget the principal.

## Project shape

npm-workspaces monorepo. Solidity 0.8.20 + OpenZeppelin 5 + Hardhat. Next.js 14 (App Router) +
Tailwind + wagmi v2 + RainbowKit. Two staking models live SIDE BY SIDE (by user's choice):

- **Staking** (`/stake`) — `WethStakingRewards.sol`, Synthetix pre-funded model. **Deployed & working
  on testnet** (user staked 0.001 WETH, earned RWD). Untouched by the farm work.
- **Farm** (`/farm`) — `MasterChef.sol` + `RewardToken.sol`, unlimited-supply mint-on-demand model.
  Per-second emission, deployed to testnet, UI wired, accrual verified on-chain (see above).

UI theme = **Wise** (light sage/lime/ink), added via `npx getdesign add wise` →
`packages/web/DESIGN.md`, implemented with the **impeccable** skill (see the user memory). The
impeccable design hook is active and scans UI files on edit.

## Deployed on Robinhood Chain **Testnet** (chainId 46630)

| What | Address |
|---|---|
| MasterChef (per-SECOND, current) | `0x0e38363Cb657E82E44F0ccaad2A44a469C3AdA9d` |
| RewardToken (farm RWD, uncapped, current) | `0x70c7e20a09671CD02244D85135255FDb388ee6eE` |
| MasterChef OLD (per-block, dead — staker's 0.001 WETH still inside) | `0x0E3a21D76b065f19FC3733044Bb9955e16a1b65c` |
| RewardToken OLD (belonged to old chef) | `0x99C99b98139cD577f2109C2995058064b274e7F2` |
| WETH (testnet) | `0x7943e237c7F95DA44E0301572D358911207852Fa` |
| Deployer wallet | `0x062B37Ff25204B30936E8b77A5f94EA5eFd2241B` |
| Browser test staker | `0xB2FE805A538E05a79a5a37AEc093D0b2a79233e9` |

`packages/contracts/.env` has `DEPLOYER_PRIVATE_KEY` (set), `WETH_ADDRESS` (set to testnet WETH),
`ROBINHOOD_TESTNET_RPC_URL`. `packages/web/.env.local` has all `NEXT_PUBLIC_*` incl.
`NEXT_PUBLIC_MASTERCHEF_ADDRESS`. **Do not print the private key.**

## Open items

- Browser staker should reclaim 0.001 WETH from the OLD MasterChef (see RESOLVED section).
- Web dev server must be restarted after the `.env.local` address change to pick up the new
  MasterChef. Browser test of `/farm` against the new contract not yet done (on-chain accrual
  verified via script instead).

## Key files

- Contracts: `packages/contracts/contracts/{WethStakingRewards,MasterChef,RewardToken}.sol`,
  `scripts/deploy-masterchef.ts`, `test/MasterChef.test.ts`.
- Web farm: `app/farm/page.tsx`, `components/{FarmPanel,FarmDashboard}.tsx`, `hooks/useFarm.ts`,
  `abi/masterChef.ts`, `config/contracts.ts` (`masterChef`, `FARM_PID`).
- Web staking: `app/stake/page.tsx`, `components/{StakingPanel,Dashboard}.tsx`, `hooks/useStaking.ts`.
- Landing: `app/page.tsx`, `components/landing/{Hero,Steps,Guarantees,CtaBand}.tsx`,
  `components/Footer.tsx`, `components/Navbar.tsx`. Theme tokens: `tailwind.config.ts`,
  `app/globals.css`, `app/layout.tsx` (Inter + Manrope).

## Run / verify

```bash
npm run web:dev                       # http://localhost:3000  (/, /stake, /farm)
npm run contracts:test                # 15 tests (9 staking + 6 farm) — should pass
npm run --workspace packages/contracts deploy:masterchef:robinhood-testnet
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
