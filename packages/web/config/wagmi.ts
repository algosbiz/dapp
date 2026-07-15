import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhatLocal, robinhoodChain, robinhoodTestnet } from "./chains";

// robinhoodTestnet and hardhatLocal are included alongside robinhoodChain so this app
// can be tested end-to-end (first locally, then against the real testnet infra) before
// going live on mainnet. Drop them from this array once you're ready for production-only.
export const wagmiConfig = getDefaultConfig({
  appName: "WETH Staking",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [robinhoodChain, robinhoodTestnet, hardhatLocal],
  transports: {
    [robinhoodChain.id]: http(
      process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"
    ),
    [robinhoodTestnet.id]: http(
      process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com"
    ),
    [hardhatLocal.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
