/**
 * Shared server-side viem public client for Next.js API routes.
 * Do NOT import this in client components — use wagmi hooks instead.
 */
import { createPublicClient, http, defineChain } from "viem";
import { polygonAmoy } from "viem/chains";

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
  "0xEEe28Afd5077a0Add3D1C59f85B8eaEE49816127";

/** Block when PayrollRegistry was deployed — avoids full-chain log scans */
export const DEPLOY_BLOCK = BigInt(34567860);

export const NATIVE_TOKEN =
  "0x0000000000000000000000000000000000000000" as const;

// Amoy with 25 Gwei priority fee floor (read-only client — gas config not
// needed here, but keeping parity with the frontend wagmi config)
const amoy = defineChain({
  ...polygonAmoy,
  fees: { defaultPriorityFee: BigInt(25_000_000_000) },
});

export const viemClient = createPublicClient({
  chain: amoy,
  transport: http(
    process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC ||
      "https://rpc-amoy.polygon.technology/"
  ),
});
