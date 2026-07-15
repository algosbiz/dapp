import { defineChain } from "viem";

/**
 * Robinhood Chain (Arbitrum Orbit L2). Values confirmed against the official docs:
 * https://docs.robinhood.com/chain/connecting/
 *
 * The public RPC below is rate-limited and NOT recommended for production — for
 * real traffic, sign up with a provider (Alchemy is recommended) and set
 * NEXT_PUBLIC_ROBINHOOD_RPC_URL to your dedicated endpoint, e.g.:
 *   https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}
 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Explorer",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  testnet: false,
});

/**
 * Robinhood Chain Testnet — use this to test the real chain's infrastructure
 * (RPC, bridge, explorer) with free test ETH before touching mainnet funds.
 * https://docs.robinhood.com/chain/connecting/
 */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Robinhood Chain Testnet Explorer",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});

/**
 * Local Hardhat node (`npx hardhat node`) — fastest inner-loop for development,
 * with no gas cost and instant blocks. Add to MetaMask manually
 * (RPC http://127.0.0.1:8545, Chain ID 31337) to test end-to-end.
 */
export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
  testnet: true,
});
