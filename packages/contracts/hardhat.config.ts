import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// --- Robinhood Chain network parameters --------------------------------------------------
// Confirmed against the official docs: https://docs.robinhood.com/chain/connecting/
// The public RPC below is rate-limited and NOT recommended for production — sign up with
// a provider (Alchemy is recommended) and set ROBINHOOD_RPC_URL / ROBINHOOD_TESTNET_RPC_URL
// in .env to your dedicated endpoint for real deployments.
const ROBINHOOD_CHAIN_ID = 4663;
const ROBINHOOD_TESTNET_CHAIN_ID = 46630;
const ROBINHOOD_RPC_URL = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const ROBINHOOD_TESTNET_RPC_URL =
  process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com";
// -------------------------------------------------------------------------------------------

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    robinhood: {
      url: ROBINHOOD_RPC_URL,
      chainId: ROBINHOOD_CHAIN_ID,
      accounts,
    },
    robinhoodTestnet: {
      url: ROBINHOOD_TESTNET_RPC_URL,
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      robinhood: process.env.ROBINHOOD_EXPLORER_API_KEY || "not-required",
      robinhoodTestnet: process.env.ROBINHOOD_EXPLORER_API_KEY || "not-required",
    },
    customChains: [
      {
        network: "robinhood",
        chainId: ROBINHOOD_CHAIN_ID,
        urls: {
          // Robinhood Chain's mainnet explorer runs Blockscout.
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com",
        },
      },
      {
        network: "robinhoodTestnet",
        chainId: ROBINHOOD_TESTNET_CHAIN_ID,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
    ],
  },
};

export default config;
