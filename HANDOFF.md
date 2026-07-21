# HANDOFF — WETH Staking / MasterChef farm / RWD-for-RWD pool / WETH-RWD AMM (Robinhood Chain)

_Last updated: 2026-07-21. Repo is now on GitHub: https://github.com/algosbiz/dapp_

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

**Market cap now shown in USD (2026-07-16):** boss asked for market cap "in USD" — pushed
back first on what that can honestly mean here (see the conversation, not repeated in full),
then implemented the one approach that isn't fabricated: `lib/price.ts` fetches a **live
ETH/USD price** (public CoinGecko endpoint, no key, `next: { revalidate: 60 }` so page views
don't hammer the free tier) and multiplies it by the market cap already computed in WETH
terms. This is the **only external, off-chain price dependency in the entire app** —
everything else (APR, the base WETH-denominated market cap, the tokenomics calculator)
deliberately avoids needing one. The USD figure is still explicitly labeled hypothetical
("as if RWD traded at today's ETH price") because the RWD:WETH leg of the calculation comes
from our own shallow testnet pool, not a real market — only the ETH/USD leg is real. Tile
now shows `$109.71M` as the headline with `≈ 60,138.26 WETH` underneath (new `MetricCard`
`secondaryLine` prop) so the underlying WETH figure — the actually-real number — stays
visible, not replaced. **Graceful fallback:** if the CoinGecko fetch fails (network, rate
limit) the tile silently reverts to the old WETH-only display rather than breaking or
showing an error — verified the happy path live (real fetch, sane resulting ETH price
backed out of the displayed numbers), the fallback path is untested-live but reuses the
exact pre-existing WETH-only render branch. New `formatUsdHeadline` in `lib/format.ts`
mirrors `formatWethHeadline`'s overflow-safe shape (2 decimals, compact past a million).

**Card layout tidied (2026-07-16):** the four tiles now share a `MetricCard` component
(label / headline figure / caption pinned to the card base via `mt-auto`), so uneven
caption lengths no longer leave dead space under the shorter cards, and the "insufficient
history" state shows "—" instead of the placeholder text posing as the headline number.
Also fixed the Market cap figure overflowing its rounded card at some price points — grid
items don't shrink below their content's intrinsic width by default, so an unbroken long
decimal like "2,490.3808" pushed past the card border onto the page background. Fixed with
a new `formatWethHeadline` in `lib/format.ts` (caps at 2 decimals for headline WETH figures,
compact notation past a million) plus `min-w-0` + `break-words` on the tile container, so
it can't recur regardless of how large the number gets.

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

### 15. "Swap doesn't really work" investigation (2026-07-20) — two separate findings, one real bug

User reported Swap "and some other functions" weren't working. Root-caused via the
`systematic-debugging` process (not guessed) — turned out to be **two unrelated things**,
neither of which was "Swap is broken":

**Finding 1 — my own local dev server was crashing, not the deployed app.** `git log`
turned up a commit *not made in this session*, **"Build immersive WETH landing experience"**
(`42c8096`, 2026-07-17): a full home-page redesign (`ImmersiveLanding.tsx`/`OrbitalScene.tsx`
/`ScrollSequence.tsx`, Three.js + GSAP, a new sprite asset) landed on `main` between two of
this session's own commits — evidence someone else (or another session) is also pushing to
this repo. It added `three`/`gsap` to `package.json`, but this local checkout's `node_modules`
never got a matching `npm install`, so every request to `/` crashed the entire dev server
(`Error: Cannot find module './vendor-chunks/gsap.js'`, then the whole `npm run dev` process
exited) — meaning *every* page looked down locally, not just Swap. Fixed by `npm install` at
the repo root (workspaces hoist to the root `node_modules`, not `packages/web/node_modules` —
checking the wrong folder first gave a false "still missing" reading) + clearing the stale
`.next` cache. Confirmed via GitHub's commit-status API that **Vercel's own build for this
commit succeeded** (`state: success`) — Vercel does a fresh install from the lockfile, so this
was purely a local-environment gap, not something the deployed app ever had.

**Finding 2 — the real bug, on the actual Vercel deployment.** Got the live staging URL
(`https://dapp-web-phi.vercel.app`) from the user and tested Swap there directly with a real
connected wallet: typing an amount computed a correct preview, the price-impact checkbox
gated the button exactly as designed — Swap itself works. The user then sent a screenshot of
a block explorer showing a real submitted swap tx with **"Batch: Pending"** and concluded it
was stuck. Verified directly against the RPC (not just trusting the explorer UI): tx status
was `SUCCESS` with 218 confirmations, and the wallet's WETH balance already reflected the
swapped funds. Explained the actual mechanic: "Batch pending" is Orbit-chain L1 batch
settlement (an async, automatic finality step against the parent chain) — a completely
separate, non-blocking process from the L2 transaction itself, which had already succeeded
in <1s. No bug here either, just an L2/L1 finality concept that isn't obvious to a non-crypto
user.

**The one thing that *was* actually broken, found while digging into "why did Buy show 0":**
the user tried selling 123 RWD and the "Buy" amount showed literally `0`. Queried the deployed
`WethRwdPool` contract's own `getAmountOut(123 RWD, ...)` directly — the real on-chain result
is `0.000000079768410095 WETH`, i.e. genuinely tiny (the pool's WETH side is down to
`~0.0000000876 WETH` after prior swaps) but **not zero**. `SwapPanel.tsx`'s "Buy" preview and
the `"1 X ≈ Y"` rate line were using `formatToken(value, 6)` — a fixed 6-decimal formatter that
rounds anything under 0.000001 down to a bare "0", which reads as "you'd get nothing" even
though the real, executable trade returns a nonzero (if tiny) amount. Fixed by switching both
call sites to `formatTokenSmart` (already defined in `lib/format.ts` and already used by
`PoolPanel.tsx`'s reserve tiles for this exact "reserves can be extremely lopsided on a
shallow testnet pool" problem — same fix, just not yet applied in `SwapPanel.tsx` when it was
built). No fund-loss risk existed at any point — the swap's actual `amountOutMin` (via
`withSlippage`) was always computed from the correct, non-rounded bigint; only the *display*
was misleading.

