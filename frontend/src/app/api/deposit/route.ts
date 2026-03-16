/**
 * GET /api/deposit?employer=0x...&token=0x...
 *
 * Returns the deposited balance for a specific (employer, token) pair.
 * Use token=0x0000000000000000000000000000000000000000 for native POL.
 *
 * GET /api/deposit?employer=0x...          (no token)
 * Returns balances for all known tokens (POL, USDC, WMATIC) in parallel.
 */
import { NextRequest, NextResponse } from "next/server";
import { viemClient, CONTRACT_ADDRESS, NATIVE_TOKEN } from "@/lib/viemClient";
import { TOKEN_OPTIONS } from "@/lib/constants";
import ABI from "@/abi/PayrollRegistry.json";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") as `0x${string}` | null;
  const tokenParam = req.nextUrl.searchParams.get("token") as `0x${string}` | null;

  if (!employer || !employer.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid employer address" }, { status: 400 });
  }

  try {
    // Single token query
    if (tokenParam) {
      const balance = await viemClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getDeposit",
        args: [employer, tokenParam],
      }) as bigint;

      return NextResponse.json({
        employer,
        token: tokenParam,
        balance: balance.toString(),
      });
    }

    // All tokens query — fetch in parallel
    const tokens = [
      { symbol: "POL", address: NATIVE_TOKEN },
      ...TOKEN_OPTIONS.filter((t) => t.address !== NATIVE_TOKEN),
    ];

    const balances = await Promise.all(
      tokens.map((t) =>
        viemClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "getDeposit",
          args: [employer, t.address as `0x${string}`],
        }) as Promise<bigint>
      )
    );

    const result = tokens.map((t, i) => ({
      symbol: t.symbol,
      token: t.address,
      balance: balances[i].toString(),
    }));

    return NextResponse.json({ employer, deposits: result });
  } catch (err: unknown) {
    console.error("[/api/deposit] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch deposit balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
