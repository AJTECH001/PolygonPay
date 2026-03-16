import { NextRequest, NextResponse } from "next/server";
import { parseAbiItem } from "viem";
import { viemClient as client, CONTRACT_ADDRESS, DEPLOY_BLOCK } from "@/lib/viemClient";

// Parse individual event signatures
const EMPLOYEE_PAID_EVENT = parseAbiItem(
  "event EmployeePaid(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp)"
);

const STREAM_CLAIMED_EVENT = parseAbiItem(
  "event StreamClaimed(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp)"
);

const PAYROLL_EXECUTED_EVENT = parseAbiItem(
  "event PayrollExecuted(address indexed employer, uint256 timestamp, uint256 paidCount)"
);

export interface PaymentEvent {
  type: "lump_sum" | "stream_claim" | "payroll_run";
  txHash: string;
  blockNumber: string;
  employer: string;
  employee: string | null;
  token: string;
  amount: string;
  timestamp: number;
  paidCount?: number;
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
    // Fetch all three event types in parallel
    const [paidLogs, streamLogs, payrollLogs] = await Promise.all([
      client.getLogs({
        address: CONTRACT_ADDRESS,
        event: EMPLOYEE_PAID_EVENT,
        args: { employer },
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      }),
      client.getLogs({
        address: CONTRACT_ADDRESS,
        event: STREAM_CLAIMED_EVENT,
        args: { employer },
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      }),
      client.getLogs({
        address: CONTRACT_ADDRESS,
        event: PAYROLL_EXECUTED_EVENT,
        args: { employer },
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      }),
    ]);

    const events: PaymentEvent[] = [];

    for (const log of paidLogs) {
      const args = log.args as {
        employer: string;
        employee: string;
        token: string;
        amount: bigint;
        timestamp: bigint;
      };
      events.push({
        type: "lump_sum",
        txHash: log.transactionHash ?? "",
        blockNumber: log.blockNumber?.toString() ?? "",
        employer: args.employer,
        employee: args.employee,
        token: args.token,
        amount: args.amount.toString(),
        timestamp: Number(args.timestamp),
      });
    }

    for (const log of streamLogs) {
      const args = log.args as {
        employer: string;
        employee: string;
        token: string;
        amount: bigint;
        timestamp: bigint;
      };
      events.push({
        type: "stream_claim",
        txHash: log.transactionHash ?? "",
        blockNumber: log.blockNumber?.toString() ?? "",
        employer: args.employer,
        employee: args.employee,
        token: args.token,
        amount: args.amount.toString(),
        timestamp: Number(args.timestamp),
      });
    }

    for (const log of payrollLogs) {
      const args = log.args as {
        employer: string;
        timestamp: bigint;
        paidCount: bigint;
      };
      events.push({
        type: "payroll_run",
        txHash: log.transactionHash ?? "",
        blockNumber: log.blockNumber?.toString() ?? "",
        employer: args.employer,
        employee: null,
        token: "",
        amount: "0",
        timestamp: Number(args.timestamp),
        paidCount: Number(args.paidCount),
      });
    }

    // Sort newest first
    events.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ events });
  } catch (err: unknown) {
    console.error("Events fetch error:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
