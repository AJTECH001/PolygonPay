"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokenAmount, getTokenInfo, shortenAddress, formatDate } from "@/lib/constants";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { PaymentEvent } from "@/app/api/events/route";

interface Props {
  employer: string;
}

const TYPE_LABELS: Record<PaymentEvent["type"], string> = {
  lump_sum: "Payroll",
  stream_claim: "Stream Claim",
  payroll_run: "Payroll Run",
};

const TYPE_VARIANTS: Record<
  PaymentEvent["type"],
  "success" | "stream" | "secondary"
> = {
  lump_sum: "success",
  stream_claim: "stream",
  payroll_run: "secondary",
};

export default function PaymentHistory({ employer }: Props) {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employer }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setLastFetched(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [employer]);

  useEffect(() => {
    if (employer) fetchEvents();
  }, [employer, fetchEvents]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">Payment History</h3>
          {lastFetched && (
            <p className="text-xs text-muted-foreground">
              Last updated {lastFetched.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEvents}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && events.length === 0 && !error && (
        <Card className="border-dashed bg-muted/10">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No payment history yet. Execute payroll or have an employee claim their stream.
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {["Type", "Employee", "Token", "Amount", "Date", "TX"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {events.map((ev, i) => {
                const tokenInfo = ev.token ? getTokenInfo(ev.token) : null;
                return (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_VARIANTS[ev.type]}>
                        {TYPE_LABELS[ev.type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {ev.employee ? shortenAddress(ev.employee) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {tokenInfo ? (
                        <Badge variant="outline">{tokenInfo.symbol}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-white">
                      {tokenInfo && ev.amount !== "0"
                        ? formatTokenAmount(BigInt(ev.amount), tokenInfo.decimals)
                        : ev.type === "payroll_run"
                        ? `${ev.paidCount} paid`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(ev.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      {ev.txHash && (
                        <a
                          href={`https://amoy.polygonscan.com/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-polygon-purple hover:text-polygon-purple/80 inline-flex items-center gap-1 text-xs"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
