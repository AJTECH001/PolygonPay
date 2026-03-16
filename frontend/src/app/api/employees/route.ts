/**
 * GET /api/employees?employer=0x...
 *
 * Returns the full employee roster for an employer.
 * BigInts are serialized as strings for JSON compatibility.
 */
import { NextRequest, NextResponse } from "next/server";
import { viemClient, CONTRACT_ADDRESS } from "@/lib/viemClient";
import ABI from "@/abi/PayrollRegistry.json";

interface RawEmployee {
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
}

export async function GET(req: NextRequest) {
  const employer = req.nextUrl.searchParams.get("employer") as `0x${string}` | null;

  if (!employer || !employer.startsWith("0x")) {
    return NextResponse.json({ error: "Missing or invalid employer address" }, { status: 400 });
  }

  try {
    const result = await viemClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "getEmployees",
      args: [employer],
    }) as [string[], RawEmployee[]];

    const [wallets, employees] = result;

    const serialized = employees.map((emp, i) => ({
      wallet: wallets[i] ?? emp.wallet,
      name: emp.name,
      role: emp.role,
      token: emp.token,
      monthlySalary: emp.monthlySalary.toString(),
      streamRate: emp.streamRate.toString(),
      paymentType: Number(emp.paymentType), // 0 = LUMP_SUM, 1 = STREAMING
      isActive: emp.isActive,
      addedAt: emp.addedAt.toString(),
      lastPaidAt: emp.lastPaidAt.toString(),
      streamStartedAt: emp.streamStartedAt.toString(),
      streamClaimedAmount: emp.streamClaimedAmount.toString(),
    }));

    return NextResponse.json({
      employer,
      count: serialized.length,
      activeCount: serialized.filter((e) => e.isActive).length,
      employees: serialized,
    });
  } catch (err: unknown) {
    console.error("[/api/employees] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
