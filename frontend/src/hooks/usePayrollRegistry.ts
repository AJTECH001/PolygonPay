"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCallback } from "react";
import { CONTRACT_ADDRESS, NATIVE_TOKEN } from "@/lib/constants";
import ABI from "@/abi/PayrollRegistry.json";
import { parseEther } from "viem";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Employee {
  wallet: `0x${string}`;
  name: string;
  role: string;
  token: `0x${string}`;
  monthlySalary: bigint;
  streamRate: bigint;
  paymentType: number; // 0 = LUMP_SUM, 1 = STREAMING
  isActive: boolean;
  addedAt: bigint;
  lastPaidAt: bigint;
  streamStartedAt: bigint;
  streamClaimedAmount: bigint;
}

export interface Company {
  name: string;
  description: string;
  isRegistered: boolean;
  createdAt: bigint;
  payrollInterval: bigint;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useCompany(employer?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "companies",
    args: employer ? [employer] : undefined,
    query: { enabled: !!employer },
  });
}

export function useIsRegistered(employer?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "isRegistered",
    args: employer ? [employer] : undefined,
    query: { enabled: !!employer },
  });
}

export function useEmployees(employer?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getEmployees",
    args: employer ? [employer] : undefined,
    query: { enabled: !!employer },
  });
}

export function useDeposit(employer?: `0x${string}`, token?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getDeposit",
    args: employer && token ? [employer, token] : undefined,
    query: { enabled: !!(employer && token) },
  });
}

export function useStreamableAmount(employer?: `0x${string}`, employee?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "getStreamableAmount",
    args: employer && employee ? [employer, employee] : undefined,
    query: { enabled: !!(employer && employee) },
  });
}

export function useNextPayrollAt(employer?: `0x${string}`, employee?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "nextPayrollAt",
    args: employer && employee ? [employer, employee] : undefined,
    query: { enabled: !!(employer && employee) },
  });
}

export function useEmployeeInfo(employer?: `0x${string}`, employee?: `0x${string}`) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "employees",
    args: employer && employee ? [employer, employee] : undefined,
    query: { enabled: !!(employer && employee) },
  });
}

// ── Writes ────────────────────────────────────────────────────────────────────

export function useRegisterCompany() {
  const { writeContractAsync, isPending } = useWriteContract();

  const register = useCallback(
    (name: string, description: string, payrollInterval: bigint) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "registerCompany",
        args: [name, description, payrollInterval],
      }),
    [writeContractAsync]
  );

  return { register, isPending };
}

export function useAddEmployee() {
  const { writeContractAsync, isPending } = useWriteContract();

  const addEmployee = useCallback(
    (
      wallet: `0x${string}`,
      name: string,
      role: string,
      token: `0x${string}`,
      monthlySalary: bigint,
      streamRate: bigint,
      paymentType: number
    ) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "addEmployee",
        args: [wallet, name, role, token, monthlySalary, streamRate, paymentType],
      }),
    [writeContractAsync]
  );

  return { addEmployee, isPending };
}

export function useRemoveEmployee() {
  const { writeContractAsync, isPending } = useWriteContract();

  const removeEmployee = useCallback(
    (wallet: `0x${string}`) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "removeEmployee",
        args: [wallet],
      }),
    [writeContractAsync]
  );

  return { removeEmployee, isPending };
}

export function useUpdateSalary() {
  const { writeContractAsync, isPending } = useWriteContract();

  const updateSalary = useCallback(
    (wallet: `0x${string}`, newMonthlySalary: bigint, newStreamRate: bigint) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "updateSalary",
        args: [wallet, newMonthlySalary, newStreamRate],
      }),
    [writeContractAsync]
  );

  return { updateSalary, isPending };
}

export function useDepositFunds() {
  const { writeContractAsync, isPending } = useWriteContract();

  const deposit = useCallback(
    (token: `0x${string}`, amount: bigint) => {
      const isNative = token === NATIVE_TOKEN || token.toLowerCase() === NATIVE_TOKEN;
      return writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "depositFunds",
        args: [token, isNative ? 0n : amount],
        value: isNative ? amount : 0n,
      });
    },
    [writeContractAsync]
  );

  return { deposit, isPending };
}

export function useWithdrawFunds() {
  const { writeContractAsync, isPending } = useWriteContract();

  const withdraw = useCallback(
    (token: `0x${string}`, amount: bigint) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "withdrawFunds",
        args: [token, amount],
      }),
    [writeContractAsync]
  );

  return { withdraw, isPending };
}

export function useExecutePayroll() {
  const { writeContractAsync, isPending } = useWriteContract();

  const executePayroll = useCallback(
    () =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "executePayroll",
        args: [],
      }),
    [writeContractAsync]
  );

  return { executePayroll, isPending };
}

export function useClaimStream() {
  const { writeContractAsync, isPending } = useWriteContract();

  const claimStream = useCallback(
    (employer: `0x${string}`) =>
      writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "claimStream",
        args: [employer],
      }),
    [writeContractAsync]
  );

  return { claimStream, isPending };
}

// ── TX Receipt ────────────────────────────────────────────────────────────────

export function useTxReceipt(hash?: `0x${string}`) {
  return useWaitForTransactionReceipt({ hash });
}
