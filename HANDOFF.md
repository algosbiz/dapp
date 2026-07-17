# HANDOFF — WETH Staking / MasterChef farm / RWD-for-RWD pool / WETH-RWD AMM (Robinhood Chain)

_Last updated: 2026-07-16. Repo is now on GitHub: https://github.com/algosbiz/dapp_

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

**4th tile added (2026-07-15, later): "Market cap (est.)"** — `totalSupply x current /pool
price`, both in WETH terms (same no-USD-needed trick as the APR math in `lib/apr.ts`,
which this reuses: `convertByPoolPrice`/`APR_PRECISION`). Unlike the other three tiles
(from the daily snapshot file), this one does a **live** on-chain read of `/pool`'s
reserves via a server-side `viem` `createPublicClient` call (hardcoded to
`robinhoodTestnet` — this project only targets testnet right now), so it's current
between snapshot runs, not frozen to the last snapshot's price. Explicitly labeled
"est." with a caption noting testnet WETH has no USD value and the number can swing
fast since the pool is still shallow.

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

**⚠️ Pool is currently badly imbalanced (2026-07-15, real user action, not a bug):** the
user swapped 5 RWD into the pool via the real UI — enormous relative to the ~0.002 RWD of
actual liquidity at the time — which drained ~99.96% of the WETH reserve (constant-product
math working exactly as designed against a very shallow pool). Current reserves are
roughly **0.0000002 WETH / 5.002 RWD**, spot price ~24,000,000 RWD/WETH. Not fixed —
left as-is since it's testnet with no real value; if this needs to look sane for a demo,
either seed a fresh, much larger pool, or add enough WETH-heavy liquidity to rebalance it.

**Fix added after that incident:** `SwapPanel.tsx` now computes price impact
(execution price vs. pre-trade spot price) and shows a warning once it exceeds 0.1%;
at ≥10% impact the warning turns red and the Swap button is gated behind an explicit
"I understand and want to proceed anyway" checkbox. This is exactly the guard that was
missing when the incident above happened.

**Swap UI redesign (2026-07-16):** the boss misread the original two-box/two-button
layout, so `SwapPanel.tsx` was rebuilt to match conventional crypto swap UIs (Uniswap/
Jupiter-style) instead of the original generic form:
- Stacked "Sell"/"Buy" boxes (`bg-canvas-soft`) with a circular direction-toggle button
  overlapping the seam between them, replacing the old text link. Each box shows a
  `TokenPill` (new shared `components/TokenPill.tsx`, extracted from a duplicate
  already living in `landing/Hero.tsx` — colored dot + symbol, not a selector, since
  this app only ever has the one fixed pair).
- "Sell" box balance line gained a **Max** button (fills the input with the full wallet
  balance) — a standard swap-UI affordance that was missing before.
- The old side-by-side Approve/Swap button grid (one often visibly disabled) was
  replaced with a **single dynamic button** that changes label/action through the
  flow: "Enter an amount" → "Approve WETH/RWD" → "Confirm price impact to continue"
  (when applicable) → "Swap". This was likely the actual source of confusion — two
  same-looking buttons where only one does anything at a time reads as broken to
  anyone not already familiar with the approve-then-swap pattern.
- All underlying math/logic (price impact calc, slippage, high-impact acknowledgment,
  approve/swap wiring) is unchanged — this was a layout/interaction redesign only.
- Verified in-browser end-to-end (temporarily bypassed the wallet-connect gate for
  screenshotting only, reverted before commit): both directions, the Max button, the
  rate line, and the high-impact red warning (a real ~16% impact on this shallow pool)
  all render and recalculate correctly.

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

### 7. APR displays — last unchecked whiteboard item, closed out

New `packages/web/lib/apr.ts`: three pure functions (`computeAnnualPoolReward`,
`convertByPoolPrice`, `computeAprPercent`), no on-chain calls, just arithmetic on values
the dashboards already fetch. Everything is converted into a common unit (WETH-equivalent)
using the `/pool` spot price before dividing, so **no USD price feed is needed anywhere** —
that's what makes this possible now (RWD only got a price once the AMM pool existed).

