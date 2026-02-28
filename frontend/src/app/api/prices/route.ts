import { NextResponse } from "next/server";

// Cache prices for 60 seconds to avoid rate-limiting CoinGecko
let cache: { prices: TokenPrices; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export interface TokenPrices {
  POL: number;
  USDC: number;
  WMATIC: number;
  [symbol: string]: number;
}

export async function GET() {
  // Return cached prices if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ prices: cache.prices, cached: true });
  }

  try {
    // CoinGecko free API — no key required for basic use
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=matic-network,usd-coin&vs_currencies=usd",
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) throw new Error(`CoinGecko responded with ${res.status}`);

    const data = await res.json() as {
      "matic-network"?: { usd: number };
      "usd-coin"?: { usd: number };
    };

    const prices: TokenPrices = {
      POL: data["matic-network"]?.usd ?? 0,
      WMATIC: data["matic-network"]?.usd ?? 0,
      USDC: data["usd-coin"]?.usd ?? 1,
    };

    cache = { prices, fetchedAt: Date.now() };

    return NextResponse.json({ prices, cached: false });
  } catch (err: unknown) {
    console.error("Price fetch error:", err);

    // Fall back to cache even if stale, or return safe defaults
    if (cache) {
      return NextResponse.json({ prices: cache.prices, cached: true, stale: true });
    }

    // Hard fallback — USDC is always $1, POL approximate
    return NextResponse.json({
      prices: { POL: 0, WMATIC: 0, USDC: 1 } as TokenPrices,
      cached: false,
      error: "Price feed unavailable",
    });
  }
}