Verified the exact corrected numbers directly against the contract's own `getAmountOut` (a
`pure` function, callable read-only) rather than trusting a re-implementation — this is the
strongest form of verification available for AMM math and is worth reaching for again before
trusting any client-side preview math when a pool is this thin. Live in-browser re-verification
of the fixed UI was attempted but blocked by the public testnet RPC being unresponsive at the
time (reserve reads stuck on "—" locally, in two independent fresh tabs, no console errors,
`tsc` clean) — the same transient RPC flakiness already documented earlier in this file;
not a regression from this change.

### 18. Full data-source audit + new read-only "Emissions & Supply" page (2026-07-20)

Boss asked (via whiteboard) to be able to check *and* manually change RWD supply and
emission rates from the web, self-service. Audited every contract read in the app first
(every hook + component, cross-checked against a live on-chain script per contract) before
building anything — everything was already live/correct except the two already-known,
unfixable gaps (7d/30d minted needs the snapshot file; the RwdPricePill is deliberately
mocked). No code changes came out of the audit itself, just confirmation nothing else was
silently stale.

For the "change it" half, checked what the deployed contracts actually support without a
redeploy:
- `MasterChef.updateEmissionRate(uint256)` — **exists**, `onlyOwner`, already settles all
  pools before switching rates so past rewards keep accruing at the old rate correctly.
- `MasterChef.ownerMint(address, uint256)` — **exists** (used for the earlier 10k pre-mint).
- **No burn function anywhere** — `RewardToken` is uncapped/mintable by design with no burn
  at all, not even an owner-gated one. Supply can only ever be *increased* from this UI;
  decreasing/"setting to X" would need a new token contract and a migration, not just a UI.
- `WethStakingRewards` (`/stake` and `/stake-rwd`) has **no direct rate setter** — rate is a
  side effect of `notifyRewardAmount(totalRewardForNextPeriod)`, which requires the contract
  to already hold enough reward tokens to cover `rate × rewardsDuration` (a solvency check).
  Changing the rate here is a two-step operation (fund, then declare), not a single field.

**Decision needed before building any write-capable panel:** every one of the above is
`onlyOwner`, and the current owner is the **deployer wallet** (which only this session's
`.env` can sign for), not the boss's wallet. A self-service web panel would only actually be
clickable by whoever holds that key — building "buttons" wouldn't give the boss real
self-service unless ownership were transferred to a wallet he controls, which is a real,
mostly-irreversible security decision (`WethStakingRewards` uses one-step `Ownable` —
transferring to a mistyped address loses the contract's admin capability permanently;
`MasterChef` at least uses `Ownable2Step`, requiring the new owner to accept). **Asked the
user directly; they chose to keep execution with the dev/deployer wallet** (same pattern as
every owner-action this whole session — request in chat, executed via a one-off script,
verified on-chain, reported back) rather than transfer control. Given that, a write-enabled
web panel would add real attack surface (and UI complexity) for zero actual self-service
benefit, since nobody but this session can sign for it either way — so no mint/rate-change
UI was built.

