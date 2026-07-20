import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhatLocal, robinhoodChain, robinhoodTestnet } from "./chains";

// robinhoodTestnet is listed first because every contract this app talks to is currently
// deployed there — with no wallet connected, wagmi reads fall back to chains[0], so this
// order is what makes disconnected reads (e.g. rewardPerSecond on /farm) resolve against
// the right chain instead of silently querying the empty mainnet address.
// robinhoodChain and hardhatLocal stay available for the wallet's network switcher; drop
// robinhoodChain once contracts actually deploy to mainnet and this goes production-only.
export const wagmiConfig = getDefaultConfig({
  appName: "WETH Staking",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  chains: [robinhoodTestnet, robinhoodChain, hardhatLocal],
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