APR shown on:
- **Farm - WETH pool** (`FarmDashboard.tsx`): RWD price from `/pool` reserves.
- **Farm - LP pool** (`LpFarmDashboard.tsx`): same RWD price, LP token valued via
  `2 * reserve0 / totalSupply` (a balanced pool's total value in WETH terms).
- **Stake RWD** (`RwdStakingDashboard.tsx`): same-currency APR (`rewardRate * seconds/year
  / totalStaked`), no price conversion needed since both sides are RWD.
- **NOT shown on `/stake`** (WETH→tRWD) — tRWD has no price discovery anywhere in this
  app, so any APR number there would be fabricated. Deliberately left alone.

**Display cap:** `formatAprDisplay()` caps anything over 10,000% to `">10,000%"` rather
than printing the literal number. This isn't cosmetic — the math is correct, but on this
testnet the emission rate (`0.01 RWD/sec`) was sized for a meaningfully-large pool, while
actual staked/pooled amounts are fractions of a token. Priced through the AMM, that
genuinely computes to billions of percent (confirmed by an independent script matching
the UI's exact formula) — capping the display is standard practice for real DeFi UIs on
a fresh/shallow pool, not a bug workaround. Expect real-looking APRs once staked amounts
and pool depth grow to non-trivial testnet sizes.

### 8. Toast notifications + per-action button spinners

New this session, applied consistently across all 6 action panels (`StakingPanel`,
`FarmPanel`, `RwdStakingPanel`, `LpFarmPanel`, `SwapPanel`, `LiquidityPanel`):

- `sonner` added as a dependency (first UI library beyond Tailwind/RainbowKit in this
  repo). `<Toaster />` mounted once in `app/layout.tsx`, `unstyled` + custom
  `classNames` so toasts match the Wise theme (`bg-canvas`, `rounded-card`,
  `shadow-card`) instead of sonner's default look.
- New `hooks/useTransactionToast.ts`: wraps a wagmi write-contract action's lifecycle
  (confirm-in-wallet → waiting-for-confirmation → confirmed/error) into one toast that
  updates in place (same `id`) rather than stacking three separate toasts per action.
  Also tracks *which* specific action is in flight (`run("Stake", () => stake(amount))`
  returns an `activeLabel`), since every panel shares one `useWriteContract` instance
  across several buttons — without this, clicking one button would make all of them
  look busy.
- New `components/Spinner.tsx`: `Spinner` (the icon) + `ButtonContent` (swaps a
  button's label for a spinner + busy-label when `activeLabel` matches that button).
- The old inline "Waiting for confirmation…/Transaction confirmed ✓/error" paragraph
  block at the bottom of each panel was removed — toasts now own that feedback,
  avoiding duplicated UI for the same event. Error toasts still show the full wagmi
  error message (truncated at 140 chars).
- `app/globals.css` gained a `prefers-reduced-motion` override (spinner + any future
  CSS animation reduces to near-instant for users who need it) — didn't exist before.
- Verified end-to-end in-browser on `/pool` (the one page where the automation
  session's wallet was actually connected): clicked Approve → button showed a spinner
  + "Approving…", toast progressed "confirm in your wallet…" → "Approve confirmed";
  same for Swap. Full lifecycle confirmed working, not just typechecked.

### 9. Tokenomics Calculator (`/tokenomics`) — planning tool, no blockchain reads/writes for the "target" side

New 2026-07-16. Traced back to a whiteboard note from the boss: "ADD Liquidity (LP) -
$1000 LP - 10,000 MC." After walking through what that meant (LP budget vs. target market
cap, and the ratio between them as a proxy for how resistant the pool would be to price
swings), the user explicitly chose the no-real-funds option over actually moving testnet
WETH to hit an arbitrary dollar target — this page is that option.

`components/TokenomicsCalculator.tsx` (client component) takes two plain-number inputs,
**target market cap** and **liquidity budget** (both unitless/illustrative — there is no
USD price for testnet WETH, these are just numbers to reason about ratios with), and
computes:
- implied price per RWD = target market cap ÷ live total supply
- deposit split (50/50 WETH/RWD by value, matching how `LiquidityPanel.tsx` seeds a pool)
- liquidity ÷ market cap ratio, with a qualitative health label (`<1%` fragile → `>20%`
  conservative — thresholds are a rule of thumb, not derived from anything on-chain)

A second card, "Current live pool," shows the same ratio computed from **real** on-chain
data — reuses `useWethRwdPoolData()` and the exact `convertByPoolPrice`/`APR_PRECISION`
math from the Market Cap tile in `SupplyPanel.tsx`, so the two numbers are directly
comparable. This is what surfaced the actual insight for the boss: the live pool's ratio
is currently ~0.002% (a side effect of the pool-drain incident in section 5), thousands of
times below any reasonable target — which is probably what was really behind the earlier
"send 5 WETH" ask.

Required adding `totalSupply` to `abi/erc20.ts` (was missing — only `balanceOf`/
`allowance`/`decimals`/`symbol` existed before, none of which this page needed).

Verified in-browser: default values ($10,000 MC / $1,000 budget) produce the hand-checked
numbers ($48.572/RWD, $500 + 10.29 RWD deposit, 10% ratio, "Reasonable starting point");
changing the budget input to $5,000 live-recalculates every downstream figure (50% ratio,
"Very deep — conservative", updated comparison text) — confirms the page is reactive, not
just correct on first paint.

Linked from the navbar between "Pool" and "Security".

### 10. RWD price pill in navbar — mockup only, static placeholder

New 2026-07-16. The boss also mentioned wanting a USD price for 1 RWD shown in the
navbar. Same underlying issue as market cap: RWD has no real listing or price feed on
testnet, so there is nothing live to show. Per explicit user choice, this is a **static
placeholder**, not wired to any pool or price source — `components/RwdPricePill.tsx`
hardcodes `MOCK_RWD_PRICE_USD = 0.05` and renders "1 RWD ≈ $0.05" next to an explicit
"Mock" tag so nobody mistakes it for real market data. Tooltip (`title` attribute) and
`aria-label` both spell out that it's a placeholder for demo purposes.

Placed in `Navbar.tsx` between the nav links and the Connect Wallet button, `hidden
lg:inline-flex` (≥1024px only) to avoid crowding the already-busy navbar at smaller
widths — same responsive pattern already used for `ConnectButton` (`hidden sm:block`).

To wire this to something real later: this is the one spot in the app that would need
an actual USD price feed (everything else — APR, market cap, the tokenomics calculator —
deliberately avoids needing one by working in WETH-relative terms instead).

### 11. Mobile responsiveness pass — navbar hamburger menu + button-grid fix

New 2026-07-16. Previously the navbar had **no way to reach any page on mobile** — the
nav links (`hidden ... md:flex`) and the Connect Wallet button (`hidden sm:block`)
both disappeared below their breakpoints with no replacement, leaving just the logo.
Not caught earlier because verification in this session has mostly been in-browser at
desktop width; window-resize automation isn't available in this environment (confirmed
`resize_window` has no effect here), so mobile viewports were tested via a same-origin
`<iframe>` sized to the target width — an independent viewport for real CSS media-query
behavior, not a substitute for testing on an actual device before shipping.

**`Navbar.tsx`**: added a hamburger button (`md:hidden`) that toggles a slide-down
drawer (`id="mobile-nav"`, `md:hidden`) containing all 6 nav links stacked full-width
plus the `ConnectButton`. The desktop `ConnectButton` visibility changed from `hidden
sm:block` to `hidden md:block` so it switches in lockstep with the nav links and
hamburger at the same single breakpoint (768px) rather than three staggered ones.
Drawer auto-closes on route change (`usePathname` + `useEffect`) so tapping a link
doesn't leave it open on the next page. Verified: opens/closes correctly, all 6 links
navigate and close the drawer, and the 768px→900px transition to full desktop nav has
no overlap or duplicate controls.

**`LiquidityPanel.tsx`**: the Add Liquidity action row (`Approve WETH` / `Approve RWD`
/ `Add`) was a fixed `grid-cols-3`, which wrapped button labels onto two lines at phone
widths. Changed to `grid-cols-1 sm:grid-cols-3` — stacks full-width below 640px, same
3-up layout as before from `sm:` up.

Everything else audited at 390px (iPhone-ish width) across `/`, `/stake`, `/farm`,
`/stake-rwd`, `/pool`, `/tokenomics` — all card grids (`sm:grid-cols-*`, `lg:grid-cols-2`)
already collapsed to a single column correctly and needed no changes; this was
specifically a navbar-navigation gap plus the one cramped button row.

### 12. Wrap ETH → WETH (`/wrap`) — get testable WETH into a wallet

New 2026-07-16. The whole app runs on WETH, but the testnet faucet
(`https://faucet.testnet.chain.robinhood.com`) only hands out **native ETH**, not WETH —
so a fresh tester (the boss, repeatedly) had ETH but no WETH and nothing in the app let
them convert it. Rather than walk non-technical users through the block-explorer "Write
Contract" flow each time, this adds a one-click wrap widget.

**The WETH contract is a proxy, not a plain deploy** — confirmed on-chain:
`0x7943e237c7F95DA44E0301572D358911207852Fa` has an EIP-1967 implementation slot pointing
at `0xf40600e58a560a988d7b60d61f22f7ab18106ed6`. A raw bytecode selector-scan on the proxy
shows **no** `deposit()`/`withdraw()` (they live in the implementation), so don't conclude
"not wrappable" from the proxy bytecode alone. An `eth_call` simulation of `deposit()` with
value **succeeds**, and `mint(address,uint256)` **reverts** — i.e. it's a standard WETH9
behind a proxy: you wrap real testnet ETH, you can't mint WETH out of thin air.

Files: `abi/weth.ts` (just `deposit()` payable + `withdraw(uint256)`), `hooks/useWrap.ts`
(`useWrapData` = native ETH via wagmi `useBalance` + WETH via `erc20.balanceOf`;
`useWrapActions` = `wrap`/`unwrap`), `components/WrapPanel.tsx` (Swap-style stacked
You-pay/You-receive with a direction toggle, 1:1 mirror, `TokenPill`s), `app/wrap/page.tsx`
(links out to the faucet). Navbar gets a `/wrap` link **first** in the list, since it's the
natural on-ramp before Stake/Farm/etc.

Two deliberate UX details: (1) **Max** on the wrap side subtracts a `0.0002` ETH gas
cushion (`GAS_BUFFER`) so a "max wrap" never leaves the wallet with 0 ETH and unable to pay
for its own tx; unwrap-side Max uses the full WETH balance. (2) an inline "amount > balance"
guard disables the button.

**Not driven on-chain in-browser** — same constraint as every other write action this
session: MetaMask's confirm popup is a separate extension window outside the automation tab
group. Verified instead by: the `eth_call` deposit() simulation above (proves the exact call
the UI builds executes), full in-browser UI check of both directions + 1:1 recalculation
(temp-bypassing the wallet gate for screenshots, reverted before commit), clean `tsc` and
zero console errors. **Claude cannot and does not execute the wrap for the user** — it needs
their wallet's signature; the widget exists precisely so they sign it themselves in one
click.

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
- APR math: `lib/apr.ts` (`computeAnnualPoolReward`, `convertByPoolPrice`,
  `computeAprPercent`, `formatAprDisplay`) — pure functions, no on-chain calls, used by
  `FarmDashboard.tsx`/`LpFarmDashboard.tsx`/`RwdStakingDashboard.tsx`.
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
