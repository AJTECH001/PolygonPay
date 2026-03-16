/**
 * GET /api/admin/stats
 *
 * Aggregates all on-chain activity from the PayrollRegistry contract:
 * - TVL (FundsDeposited - FundsWithdrawn per token)
 * - Total employers (CompanyRegistered events)
 * - Total active employees (EmployeeAdded - EmployeeRemoved)
 * - Total paid out (EmployeePaid + StreamClaimed per token)
 * - Per-employer details with employee counts and deposit balances
 * - Last 20 events across all event types
 */
import { NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { viemClient, CONTRACT_ADDRESS, DEPLOY_BLOCK } from "@/lib/viemClient";
import { TOKEN_OPTIONS } from "@/lib/constants";
import ABI from "@/abi/PayrollRegistry.json";

const COMPANY_REGISTERED = parseAbiItem(
  "event CompanyRegistered(address indexed employer, string name, uint256 payrollInterval, uint256 timestamp)"
);
const EMPLOYEE_ADDED = parseAbiItem(
  "event EmployeeAdded(address indexed employer, address indexed employee, string name, uint8 paymentType, address token)"
);
const EMPLOYEE_REMOVED = parseAbiItem(
  "event EmployeeRemoved(address indexed employer, address indexed employee, uint256 timestamp)"
);
const EMPLOYEE_PAID = parseAbiItem(
  "event EmployeePaid(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp)"
);
const STREAM_CLAIMED = parseAbiItem(
  "event StreamClaimed(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp)"
);
const FUNDS_DEPOSITED = parseAbiItem(
  "event FundsDeposited(address indexed employer, address token, uint256 amount, uint256 timestamp)"
);
const FUNDS_WITHDRAWN = parseAbiItem(
  "event FundsWithdrawn(address indexed employer, address token, uint256 amount, uint256 timestamp)"
);
const PAYROLL_EXECUTED = parseAbiItem(
  "event PayrollExecuted(address indexed employer, uint256 timestamp, uint256 paidCount)"
);

export async function GET() {
  try {
    // Fetch all event types in parallel
    const [
      companyLogs,
      addedLogs,
      removedLogs,
      paidLogs,
      streamLogs,
      depositedLogs,
      withdrawnLogs,
      payrollLogs,
    ] = await Promise.all([
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: COMPANY_REGISTERED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: EMPLOYEE_ADDED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: EMPLOYEE_REMOVED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: EMPLOYEE_PAID, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: STREAM_CLAIMED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: FUNDS_DEPOSITED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: FUNDS_WITHDRAWN, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
      viemClient.getLogs({ address: CONTRACT_ADDRESS, event: PAYROLL_EXECUTED, fromBlock: DEPLOY_BLOCK, toBlock: "latest" }),
    ]);

    // ── Aggregate stats ──────────────────────────────────────────────────────

    const totalEmployers = companyLogs.length;
    const totalActiveEmployees = addedLogs.length - removedLogs.length;
    const totalPayrollRuns = payrollLogs.length;
    const totalTransactions = paidLogs.length + streamLogs.length;

    // TVL = deposited - withdrawn per token (current locked value)
    const tvlRaw: Record<string, bigint> = {};
    for (const log of depositedLogs) {
      const { token, amount } = log.args as { token: string; amount: bigint };
      const key = token.toLowerCase();
      tvlRaw[key] = (tvlRaw[key] ?? 0n) + amount;
    }
    for (const log of withdrawnLogs) {
      const { token, amount } = log.args as { token: string; amount: bigint };
      const key = token.toLowerCase();
      tvlRaw[key] = (tvlRaw[key] ?? 0n) - amount;
    }

    // Total paid out per token (lump-sum + stream claims)
    const totalPaidRaw: Record<string, bigint> = {};
    for (const log of [...paidLogs, ...streamLogs]) {
      const { token, amount } = log.args as { token: string; amount: bigint };
      const key = token.toLowerCase();
      totalPaidRaw[key] = (totalPaidRaw[key] ?? 0n) + amount;
    }

    // ── Per-employer details ─────────────────────────────────────────────────
    const employers = await Promise.all(
      companyLogs.map(async (log) => {
        const { employer: addr, name, payrollInterval, timestamp } =
          log.args as { employer: string; name: string; payrollInterval: bigint; timestamp: bigint };
        const employer = addr as `0x${string}`;

        // Get employees + deposits in parallel
        const [empResult, ...balances] = await Promise.all([
          viemClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: "getEmployees",
            args: [employer],
          }) as Promise<[string[], { isActive: boolean; paymentType: number }[]]>,
          ...TOKEN_OPTIONS.map((t) =>
            viemClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: ABI,
              functionName: "getDeposit",
              args: [employer, t.address as `0x${string}`],
            }) as Promise<bigint>
          ),
        ]);

        const [, emps] = empResult;
        const activeEmployees = emps.filter((e) => e.isActive).length;
        const streamingEmployees = emps.filter((e) => e.isActive && Number(e.paymentType) === 1).length;

        const deposits: Record<string, string> = {};
        TOKEN_OPTIONS.forEach((t, i) => {
          if (balances[i] > 0n) deposits[t.symbol] = balances[i].toString();
        });

        // Count payroll runs for this employer
        const employerPayrolls = payrollLogs.filter(
          (l) => (l.args as { employer: string }).employer.toLowerCase() === employer.toLowerCase()
        ).length;

        return {
          address: employer,
          name,
          registeredAt: Number(timestamp),
          payrollInterval: Number(payrollInterval),
          totalEmployees: emps.length,
          activeEmployees,
          streamingEmployees,
          payrollRuns: employerPayrolls,
          deposits,
        };
      })
    );

    // ── Recent events feed (last 20) ─────────────────────────────────────────
    const recentEvents = [
      ...companyLogs.map((l) => {
        const a = l.args as { employer: string; name: string; timestamp: bigint };
        return { type: "CompanyRegistered", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: Number(a.timestamp), employer: a.employer, label: `${a.name} registered` };
      }),
      ...addedLogs.map((l) => {
        const a = l.args as { employer: string; employee: string; name: string; paymentType: number; token: string };
        return { type: "EmployeeAdded", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: 0, employer: a.employer, employee: a.employee, label: `${a.name} added` };
      }),
      ...depositedLogs.map((l) => {
        const a = l.args as { employer: string; token: string; amount: bigint; timestamp: bigint };
        return { type: "FundsDeposited", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: Number(a.timestamp), employer: a.employer, token: a.token, amount: a.amount.toString(), label: "Funds deposited" };
      }),
      ...paidLogs.map((l) => {
        const a = l.args as { employer: string; employee: string; token: string; amount: bigint; timestamp: bigint };
        return { type: "EmployeePaid", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: Number(a.timestamp), employer: a.employer, employee: a.employee, token: a.token, amount: a.amount.toString(), label: "Employee paid" };
      }),
      ...streamLogs.map((l) => {
        const a = l.args as { employer: string; employee: string; token: string; amount: bigint; timestamp: bigint };
        return { type: "StreamClaimed", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: Number(a.timestamp), employer: a.employer, employee: a.employee, token: a.token, amount: a.amount.toString(), label: "Stream claimed" };
      }),
      ...payrollLogs.map((l) => {
        const a = l.args as { employer: string; timestamp: bigint; paidCount: bigint };
        return { type: "PayrollExecuted", txHash: l.transactionHash, blockNumber: l.blockNumber?.toString(), timestamp: Number(a.timestamp), employer: a.employer, paidCount: Number(a.paidCount), label: `Payroll run — ${a.paidCount} paid` };
      }),
    ]
      .sort((a, b) => (b.blockNumber ?? "0") > (a.blockNumber ?? "0") ? 1 : -1)
      .slice(0, 20);

    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          {
            totalEmployers,
            totalActiveEmployees,
            totalPayrollRuns,
            totalTransactions,
            tvl: tvlRaw,
            totalPaid: totalPaidRaw,
            employers,
            recentEvents,
            fetchedAt: Date.now(),
          },
          (_, v) => (typeof v === "bigint" ? v.toString() : v)
        )
      )
    );
  } catch (err: unknown) {
    console.error("[/api/admin/stats] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch admin stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
