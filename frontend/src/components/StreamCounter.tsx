"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTokenAmount, getTokenInfo } from "@/lib/constants";
import type { Employee } from "@/hooks/usePayrollRegistry";
import { useClaimStream } from "@/hooks/usePayrollRegistry";
import { useToast } from "@/hooks/use-toast";

interface Props {
  employer: `0x${string}`;
  employee: Employee;
  onClaimed: () => void;
}

export default function StreamCounter({ employer, employee, onClaimed }: Props) {
  const { claimStream, isPending } = useClaimStream();
  const { toast } = useToast();
  const tokenInfo = getTokenInfo(employee.token);

  // Calculate claimable amount live — updates every second
  const [claimable, setClaimable] = useState<bigint>(0n);

  useEffect(() => {
    function calculate() {
      const now = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = now - employee.streamStartedAt;
      const totalEarned = elapsed * employee.streamRate;
      const unclaimed =
        totalEarned > employee.streamClaimedAmount
          ? totalEarned - employee.streamClaimedAmount
          : 0n;
      setClaimable(unclaimed);
    }

    calculate();
    const id = setInterval(calculate, 1000);
    return () => clearInterval(id);
  }, [employee.streamRate, employee.streamStartedAt, employee.streamClaimedAmount]);

  async function handleClaim() {
    try {
      await claimStream(employer);
      toast({ title: "Stream claimed!", description: `Tokens sent to your wallet.`, variant: "success" });
      onClaimed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  const displayAmount = formatTokenAmount(claimable, tokenInfo.decimals);
  const ratePerHour = (Number(employee.streamRate) / 10 ** tokenInfo.decimals) * 3600;

  return (
    <Card className="border-polygon-purple/40 bg-polygon-purple/5">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Accrued & Claimable
            </p>
            <div className="text-4xl font-bold text-white tabular-nums animate-pulse_stream">
              {displayAmount}
            </div>
            <p className="text-sm text-polygon-purple mt-1">{tokenInfo.symbol}</p>
            <p className="text-xs text-muted-foreground mt-2">
              ~{ratePerHour.toFixed(4)} {tokenInfo.symbol}/hr — streaming live
            </p>
          </div>

          <Button
            variant="polygon"
            size="lg"
            onClick={handleClaim}
            disabled={isPending || claimable === 0n}
          >
            {isPending ? "Claiming..." : "Claim Now"}
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Total Claimed</p>
            <p className="font-medium text-white">
              {formatTokenAmount(employee.streamClaimedAmount, tokenInfo.decimals)} {tokenInfo.symbol}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stream Rate</p>
            <p className="font-medium text-white font-mono text-xs">
              {(Number(employee.streamRate) / 10 ** tokenInfo.decimals).toExponential(4)} {tokenInfo.symbol}/s
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
