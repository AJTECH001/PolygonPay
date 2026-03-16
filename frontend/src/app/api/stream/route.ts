/**
 * GET /api/stream?employer=0x...&employee=0x...
 *
 * Returns the real-time claimable streaming balance for an employee.
 * This mirrors the on-chain formula:
 *   claimable = (now - streamStartedAt) × streamRate - streamClaimedAmount
 *
 * The contract computes this authoritatively — this route exposes it for
 * display in the employee portal without requiring a wallet connection.
 */
import { NextRequest, NextResponse } from "next/server";
import { viemClient, CONTRACT_ADDRESS } from "@/lib/viemClient";
import ABI from "@/abi/PayrollRegistry.json";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") as `0x${string}` | null;
  const employee = req.nextUrl.searchParams.get("employee") as `0x${string}` | null;

  if (!employer || !employer.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid employer address" }, { status: 400 });
  }
  if (!employee || !employee.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid employee address" }, { status: 400 });
  }

  try {
    // Read employee record and streamable amount in parallel
    const [empResult, streamable] = await Promise.all([
      viemClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "employees",
        args: [employer, employee],
      }) as Promise<{
        wallet: string;
        name: string;
        role: string;
        token: string;
        monthlySalary: bigint;
        streamRate: bigint;
        paymentType: number;
        isActive: boolean;
        addedAt: bigint;
        lastPaidAt: bigint;
        streamStartedAt: bigint;
        streamClaimedAmount: bigint;
      }>,
      viemClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getStreamableAmount",
        args: [employer, employee],
      }) as Promise<bigint>,
    ]);

    const isStreaming = Number(empResult.paymentType) === 1;

    return NextResponse.json({
      employer,
      employee,
      isStreaming,
      isActive: empResult.isActive,
      token: empResult.token,
      streamRate: empResult.streamRate.toString(),        // tokens per second
      streamStartedAt: empResult.streamStartedAt.toString(),
      streamClaimedAmount: empResult.streamClaimedAmount.toString(),
      claimableNow: streamable.toString(),               // authoritative on-chain value
      fetchedAt: Math.floor(Date.now() / 1000),          // unix ts for client-side interpolation
    });
  } catch (err: unknown) {
    console.error("[/api/stream] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch stream data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
