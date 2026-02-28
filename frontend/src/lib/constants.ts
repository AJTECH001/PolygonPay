import { polygonAmoy } from "wagmi/chains";

// ── Contract ──────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

export const CHAIN_ID = polygonAmoy.id; // 80002

// ── Native Token ──────────────────────────────────────────────────────────────

export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000" as const;

// ── Known Tokens on Polygon Amoy Testnet ──────────────────────────────────────

export const KNOWN_TOKENS: Record<
  string,
  { symbol: string; decimals: number; name: string }
> = {
  [NATIVE_TOKEN]: { symbol: "POL", decimals: 18, name: "Polygon (Native)" },
  // Circle USDC on Amoy — verify at https://developers.circle.com/stablecoins/docs/usdc-on-test-networks
  "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582": {
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
  },
  // WMATIC on Amoy
  "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9": {
    symbol: "WMATIC",
    decimals: 18,
    name: "Wrapped MATIC",
  },
};

export const TOKEN_OPTIONS = Object.entries(KNOWN_TOKENS).map(
  ([address, info]) => ({
    address,
    ...info,
  })
);

// ── Payment Types ─────────────────────────────────────────────────────────────

export const PAYMENT_TYPES = {
  LUMP_SUM: 0,
  STREAMING: 1,
} as const;

export type PaymentTypeValue = (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getTokenInfo(address: string | undefined | null) {
  if (!address) return { symbol: "ERC-20", decimals: 18, name: "Unknown Token" };
  const normalized = address.toLowerCase();
  const entry = Object.entries(KNOWN_TOKENS).find(
    ([addr]) => addr.toLowerCase() === normalized
  );
  return entry
    ? entry[1]
    : { symbol: "ERC-20", decimals: 18, name: "Unknown Token" };
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 4);
  return `${whole}.${fracStr}`;
}

/**
 * Convert a human-readable amount (e.g. "100.5") and decimals into the
 * smallest unit bigint expected by the contract.
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + fracPadded);
}

/**
 * Convert a monthly salary in human-readable form to per-second stream rate
 * in the token's smallest unit.
 * Assumes 30 days per month.
 */
export function monthlyToStreamRate(
  monthlyAmount: string,
  decimals: number
): bigint {
  const monthly = parseTokenAmount(monthlyAmount, decimals);
  const SECONDS_PER_MONTH = BigInt(30 * 24 * 3600);
  return monthly / SECONDS_PER_MONTH;
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
