import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { http, defineChain, parseGwei } from "viem";

// Polygon Amoy enforces a minimum 25 Gwei priority fee.
// Overriding defaultPriorityFee ensures wallets (MetaMask etc.) never
// submit with a 0-tip transaction that gets rejected by the network.
const amoy = defineChain({
  ...polygonAmoy,
  fees: {
    defaultPriorityFee: parseGwei("25"),
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "Polygon Payroll",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [amoy],
  transports: {
    [amoy.id]: http(
      process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC ||
        "https://rpc-amoy.polygon.technology/"
    ),
  },
  ssr: true,
});
