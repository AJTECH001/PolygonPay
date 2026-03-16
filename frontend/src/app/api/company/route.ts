/**
 * GET /api/company?employer=0x...
 *
 * Returns company registration details for a given employer address.
 * Used by both employer dashboard and employee portal.
 */
import { NextRequest, NextResponse } from "next/server";
import { viemClient, CONTRACT_ADDRESS } from "@/lib/viemClient";
import ABI from "@/abi/PayrollRegistry.json";

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") as `0x${string}` | null;

  if (!employer || !employer.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid employer address" }, { status: 400 });
  }

  try {
    const result = await viemClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "companies",
      args: [employer],
    }) as [string, string, boolean, bigint, bigint];

    const [name, description, isRegistered, createdAt, payrollInterval] = result;

    return NextResponse.json({
      company: {
        name,
        description,
        isRegistered,
        createdAt: createdAt.toString(),
        payrollInterval: payrollInterval.toString(),
        employer,
      },
    });
  } catch (err: unknown) {
    console.error("[/api/company] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch company";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