Built the "check" half instead: new `/emissions` page (`EmissionsPanel.tsx`, a Server
Component, no wallet needed) showing, all read live on every page load: total RWD supply;
farm-wide emission rate plus its 50/50 split across the WETH and LP pools (via `poolInfo`'s
`allocPoint` vs `totalAllocPoint`); and `/stake` + `/stake-rwd`'s reward rates plus their
funding status (`periodFinish` vs now — "Funded until …" in green, "Funding period ended …"
in red if the stream ran out). Linked from the navbar's "More" dropdown. Verified every
number against a live on-chain script before and after — including catching what looked
like a stale value on first load (12,008.805 vs a script's 14,132.395) that turned out to
just be ~30 seconds of real continuous mint activity between the two reads, not a caching
bug — worth double-checking with a fresh reload before concluding "stale" on a supply number
that changes every second.

### 23. Homepage reverted to the original section-based landing (2026-07-21, latest)

User asked to go back to the original homepage — Hero / Steps / Guarantees (the `#security`
section) / CtaBand — and to drop the video hero and GSAP scroll entirely. `app/page.tsx` is
now exactly the composition from the initial commit (`4f8426b`).

**This reverses §21 and the out-of-session §15 redesign.** Deleted as dead code once
`page.tsx` stopped importing them: `ImmersiveLanding.tsx`, plus `OrbitalScene.tsx`,
`ScrollSequence.tsx` and `LandingVisual.tsx`, which were *already* orphaned before this change
(nothing imported them — worth checking for that before assuming a component is live). Also
removed `public/landing/film/` (the 160 webp frames, 4.9 MB) and the `gsap` + `three`
dependencies, and stripped nine now-unreferenced rules from `globals.css` (`weth-film-*`,
`landing-*`, `product-row`, `protocol-pulse`). Every class was grep-verified as
zero-reference before deleting rather than assumed.

Nothing is lost: the frames, components and film CSS are all in git history (§21's commit
`496163e`), and the whole technique is packaged as a reusable global skill,
`~/.claude/skills/scroll-film-hero/`, which can regenerate frames from any video via its
bundled `cut-frames.mjs`. So this is a revert of *this site's* homepage, not of the capability.

**Windows dev-server gotchas hit again, both already documented above and both worth
re-reading before debugging a stuck server:** removing dependencies without an `npm install`
+ `.next` clear leaves the dev server hanging at "Starting…" with no error output; and
`rm -rf .next` fails with `Permission denied` on `.next/trace` while any stray project
`node.exe` still holds it. Fix is: kill project node processes (`Get-CimInstance Win32_Process
-Filter "Name = 'node.exe'" | Where CommandLine -like '*contract*'`), then remove `.next`,
then start.

### 22. RWD → FLEX/FLX rename, which meant redeploying the whole stack (2026-07-21)

User asked to rename the token to **FLEX** with symbol **FLX**. The blocking fact: an ERC20's
`name`/`symbol` are set in the constructor and OpenZeppelin exposes no setter, so a *deployed*
token can never be renamed. Worse, every downstream contract stores the token address as
`immutable` (`MasterChef.reward`, `WethRwdPool.token0/token1`,
`WethStakingRewards.stakingToken/rewardsToken`) — so a new token forces new versions of
everything that touches it.

Presented the honest fork: cosmetic UI-only rename (cheap, but MetaMask/explorer keep saying
RWD — the same "wrong token imported" confusion already documented above), or a real redeploy.
User chose the redeploy, and also opted to rename tRWD → tFLX. Right call on testnet: the
balances being abandoned are test tokens, and after mainnet this option disappears entirely.

**What changed in source:** only ERC20 metadata — `RewardToken` → `ERC20("FLEX","FLX")`,
`TestnetRewardToken` → `("Testnet FLEX","tFLX")`, `WethRwdPool` LP →
`("WETH-FLEX LP Token","WETH-FLEX-LP")`. Solidity **class** names (`RewardToken`,
`WethRwdPool`) were deliberately left alone — they're internal, and renaming them would
churn every script, test, ABI and hook for zero user-visible gain. Same reasoning kept the
`NEXT_PUBLIC_*RWD*` env-var keys: renaming them would silently break any environment (Vercel,
CI) still setting the old keys, and the key name never reaches a user. Three test fixtures
asserting the old name/symbol were updated; all 35 tests pass.

**Deploy order** (each step depends on the previous, scripts committed under
`packages/contracts/scripts/`): `deploy-masterchef` (FLEX + MasterChef gen 4 + pid 0, then
hands token ownership to the chef) → `deploy-weth-rwd-pool` → `seed-flex-pool` (wrap ETH,
`ownerMint` FLX, add liquidity, **burn founding LP**) → `add-lp-pool` (pid 1) →
`deploy-rwd-pool` + `fund-flex-stake` → `deploy-testnet` + `fund-tflex-stake`.
`verify-flex-stack.ts` checks the whole thing in one pass.

**Seeded the AMM far thicker this time: 0.001 WETH / 10,000 FLX** (1 WETH = 10M FLX). The
previous pool was left so thin (~0.0000001 WETH) that real swap outputs rounded to "0" and
needed adaptive formatters to stay honest — starting with depth avoids re-earning that whole
class of bug. Founding LP burned, so `totalSupply` is the 1000-wei dead-address minimum and
the "nobody can withdraw it" claim in the UI stays true.

**Gas was a non-issue, contrary to the pre-flight worry:** the entire deployment (6 contracts
+ ~15 transactions) cost **0.0011 ETH** on this L2. Worth remembering before hesitating over
a redeploy here again.

Safety property worth reusing: contracts were deployed and verified *before* any env var was
switched, so a failure partway through would have left the live app untouched on the old
stack rather than half-migrated.

**Bug found during verification:** market cap rendered "≈ 0 WETH" when the true value was
0.00107. `formatWethHeadline` had a gap — values between 0.0001 and 1 fell into a
2-decimal branch that floored them to "0" (the `< 0.0001` branch only rescued *very* tiny
numbers). Fixed by switching everything below 1 to `maximumSignificantDigits: 4`. This is the
third instance this project has hit of "fixed decimals silently render a real value as zero";
prefer significant digits for any figure whose magnitude isn't known in advance.

Also **reset `data/rwd-supply-snapshots.json`** to a single fresh baseline. It held the old
token's supply history (71 → 10,000 RWD); leaving it would have made the 7d/30d "minted"
figures compare a dead token's history against the new token's supply. The old series is
still in git history.

**Not done, needs the user:** Vercel's env vars still point at the dead RWD contracts. The
deployed site will keep showing the old stack until those six `NEXT_PUBLIC_*` values are
updated in the Vercel dashboard to match `packages/web/.env.local`.

### 21. Homepage "protocol film" is now a real scroll-scrubbed frame sequence (2026-07-20)

User asked for a catwifcap.fun-style homepage: a video cut into hundreds of small webp
frames, swapped by scroll position so scrolling literally plays the film forward/backward
(the Apple-product-page technique). They supplied the footage themselves
(`C:\Users\Gigabyte\Downloads\dog.mp4`, 10s 1280×720 24fps, AI-generated husky howling at
the moon on a snowy peak — "to the moon", very much on purpose for a crypto site).

**Asset pipeline (documented so it can be re-run):** `ffmpeg-static` added as a
`packages/web` devDependency (no system ffmpeg on this machine). Cut with:
`node_modules/ffmpeg-static/ffmpeg.exe -i dog.mp4 -vf "fps=16" -c:v libwebp -quality 72 -an
packages/web/public/landing/film/frames/frame_%03d.webp` → **160 frames, 4.9 MB total**
(24–35 kB each — catwifcap's range; lighter than the 7.3 MB of 4 PNGs it replaced). The
frames are git-tracked (they ARE the asset); the source mp4 is not (only in Downloads —
grab it before wiping that folder if re-cutting is ever needed).

**What changed in `ImmersiveLanding.tsx`:** the film section's 4-still crossfade `<img>`
stack became a single full-viewport `<canvas>` scrubber. All 160 frames preload up front
(the existing "Loading protocol film — X%" overlay now counts real frames; page reveals at
24 frames and streams the rest behind); the already-existing `[data-film-story]`
ScrollTrigger's `onUpdate` now maps progress → frame index and draws cover-fit, falling
back to the nearest already-loaded frame if scrolling outruns the network. Chapter-rail
dots map progress → chapter independently of frame count. Reduced-motion users get a
static first frame (canvas sizing/drawing deliberately lives outside the motion-gated
effect). The 4 orphaned chapter PNGs were deleted (recoverable — the WIP crossfade version
was committed first as baseline `22a7627` exactly so nothing is lost).

**Design flip (footage is night-dark; the old design assumed light stills):** film act
background `bg-brand` → `bg-ink`; chapter copy ink-on-light → canvas-on-dark with the
brand lime as the accent color (kickers, italic accent spans, loader bar, primary CTA now
`bg-brand`); `globals.css`'s `.weth-film-wash`/`.weth-film-copy` halo system inverted from
cream glows to ink vignettes (desktop + the mobile media-query variant — the mobile block
was easy to miss and was caught by the design hook). Chapter 04's title now lands the
howl-at-the-moon climax: "Trade. Pair. To the moon." Display clamp max tightened 7rem →
6rem and tracking -0.065em → -0.04em per the impeccable guardrails. Sections after the
film (ticker/system/routes/security/CTA) untouched apart from those two type tweaks.

Note for future sessions: the design hook flags this file's literal 9–10px mono labels and
clamp() display sizes as off-DESIGN.md-ramp — that's the baseline landing's established
type language (pre-existing, deliberately preserved), not drift introduced by this rework.

**Bug found & fixed during browser QA (same commit):** the four post-film sections
(system / routes / security / CTA) were shipping **blank** — stuck at `opacity:0;
visibility:hidden`. Root cause: the baseline's generic reveal used `gsap.from(el,
{autoAlpha:0, scrollTrigger:{start:"top 86%"}})`, which sets the element to opacity 0
immediately and depends on the trigger firing to bring it back — but the 800svh pinned film
ScrollTrigger above it throws off the reveal triggers' computed start positions, so the
reveal never fires and the content stays invisible (exactly the "don't gate visibility on a
scroll transition" trap the impeccable skill warns about). This was almost certainly latent
in the baseline too, just never caught. Fixed by switching to `gsap.fromTo(el,
{autoAlpha:0,y:42}, {autoAlpha:1,y:0, immediateRender:false, scrollTrigger:{start:"top 90%",
once:true}})` — `immediateRender:false` keeps the element at its natural *visible* state
until the trigger actually fires, so a reveal that never runs still ships the content
visible instead of blank. Verified via DOM inspection (all 8 `[data-reveal]` blocks report
`opacity:1; visibility:visible` after scrolling through). **Testing caveat:** the
`claude-in-chrome` screenshot tool renders this page (large fixed canvas + pinned sections)
as blank canvas-soft even when the DOM is fully painted — confirmed by `getComputedStyle` +
`elementFromPoint` returning the real visible content. Trust DOM inspection over screenshots
on this page; see the `browser-tool-coordinate-mismatch` memory.

### 19. Emission-rate "request" form + an app-wide wrong-chain bug found while building it (2026-07-20)

Boss reopened the question from #18: still wanted *some* UI-based way to change the emission
rate, asking if a specific wallet could just be authorized for that one action. Re-explained
the same binary owner/not-owner limitation — these contracts have no concept of a scoped
"can change rate but nothing else" permission, so "authorize a wallet for rate changes" is
technically identical to making that wallet the full owner (mint, pause, recover-ERC20,
everything). Presented two honest options via `AskUserQuestion`; user picked the safer one:
**a "compile a request" form, not a real write path.** `EmissionRateRequestForm.tsx` (added to
`/emissions`, under the existing read-only `EmissionsPanel`) lets you pick a target pool and a
desired new rate, shows the current on-chain rate for comparison, and produces a
copy-pasteable summary (contract address, current vs. requested rate, per-day equivalent, a
per-target note on how that rate is actually mechanically changed) to hand to whoever executes
it (i.e., paste back into this chat). The form itself never signs or sends anything.

**Bug found while verifying it, not by inspection.** The form's three `useReadContract` calls
(farm rate, `/stake` rate, `/stake-rwd` rate) all showed "Current rate: —" even after a full
reload, despite being structurally identical to `useFarm.ts`'s `rewardPerSecond` read — assumed
safe to copy since that one is "proven working on `/farm`". A live network trace
(`read_network_requests`, not a guess) showed the client-side reads were hitting
`rpc.mainnet.chain.robinhood.com`, not testnet. Re-tested `/farm` itself the same way,
disconnected: **it showed the same "—" right now.** The earlier "proven working" observation
from earlier in this session must have happened with a wallet actively connected to testnet,
which made the bug invisible at the time.

Root cause: `wagmiConfig.chains` (`config/wagmi.ts`) listed `robinhoodChain` (mainnet, id 4663,
no contracts deployed there yet) *before* `robinhoodTestnet` (id 46630, where every contract
actually lives). wagmi's `useReadContract` with no explicit `chainId` uses the current chain,
which falls back to `chains[0]` whenever no wallet is connected — so **every disconnected
client-side read in the entire app** (32 call sites across 8 files: `useFarm.ts`,
`useStaking.ts`, `useRwdStaking.ts`, `useWethRwdPool.ts`, `useWrap.ts`, `FarmDashboard.tsx`,
`TokenomicsCalculator.tsx`, plus this new form) was silently querying the wrong chain, not just
the new form. It only ever looked correct because most testing this session happened with a
wallet connected to testnet, which overrides the disconnected fallback.

Fixed with a single, low-risk change: reordered `chains: [robinhoodChain, robinhoodTestnet,
hardhatLocal]` → `[robinhoodTestnet, robinhoodChain, hardhatLocal]` in `config/wagmi.ts` — this
makes the disconnected fallback resolve to testnet everywhere at once, without touching the 32
individual call sites (mainnet + hardhat stay available in the wallet's own network switcher;
mainnet just isn't the *default* anymore). Chose this over adding an explicit `chainId` to
every read: same fix, far smaller diff, and matches the fact that this app is testnet-only in
practice right now (the comment already in that file says to drop `robinhoodChain` entirely
once this ever goes to production).

Verified, not assumed: cleared the network log, reloaded `/emissions` disconnected — all 3
reads now hit `rpc.testnet.chain.robinhood.com`, "Current rate" shows real numbers (0.01
RWD/sec farm, 0.001157 tRWD/sec stake, 0.000116 RWD/sec stake-rwd — matching the
`EmissionsPanel` figures directly above). Re-checked `/farm` too — the emission-rate and APR
tiles that showed "—" before the fix now show real numbers (0.01 RWD/sec, 422.89% APR)
disconnected. Spot-checked `/stake`, `/stake-rwd`, `/pool`, `/wrap`, `/tokenomics` for
regressions — all read live data correctly, nothing broke. Full form flow verified end-to-end
including the clipboard: entering a new rate populates the "≈ X/day" preview and a compiled
summary textarea correctly, and "Copy request" puts the exact right text on the clipboard
(confirmed via `navigator.clipboard.readText()` readback, not just the button's own "Copied!"
label).

### 20. Same form, now also a real owner-mode admin panel (2026-07-20, later)

User asked directly: since #19 shipped a "compile a request" form, why not let them just apply
the change themselves? Clarified which wallet they meant (`AskUserQuestion`) — not a *new*
wallet (that would still mean transferring ownership, same tradeoff as #18), but the
**existing deployer wallet** that already owns every contract here and that this session has
been driving via one-off scripts all along. That distinction matters: connecting *that same*
wallet in a browser and clicking a button changes nothing about who has control, just how they
exercise it — so this was safe to build outright, no ownership transfer, no new risk.

`EmissionRateRequestForm.tsx` is now dual-mode, per target, decided live by
`hooks/useAdminControls.ts`'s `useAdminOwnership()` (reads each contract's `owner()` — newly
added to both `abi/masterChef.ts` and `abi/wethStakingRewards.ts` — and compares it to the
connected address):
- **Not the owner (or disconnected):** exactly the #19 flow, completely unchanged — compile +
  copy a request.
- **Connected wallet IS the owner of the selected target:** the "Copy request" area is
  replaced by real controls. Farm → a direct `updateEmissionRate` button. Stake / Stake RWD →
  since those pools have no direct rate setter (rate is a side effect of funding via
  `notifyRewardAmount`), the form now computes the exact top-up required for the desired rate
  and walks through it as Approve → "Fund & set rate".

The top-up math (`lib/rewardFunding.ts`'s `computeRequiredTopUp`) mirrors
`WethStakingRewards.notifyRewardAmount`'s own formula exactly — fresh period
(`reward = rate × duration`) vs. mid-period blended (`reward = rate × duration − leftover`,
where `leftover = remaining × currentRate`) — so the UI's number always matches what the
contract will actually compute, not an approximation. Two things it guards, both surfaced as
plain messages rather than silent failures: (1) a desired rate *below* what's already
committed for the rest of the current period is mathematically unreachable by topping up (the
contract can only raise the blended rate mid-period, never lower it) — shown as "can't reach
this rate… choose a higher rate, or wait until \[period end]"; (2) the connected wallet not
holding enough of the reward token yet — shown as an exact shortfall amount, since this app
deliberately doesn't auto-mint on the admin's behalf as part of this flow (kept the scope to
"change the rate," not "also manage token supply").

Verified: `tsc --noEmit` clean. Confirmed the non-owner/disconnected path is byte-for-byte
unchanged (regression-checked in browser). The real owner-controls path was visually verified
using the same `TEMP-DESIGN-QA` bypass pattern as earlier sessions (force `isOwnerOfTarget =
true`, always reverted before commit) since a real test would need an actual MetaMask signature
— Claude cannot and does not execute this for the user, same boundary as the `/wrap` widget.
Sanity-checked the funding math by hand against live numbers: for Stake, a requested 0.02
tRWD/sec came back as "requires funding with 12,093.366898 tRWD" — reverse-computed against the
pool's actual `periodFinish`/`rewardRate` at the time, this is exactly the mid-period blended
formula's output, not a rough estimate. Also confirmed the "unreachable rate" message fires
correctly for a rate below the current leftover contribution.

**To actually use this:** import the deployer wallet (`DEPLOYER_PRIVATE_KEY` in
`packages/contracts/.env`) into a real wallet (e.g. MetaMask) and connect it on `/emissions` —
the owner-mode controls will appear automatically once the connected address matches. The very
first real click should be a small, low-stakes change to build confidence before relying on it
for anything that matters.

### 17. "Total RWD supply" now reads live, not from yesterday's snapshot

User pointed at the block explorer showing `totalSupply() = 12,008.805 RWD` on the actual
`RewardToken` contract while our own dashboard still said `10,000`. Root cause: "Total RWD
supply" (and everything derived from it — the two "Minted, last N days" tiles and Market
cap) was reading `totalSupply` from the **last daily snapshot file entry**, not a live
contract call. The snapshot only runs once a day (`rwd-supply-snapshot` scheduled task); the
last entry happened to be from right after the 10,000 pre-mint (#14), and real mint activity
since then (farm emission is continuous, plus the user's own successful `addLiquidity` and
prior swaps triggering pool/farm state changes) pushed the *real* number to 12,008.805
without the snapshot ever catching up. This was the correct architecture for the "minted in
the last 7/30 days" trend tiles (that needs actual historical data points, which only the
snapshot file has) but wrong for "right now."

Fixed in `SupplyPanel.tsx`: added `fetchLiveTotalSupply()` (a plain `viem` `readContract` on
`CONTRACTS.rwdToken`, same pattern as the existing live pool-reserves read for Market cap) and
use its result for "current" supply everywhere, falling back to the snapshot's last value only
if the live read fails. The 7d/30d baselines still come from the snapshot file — that part was
never wrong and can't be fixed by a live read (a contract can't tell you what its supply was a
week ago). Verified the corrected live number against both the contract directly (`ethers`
script) and the block explorer before shipping — all three agreed at `12,008.805`.

### 16. Add Liquidity — guard against ratio-assist demanding more than the wallet holds

Same "is this also broken" check as #15, this time for the `/pool` Add/Remove Liquidity
panel. Reproduced live on `dapp-web-phi.vercel.app` with the real connected wallet: typing
`0.001` WETH auto-filled the RWD side (ratio-assist) to **137,031 RWD** — because the pool
is now this lopsided (see #15's note on the drained WETH side) — while the wallet only held
1,210 RWD. Nothing was actually broken (this is the same "empty inputs → disabled buttons"
state as Swap's "Enter an amount", not a bug), but the "Add" button had no check against the
wallet's *own* balance — a user who approved both tokens and clicked Add here would have hit
an on-chain revert (insufficient RWD balance for the `transferFrom`), one more confusing
"why did it fail" moment on top of everything else investigated today.

Added `insufficientWeth`/`insufficientRwd` checks (`amount > balance`, guarded against
`undefined`) in `LiquidityPanel.tsx`: the Add button now stays disabled and a red inline
message names which side is short ("needs more RWD than your wallet holds") *before* the
user can attempt a doomed transaction, instead of after. Verified the exact failing scenario
against the real wallet's real balance on Vercel; the local dev environment couldn't
independently re-exercise this specific branch (no real wallet connection available there,
and the balance reads this check depends on are `undefined` without one), so this one relies
on the live-data reproduction above plus a clean `tsc` rather than a second live screenshot.

### 14. Pre-mint RWD to 10,000 total supply (2026-07-16)

Boss (Uriah) asked to "start the supply at 10,000 RWD" so tokens can be "bought without
so much price impact or scarcity." **Important correction surfaced to the user before
acting:** total supply ≠ pool liquidity. Price impact is set by the pool's reserve depth
(especially WETH), *not* by how many RWD exist. Minting RWD into a wallet does nothing for
price impact on its own — it just makes the tokens exist so they *can* later be added to the
pool. Delivering the boss's actual goal is a 2-step job: (1) mint the RWD [done], (2) seed
the pool with that RWD **+ WETH** at a chosen price [still pending — blocked on WETH, which
is why `/wrap` + the faucet matter]. At the current ~4 RWD/WETH price, putting 10k RWD in
the pool would need ~2,490 WETH, so step 2 realistically also means resetting RWD to a much
lower price first. Not yet done; needs a WETH budget + target-price decision from the boss.

Executed step 1 via `MasterChef.ownerMint(deployer, 10000e18 - currentSupply)` from the
deployer/owner wallet — minted **9,794.12 RWD** to bring total supply to **exactly 10,000.0
RWD** (tx `0x9ec5b86317e63faec3fca33e99aada5533e87656ef00510aa46d152779ceff09`, block
90885339). Deployer now holds ~9,795 RWD, earmarked for seeding the pool. **This is
irreversible** — `RewardToken` has no burn, supply only grows; the user confirmed the exact
amount before execution given that.

Ran `npm run contracts:snapshot` afterward so the `/farm` supply dashboard reflects 10,000
immediately (new data point in `rwd-supply-snapshots.json`, committed). Side effect to be
aware of: the "minted last 7/30 days" tiles will now show a ~9,794 RWD spike (accurate — it
*was* minted), and "Market cap (est.)" jumps to ~supply×price, a big number since price is
still 4 RWD/WETH. Both are honest reflections of the mint, not bugs.

### 13. Navbar grouped into dropdowns (2026-07-16)

Once `/wrap` landed, the top nav had 7 flat text links (Wrap, Stake, Farm, Stake RWD,
Pool, Tokenomics, Security) plus the price pill + RainbowKit chain/wallet controls, and
looked cramped. Grouped the same-function links under dropdown triggers in `Navbar.tsx`:
top level is now **Wrap · Earn ▾ · Pool · More ▾**, where **Earn** = Stake/Farm/Stake RWD
(the three yield products) and **More** = Tokenomics/Security. Wrap and Pool stay top-level
(Wrap is the on-ramp; Pool is the swap/liquidity surface).

Nav config is now structured (`NavItem | NavGroup`, `isGroup()` type guard) instead of a
flat array. Desktop groups render via a local `NavDropdown` component: opens on
hover **and** click (click/Enter/Space toggles for keyboard + touch), closes on
outside-click, Escape, or route change (`usePathname`), with `aria-haspopup`/`aria-expanded`
and a rotating chevron. The dropdown menu is `position: absolute` with `z-50`; the sticky
header (`z-40`) has no `overflow: hidden`, so it isn't clipped. Active-state highlights the
trigger when the current route matches one of its items (hash links like `/#security` are
excluded from active-matching via `pathOf()` which strips the `#…`).

