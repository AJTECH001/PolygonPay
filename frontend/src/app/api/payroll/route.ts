import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { polygonAmoy } from "viem/chains";
import ABI from "@/abi/PayrollRegistry.json";

const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ||
  "0x0000000000000000000000000000000000000000";

const client = createPublicClient({
  chain: polygonAmoy,
  transport: http(
    process.env.NEXT_PUBLIC_POLYGON_AMOY_RPC ||
      "https://rpc-amoy.polygon.technology/"
  ),
});

interface Employee {
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

interface PayrollRequirement {
  token: string;
  required: bigint;
  available: bigint;
  sufficient: boolean;
}

export interface PayrollStatus {
  ready: boolean;
  dueEmployees: { wallet: string; name: string; role: string; token: string; amount: string }[];
  notDueEmployees: { wallet: string; name: string; nextPaymentAt: number }[];
  requirements: PayrollRequirement[];
  totalDue: number;
  payrollInterval: number;
}

export async function POST(req: NextRequest) {
  let employer: `0x${string}`;

  try {
    const body = await req.json();
    employer = body.employer;
    if (!employer || !employer.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid employer address" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // Fetch company + employees in parallel
    const [companyResult, employeesResult] = await Promise.all([
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "companies",
        args: [employer],
      }) as Promise<[string, string, boolean, bigint, bigint]>,
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getEmployees",
        args: [employer],
      }) as Promise<[string[], Employee[]]>,
    ]);

    const [, , , , payrollInterval] = companyResult;
    const [, employees] = employeesResult;
    const now = BigInt(Math.floor(Date.now() / 1000));

    const dueEmployees: PayrollStatus["dueEmployees"] = [];
    const notDueEmployees: PayrollStatus["notDueEmployees"] = [];

    // Track token requirements
    const tokenRequirements = new Map<string, bigint>();

    for (const emp of employees) {
      if (!emp.isActive || emp.paymentType !== 0) continue; // Skip inactive + streaming

      const isDue =
        emp.lastPaidAt === 0n ||
        now - emp.lastPaidAt >= payrollInterval;

      if (isDue) {
        dueEmployees.push({
          wallet: emp.wallet,
          name: emp.name,
          role: emp.role,
          token: emp.token,
          amount: emp.monthlySalary.toString(),
        });

        const current = tokenRequirements.get(emp.token) ?? 0n;
        tokenRequirements.set(emp.token, current + emp.monthlySalary);
      } else {
        const nextPaymentAt = Number(emp.lastPaidAt + payrollInterval);
        notDueEmployees.push({
          wallet: emp.wallet,
          name: emp.name,
          nextPaymentAt,
        });
      }
    }

    // Check available deposits for each required token
    const requirementChecks: PayrollRequirement[] = [];
    let allSufficient = true;

    for (const [token, required] of tokenRequirements.entries()) {
      const available = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getDeposit",
        args: [employer, token as `0x${string}`],
      }) as bigint;

      const sufficient = available >= required;
      if (!sufficient) allSufficient = false;

      requirementChecks.push({
        token,
        required,
        available,
        sufficient,
      });
    }

    const status: PayrollStatus = {
      ready: dueEmployees.length > 0 && allSufficient,
      dueEmployees,
      notDueEmployees,
      requirements: requirementChecks.map((r) => ({
        ...r,
        required: r.required,
        available: r.available,
      })),
      totalDue: dueEmployees.length,
      payrollInterval: Number(payrollInterval),
    };

    // Serialize BigInts for JSON
    return NextResponse.json(JSON.parse(JSON.stringify(status, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val
    )));
  } catch (err: unknown) {
    console.error("Payroll status error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch payroll status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
