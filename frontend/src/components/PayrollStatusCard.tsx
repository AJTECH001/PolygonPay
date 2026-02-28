"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokenAmount, getTokenInfo, formatDate } from "@/lib/constants";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import type { PayrollStatus } from "@/app/api/payroll/route";

interface Props {
  employer: string;
  onExecute: () => void;
  isExecuting: boolean;
}

export default function PayrollStatusCard({ employer, onExecute, isExecuting }: Props) {
  const [status, setStatus] = useState<PayrollStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employer }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }, [employer]);

  useEffect(() => {
    if (employer) fetchStatus();
  }, [employer, fetchStatus]);

  if (!status && loading) {
    return (
      <Card className="bg-muted/20">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Checking payroll status...
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card className={status.ready ? "border-green-500/40 bg-green-500/5" : "border-border/50"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status.ready ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm text-white">
              {status.ready
                ? `${status.totalDue} employee${status.totalDue !== 1 ? "s" : ""} due for payroll`
                : "No employees due yet"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {status.ready && (
              <Button variant="polygon" size="sm" onClick={onExecute} disabled={isExecuting}>
                {isExecuting ? "Processing..." : "Run Payroll"}
              </Button>
            )}
          </div>
        </div>

        {/* Funding requirements */}
        {status.requirements.length > 0 && (
          <div className="space-y-1.5">
            {status.requirements.map((req, i) => {
              const tokenInfo = getTokenInfo(req.token);
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {req.sufficient ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-destructive" />
                    )}
                    <span className="text-muted-foreground">{tokenInfo.symbol} required:</span>
                    <span className="text-white font-mono">
                      {formatTokenAmount(BigInt(req.required), tokenInfo.decimals)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">available:</span>
                    <span className={req.sufficient ? "text-green-400 font-mono" : "text-destructive font-mono"}>
                      {formatTokenAmount(BigInt(req.available), tokenInfo.decimals)}
                    </span>
                    {!req.sufficient && (
                      <Badge variant="destructive" className="text-xs py-0">Insufficient</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Not-due employees */}
        {status.notDueEmployees.length > 0 && (
          <div className="text-xs text-muted-foreground border-t border-border/30 pt-2">
            {status.notDueEmployees.map((emp, i) => (
              <span key={i} className="mr-3">
                {emp.name}: next {formatDate(emp.nextPaymentAt)}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
