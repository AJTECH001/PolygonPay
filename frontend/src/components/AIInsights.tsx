"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTokenInfo, formatTokenAmount } from "@/lib/constants";
import type { Employee } from "@/hooks/usePayrollRegistry";
import { Sparkles, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";

interface Props {
  companyName: string;
  employees: Employee[];
}

interface AnalysisResult {
  anomalies: { title: string; description: string; severity: "high" | "medium" | "low" }[];
  insights: { title: string; description: string }[];
  recommendations: { title: string; description: string }[];
}

const severityColor = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

export default function AIInsights({ companyName, employees }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);

    const payrollData = {
      company: companyName,
      employees: employees
        .filter((e) => e.isActive)
        .map((e) => {
          const tokenInfo = getTokenInfo(e.token);
          return {
            name: e.name,
            role: e.role,
            paymentType: e.paymentType === 0 ? "lump_sum" : "streaming",
            token: tokenInfo.symbol,
            monthlySalary: e.paymentType === 0
              ? formatTokenAmount(e.monthlySalary, tokenInfo.decimals)
              : null,
            streamRatePerSecond: e.paymentType === 1
              ? (Number(e.streamRate) / 10 ** tokenInfo.decimals).toExponential(6)
              : null,
            daysSinceAdded: Math.floor((Date.now() / 1000 - Number(e.addedAt)) / 86400),
            lastPaidDaysAgo: e.lastPaidAt > 0n
              ? Math.floor((Date.now() / 1000 - Number(e.lastPaidAt)) / 86400)
              : null,
          };
        }),
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrollData }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-polygon-purple" />
            AI Payroll Analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Claude AI analyzes your payroll for anomalies and optimizations.
          </p>
        </div>
        <Button onClick={runAnalysis} variant="polygon" disabled={loading || employees.length === 0}>
          {loading ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Anomalies */}
          {analysis.anomalies.length > 0 && (
            <Card className="border-yellow-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Anomalies Detected ({analysis.anomalies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.anomalies.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Badge variant={severityColor[a.severity]} className="mt-0.5 shrink-0">
                      {a.severity}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm text-white">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          {analysis.insights.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.insights.map((insight, i) => (
                  <div key={i}>
                    <p className="font-medium text-sm text-white">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <Card className="border-polygon-purple/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-polygon-purple" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <div key={i}>
                    <p className="font-medium text-sm text-white">{rec.title}</p>
                    <p className="text-xs text-muted-foreground">{rec.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!analysis && !loading && (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Click &quot;Run Analysis&quot; to get AI-powered payroll insights
          </CardContent>
        </Card>
      )}
    </div>
  );
}
