import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { polygonAmoy } from "wagmi/chains";
import { http } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "Polygon Payroll",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: http(
      process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC ||
        "https://rpc-amoy.polygon.technology/"
    ),
  },
  ssr: true,
});
