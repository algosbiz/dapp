# Robinhood Chain — WETH Staking (Full Stack)

Single-asset WETH staking dApp (Synthetix/PancakeSwap-style reward distribution) for
**Robinhood Chain (Chain ID: 4663)**.

```
.
├── packages/
│   ├── contracts/      # Hardhat project — Solidity 0.8.20, OpenZeppelin 5.x
│   │   ├── contracts/
│   │   │   ├── WethStakingRewards.sol
│   │   │   └── mocks/MockERC20.sol      # local-only test tokens
│   │   ├── scripts/deploy.ts
│   │   ├── scripts/deploy-mocks.ts      # local-only
│   │   ├── test/WethStakingRewards.test.ts
│   │   └── hardhat.config.ts
│   └── web/             # Next.js 14 (App Router) + Tailwind + Wagmi v2 + RainbowKit
│       ├── app/                          # layout, page, providers
│       ├── components/                   # Navbar, Dashboard, StakingPanel
│       ├── config/                       # chains.ts, wagmi.ts, contracts.ts
│       ├── abi/                          # typed ABIs
│       └── hooks/useStaking.ts
└── package.json          # npm workspaces root
```

## Security notes (read before mainnet use)

- `notifyRewardAmount` pulls reward funding via `safeTransferFrom` in the same call the
  owner must `approve` the contract first — this prevents the pool from ever promising a
  `rewardRate` it doesn't hold.
- `stake`/`withdraw`/`claimReward`/`exit` are all `nonReentrant` and follow
  checks-effects-interactions.
- `recoverERC20` cannot touch the staking token (WETH) or the reward token — the owner can
  never drain user funds "by accident".
- `pause()` only blocks new `stake()` calls; withdrawing and claiming always stay open.
- Get an independent audit before putting real WETH/TVL at risk. This blueprint is a strong
  starting point, not a substitute for one.

## Confirmed Robinhood Chain network details

Verified against the official docs (https://docs.robinhood.com/chain/connecting/ and
https://docs.robinhood.com/chain/protocol-contracts/) — already wired into
`hardhat.config.ts` and `packages/web/config/chains.ts` as defaults:

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | `4663` | `46630` |
| Public RPC (rate-limited) | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Block explorer | `https://robinhoodchain.blockscout.com` | `https://explorer.testnet.chain.robinhood.com` |
| WETH (L2) | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | `0x7943e237c7F95DA44E0301572D358911207852Fa` |

The public RPCs are rate-limited and **not recommended for production** — sign up with a
provider (Alchemy is the recommended one) and point `ROBINHOOD_RPC_URL` /
`NEXT_PUBLIC_ROBINHOOD_RPC_URL` at your dedicated endpoint
(`https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`) before going live.

**Your internal reward token still has no fixed address** — that's specific to your
company and needs to be deployed/obtained separately; ask your team, or use
`packages/contracts/contracts/mocks/MockERC20.sol` as a starting template for a real one.

**Strongly recommended path**: deploy to **Robinhood Chain Testnet** first (free test ETH,
real chain infrastructure, zero financial risk) before ever touching mainnet.

## Prerequisites

- Node.js 18+ and npm 9+
- A wallet (e.g. MetaMask) funded with test ETH/WETH once you have real Robinhood Chain
  testnet access
- A free WalletConnect Project ID from https://cloud.walletconnect.com (needed by RainbowKit)

## 1. Install dependencies

```bash
npm install
```

(npm workspaces will install both `packages/contracts` and `packages/web`.)

## 2. Smart contracts — compile & test locally

```bash
cp packages/contracts/.env.example packages/contracts/.env
npm run contracts:compile
npm run contracts:test
```

You should see all `WethStakingRewards` tests pass (staking, withdrawal, reward
distribution/splitting, `exit()`, access control, pause behavior, recover-token guard).

## 3. Try the full flow on a local chain (optional but recommended)

```bash
# terminal 1 — local Hardhat node
npm run contracts:node

# terminal 2 — deploy mock WETH + mock reward token, then the staking contract
npm run --workspace packages/contracts exec -- hardhat run scripts/deploy-mocks.ts --network localhost
# copy the two printed addresses into packages/contracts/.env as WETH_ADDRESS / REWARDS_TOKEN_ADDRESS
npm run contracts:deploy:local
```

Copy the deployed `WethStakingRewards` address (and the mock WETH/reward token addresses)
into `packages/web/.env.local` (step 5) to point the frontend at your local node, and add
Hardhat's local network (RPC `http://127.0.0.1:8545`, chain ID `31337`) to your wallet for
testing.

## 4. Deploy to Robinhood Chain Testnet (recommended before mainnet)

```bash
# In packages/contracts/.env, fill in:
#   DEPLOYER_PRIVATE_KEY   — a wallet funded with Robinhood Chain testnet ETH
#   WETH_ADDRESS=0x7943e237c7F95DA44E0301572D358911207852Fa   (testnet L2 WETH)
#   REWARDS_TOKEN_ADDRESS  — your reward token, deployed on testnet
npm run contracts:deploy:robinhood-testnet
```

## 5. Deploy to Robinhood Chain mainnet

```bash
# In packages/contracts/.env, fill in:
#   DEPLOYER_PRIVATE_KEY   — owner wallet funded with real ETH for gas
#   WETH_ADDRESS=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73   (mainnet L2 WETH)
#   REWARDS_TOKEN_ADDRESS  — your reward token, deployed on mainnet
#   ROBINHOOD_RPC_URL      — your dedicated provider endpoint (public RPC is rate-limited)
npm run contracts:deploy:robinhood
```

Fund the pool once deployed (from the owner wallet, using ethers/hardhat console or a
script): `rewardsToken.approve(stakingAddress, rewardAmount)` then
`staking.notifyRewardAmount(rewardAmount)`.

## 6. Configure and run the frontend

```bash
cp packages/web/.env.local.example packages/web/.env.local
```

Fill in `packages/web/.env.local`:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — from cloud.walletconnect.com
- `NEXT_PUBLIC_ROBINHOOD_RPC_URL` — confirmed Robinhood Chain RPC endpoint
- `NEXT_PUBLIC_WETH_ADDRESS`, `NEXT_PUBLIC_STAKING_ADDRESS`, `NEXT_PUBLIC_REWARD_TOKEN_ADDRESS`
  — addresses from step 3 or 4

Then run:

```bash
npm run web:dev
```

Open http://localhost:3000, connect your wallet (top-right), and:
1. **Approve WETH** for the staking contract (only needed once, or when allowance runs out)
2. **Stake** an amount of WETH
3. Watch **Earned (RWD)** accrue on the dashboard
4. **Claim Reward** any time, or **Withdraw**/**Exit** to unwind your position

## 7. Production build

```bash
npm run web:build
npm run --workspace packages/web start
```

## Extending this blueprint

- Add a subgraph or `viem` event-log indexer for a proper staking/rewards history table.
- Add `setRewardsDuration` / `notifyRewardAmount` admin UI gated behind an owner-only route.
- Consider Ownable2Step instead of Ownable if you want a safer two-step owner-transfer flow
  for the production deployment.
