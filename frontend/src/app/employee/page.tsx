"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import StreamCounter from "@/components/StreamCounter";
import { useEmployeeInfo } from "@/hooks/usePayrollRegistry";
import type { Employee } from "@/hooks/usePayrollRegistry";
import { formatTokenAmount, getTokenInfo, formatDate, shortenAddress } from "@/lib/constants";
import { UserCircle, Search } from "lucide-react";
import NetworkGuard from "@/components/NetworkGuard";

function EmployeePage() {
  const { address, isConnected } = useAccount();
  const [employerInput, setEmployerInput] = useState("");
  const [employer, setEmployer] = useState<`0x${string}` | undefined>();

  const { data: rawEmployee, refetch } = useEmployeeInfo(employer, address);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <UserCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-white">Connect your wallet</h2>
        <p className="text-muted-foreground text-sm">Connect as an employee to view your payroll</p>
        <ConnectButton />
      </div>
    );
  }

  // Employee tuple from contract — contract returns zero-value struct when not found
  const employee = rawEmployee as Employee | undefined;
  // isActive=false means either not found or deactivated
  const isEmployed = employee?.isActive === true;

  // Only compute tokenInfo when we have a real active employee with a token address
  const tokenInfo = isEmployed && employee?.token ? getTokenInfo(employee.token) : null;

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (employerInput.startsWith("0x") && employerInput.length === 42) {
      setEmployer(employerInput as `0x${string}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Employee Portal</h1>
        <p className="text-muted-foreground text-sm">
          View your salary, stream balance, and payment history.
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Your wallet: {shortenAddress(address!)}
        </p>
      </div>

      {/* Employer Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find Your Employer</CardTitle>
          <CardDescription>Enter your employer&apos;s wallet address to view your payroll details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="0x employer address..."
              value={employerInput}
              onChange={(e) => setEmployerInput(e.target.value)}
              className="font-mono text-sm"
            />
            <Button type="submit" variant="polygon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Employment Not Found */}
      {employer && !isEmployed && (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-center text-muted-foreground">
            No active employment found for your wallet under{" "}
            <span className="font-mono text-sm text-white">{shortenAddress(employer)}</span>.
          </CardContent>
        </Card>
      )}

      {/* Employment Details */}
      {employer && isEmployed && employee && tokenInfo && (
        <div className="space-y-4">
          {/* Employment Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{employee.name}</CardTitle>
                <Badge variant={employee.paymentType === 1 ? "stream" : "success"}>
                  {employee.paymentType === 1 ? "Streaming" : "Lump Sum"}
                </Badge>
              </div>
              <CardDescription>
                {employee.role} · Paying in {tokenInfo.symbol}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Employer</p>
                <p className="font-mono text-xs text-white">{shortenAddress(employer)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Added</p>
                <p className="text-white">{formatDate(Number(employee.addedAt))}</p>
              </div>
              {employee.paymentType === 0 && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Salary</p>
                    <p className="font-bold text-white">
                      {formatTokenAmount(employee.monthlySalary, tokenInfo.decimals)} {tokenInfo.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Paid</p>
                    <p className="text-white">
                      {employee.lastPaidAt > 0n ? formatDate(Number(employee.lastPaidAt)) : "Never"}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Streaming Claim Widget */}
          {employee.paymentType === 1 && (
            <StreamCounter
              employer={employer}
              employee={employee}
              onClaimed={() => refetch()}
            />
          )}

          {/* Lump Sum: next payment info */}
          {employee.paymentType === 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Salary Verification</p>
                <p className="text-white">
                  Your salary of{" "}
                  <span className="font-bold">
                    {formatTokenAmount(employee.monthlySalary, tokenInfo.decimals)} {tokenInfo.symbol}
                  </span>{" "}
                  is recorded onchain. Your employer runs payroll periodically and funds are
                  transferred directly to your wallet.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  All payments are verifiable on{" "}
                  <a
                    href={`https://amoy.polygonscan.com/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-polygon-purple underline"
                  >
                    PolygonScan
                  </a>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmployeePageWithGuard() {
  return (
    <NetworkGuard>
      <EmployeePage />
    </NetworkGuard>
  );
}