Mobile drawer keeps every link reachable in one tap (no nested dropdowns on mobile —
there's vertical room): standalone links render flat, grouped links render under a small
non-uppercase group label. Deliberately avoided an uppercase-tracked label there — that's
the flagged "eyebrow" tell.

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

**FLEX generation (2026-07-21) — current.** Everything below was redeployed for the
RWD → FLEX/FLX rename; see §22 for why a rename forces a full redeploy.

| What | Address |
|---|---|
| MasterChef gen 4 (per-second + `ownerMint`; pid 0 = WETH, pid 1 = WETH-FLEX-LP) | `0x92448e5eC14b969EC0960aa418295dE7a97De417` |
| RewardToken / **FLEX (FLX)** — farm's mint-on-demand token | `0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e` |
| Stake-FLEX pool (WethStakingRewards, FLX↔FLX) | `0x8F02f6B7A05095B43ee2cb64085CAcc578a53CC1` |
| WethRwdPool (AMM, LP token `WETH-FLEX-LP`, founding liquidity burned) | `0x83715727e023FFb88847B02d98d39f63eD8eb09e` |
| WethStakingRewards (`/stake`, WETH↔tFLX) | `0x85a2C8703611C68f5c2571428837d56Fb4bbbccD` |
| TestnetRewardToken / **tFLX** (`/stake`'s reward) | `0xC77b859Ac99fB812386BE76e51dEf57774785ef9` |
| WETH (testnet — unchanged, not ours) | `0x7943e237c7F95DA44E0301572D358911207852Fa` |
| Deployer wallet | `0x062B37Ff25204B30936E8b77A5f94EA5eFd2241B` |

### Dead contracts (do not point the web app at these)

**The whole RWD generation below died in the FLEX rename (2026-07-21).** Any RWD/tRWD/
WETH-RWD-LP balance a wallet still holds lives on these dead contracts and is not readable
by the app any more — including the boss's ~678 wei of old LP and any farmed RWD. That's
the accepted cost of the rename, agreed before redeploying.

| What | Address | Why dead |
|---|---|---|
| MasterChef gen 3 (RWD era) | `0x6E530044df48cFfa245aA2b1102AfF5D9c4e02E6` | Superseded by gen 4 (FLEX). Its RewardToken is immutable, so renaming the token forced a new farm too. |
| RewardToken / RWD gen 3 | `0x3e71e09aF9278ed68d5D12df8edb2Ae1b69f8666` | The old `RWD` token, final supply ~14,132. **Wallets that imported this into MetaMask will still see an RWD balance** — tell them to import FLX `0xc8aF3c4f600469DD1a58B33E3e88e0a749cD312e` instead. |
| Stake-RWD pool | `0x0Fb2421c5BB75c4eE883Dd76725dbbEBEdfb72ea` | Pointed at the dead RWD token (immutable). |
| WethRwdPool (RWD era, `WETH-RWD-LP`) | `0x6b9929D2cb7037C2d637cDb01540384a1aE00B4c` | Pointed at the dead RWD token. Its founding liquidity was burned, so nothing is recoverable from it by anyone — by design. |
| WethStakingRewards (`/stake`, tRWD era) | `0x81453690904DD3Ce2EAFF49224b5F9960F9651f4` | Replaced alongside the tRWD → tFLX rename. |
| TestnetRewardToken / tRWD | `0x2FcEAfE77702fE1A915a483F2CFEea27e5ee74a9` | The old `tRWD` token. |
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
- Emissions page + admin controls: `app/emissions/page.tsx`,
  `components/{EmissionsPanel,EmissionRateRequestForm}.tsx`, `hooks/useAdminControls.ts`
  (owner checks + funding-state reads + owner-only write actions), `lib/rewardFunding.ts`
  (`computeRequiredTopUp`, pure, mirrors `notifyRewardAmount`'s own formula).
- Landing: `app/page.tsx` (Hero + Steps + Guarantees + CtaBand — the film/GSAP landing was reverted, see §23), `components/landing/{Hero,Steps,Guarantees,CtaBand}.tsx`,
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
- The Chrome-automation `computer` tool's `screenshot` pixel coordinates are **not**
  guaranteed to match the real viewport's CSS pixel coordinates (seen: 1568×718 screenshot vs.
  an actual 1707×781 viewport) — clicking at a coordinate that visually looked right in a
  screenshot can silently miss the target element. If a click-driven UI test isn't producing
  the expected effect, don't conclude the app is broken from that alone: cross-check with a
  direct DOM dispatch (`el.click()` via `javascript_tool`) or a fresh `find` ref before
  suspecting the component's own logic.
