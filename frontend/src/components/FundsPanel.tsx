"use client";

import { useState } from "react";
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTRACT_ADDRESS, TOKEN_OPTIONS, formatTokenAmount, parseTokenAmount, getTokenInfo, NATIVE_TOKEN,
} from "@/lib/constants";
import { useDepositFunds, useWithdrawFunds, useDeposit } from "@/hooks/usePayrollRegistry";
import { useToast } from "@/hooks/use-toast";

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface Props {
  employer: `0x${string}`;
  onSuccess: () => void;
}

export default function FundsPanel({ employer, onSuccess }: Props) {
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const { deposit, isPending: isDepositing } = useDepositFunds();
  const { withdraw, isPending: isWithdrawing } = useWithdrawFunds();
  const { writeContractAsync } = useWriteContract();

  const [token, setToken] = useState(TOKEN_OPTIONS[0].address);
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const tokenInfo = getTokenInfo(token);
  const isNative = token === NATIVE_TOKEN;

  const { data: depositBalance, refetch } = useDeposit(employer, token as `0x${string}`);

  // Live allowance for the connected employer address on selected ERC-20
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: isNative ? undefined : (token as `0x${string}`),
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [employer, CONTRACT_ADDRESS],
    query: { enabled: !isNative },
  });

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!depositAmt) return;
    try {
      const amount = parseTokenAmount(depositAmt, tokenInfo.decimals);

      // ERC-20: approve first if allowance is insufficient
      if (!isNative) {
        const currentAllowance = allowance ?? 0n;
        if (currentAllowance < amount) {
          setIsApproving(true);
          try {
            const approveTxHash = await writeContractAsync({
              address: token as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [CONTRACT_ADDRESS, amount],
            });
            // Wait for approval to be mined before depositing
            await publicClient?.waitForTransactionReceipt({ hash: approveTxHash });
            await refetchAllowance();
          } finally {
            setIsApproving(false);
          }
        }
      }

      await deposit(token as `0x${string}`, amount);
      toast({
        title: "Funds deposited",
        description: `${depositAmt} ${tokenInfo.symbol} added to payroll pool.`,
        variant: "success",
      });
      setDepositAmt("");
      refetch();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawAmt) return;
    try {
      const amount = parseTokenAmount(withdrawAmt, tokenInfo.decimals);
      await withdraw(token as `0x${string}`, amount);
      toast({ title: "Funds withdrawn", variant: "success" });
      setWithdrawAmt("");
      refetch();
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  const balanceBigInt = typeof depositBalance === "bigint" ? depositBalance : 0n;

  const depositButtonLabel = isApproving
    ? "Approving..."
    : isDepositing
    ? "Depositing..."
    : `Deposit ${tokenInfo.symbol}`;

  return (
    <div className="space-y-4">
      {/* Token Selector */}
      <div className="space-y-1.5">
        <Label>Token</Label>
        <Select value={token} onValueChange={setToken}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOKEN_OPTIONS.map((t) => (
              <SelectItem key={t.address} value={t.address}>
                {t.symbol} — {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Balance */}
      <Card className="bg-polygon-purple/10 border-polygon-purple/30">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Contract Balance ({tokenInfo.symbol})</span>
          <span className="font-bold text-white text-lg">
            {formatTokenAmount(balanceBigInt, tokenInfo.decimals)}
          </span>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Deposit */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deposit Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeposit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount ({tokenInfo.symbol})</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                  required
                />
                {!isNative && (
                  <p className="text-xs text-muted-foreground">
                    {isApproving
                      ? `Approving ${tokenInfo.symbol} spend — confirm in your wallet.`
                      : `Approval will be requested automatically if needed.`}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                variant="polygon"
                className="w-full"
                disabled={isDepositing || isApproving}
              >
                {depositButtonLabel}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Withdraw Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleWithdraw} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount ({tokenInfo.symbol})</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Available: {formatTokenAmount(balanceBigInt, tokenInfo.decimals)} {tokenInfo.symbol}
                </p>
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={isWithdrawing}>
                {isWithdrawing ? "Confirming..." : "Withdraw"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
