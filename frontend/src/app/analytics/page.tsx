"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTRACT_ADDRESS,
  TOKEN_OPTIONS,
  NATIVE_TOKEN,
  formatTokenAmount,
  formatDate,
  shortenAddress,
  getTokenInfo,
} from "@/lib/constants";
import {
  Users, Building2, Wallet, ArrowUpDown, RefreshCw,
  ExternalLink, Activity, TrendingUp, Coins, Search,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmployerDetail {
  address: string;
  name: string;
  registeredAt: number;
  payrollInterval: number;
  totalEmployees: number;
  activeEmployees: number;
  streamingEmployees: number;
  payrollRuns: number;
  deposits: Record<string, string>;
}

interface RecentEvent {
  type: string;
  txHash: string | null;
  blockNumber: string;
  timestamp: number;
  employer: string;
  employee?: string;
  token?: string;
  amount?: string;
  paidCount?: number;
  label: string;
}

interface AdminStats {
  totalEmployers: number;
  totalActiveEmployees: number;
  totalPayrollRuns: number;
  totalTransactions: number;
  tvl: Record<string, string>;
  totalPaid: Record<string, string>;
  employers: EmployerDetail[];
  recentEvents: RecentEvent[];
  fetchedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventBadgeColor(type: string) {
  switch (type) {
    case "CompanyRegistered":  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "EmployeeAdded":      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "FundsDeposited":     return "bg-polygon-purple/20 text-polygon-purple border-polygon-purple/30";
    case "EmployeePaid":       return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "StreamClaimed":      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "PayrollExecuted":    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default:                   return "bg-muted text-muted-foreground";
  }
}

function TVLDisplay({ tvl }: { tvl: Record<string, string> }) {
  const tokens = TOKEN_OPTIONS.map((t) => {
    const key = t.address.toLowerCase();
    const raw = BigInt(tvl[key] ?? "0");
    return { ...t, raw, formatted: formatTokenAmount(raw, t.decimals) };
  }).filter((t) => t.raw > 0n);

  if (tokens.length === 0) return <span className="text-muted-foreground text-sm">No funds locked</span>;
  return (
    <div className="space-y-1">
      {tokens.map((t) => (
        <div key={t.address} className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">{t.formatted}</span>
          <span className="text-polygon-purple font-medium">{t.symbol}</span>
        </div>
      ))}
    </div>
  );
}

function TotalPaidDisplay({ totalPaid }: { totalPaid: Record<string, string> }) {
  const tokens = TOKEN_OPTIONS.map((t) => {
    const key = t.address.toLowerCase();
    const raw = BigInt(totalPaid[key] ?? "0");
    return { ...t, raw, formatted: formatTokenAmount(raw, t.decimals) };
  }).filter((t) => t.raw > 0n);

  if (tokens.length === 0) return <span className="text-2xl font-bold text-white">0</span>;
  return (
    <div className="space-y-1">
      {tokens.map((t) => (
        <div key={t.address} className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">{t.formatted}</span>
          <span className="text-polygon-purple font-medium">{t.symbol}</span>
        </div>
      ))}
    </div>
  );
}

// ── Contract Reader ───────────────────────────────────────────────────────────

function ContractReader() {
  const [queryType, setQueryType] = useState("company");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleQuery() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let url = "";
      if (queryType === "company")   url = `/api/company?employer=${addr1}`;
      if (queryType === "employees") url = `/api/employees?employer=${addr1}`;
      if (queryType === "deposit")   url = `/api/deposit?employer=${addr1}&token=${addr2 || NATIVE_TOKEN}`;
      if (queryType === "stream")    url = `/api/stream?employer=${addr1}&employee=${addr2}`;
      const res = await fetch(url);
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }

  const queries = [
    { id: "company",   label: "Company Info",      fn: "companies(address)",                      args: 1 },
    { id: "employees", label: "Employee Roster",   fn: "getEmployees(address)",                   args: 1 },
    { id: "deposit",   label: "Deposit Balance",   fn: "getDeposit(employer, token)",             args: 2 },
    { id: "stream",    label: "Stream Balance",    fn: "getStreamableAmount(employer, employee)", args: 2 },
  ];

  const selected = queries.find((q) => q.id === queryType)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-polygon-purple" />
          Contract Reader
        </CardTitle>
        <CardDescription>Query any read function directly from the contract</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Function selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {queries.map((q) => (
            <button
              key={q.id}
              onClick={() => { setQueryType(q.id); setResult(null); setError(""); }}
              className={`text-xs px-3 py-2 rounded border transition-colors text-left ${
                queryType === q.id
                  ? "border-polygon-purple bg-polygon-purple/10 text-polygon-purple"
                  : "border-border/50 text-muted-foreground hover:border-polygon-purple/40"
              }`}
            >
              <div className="font-medium">{q.label}</div>
              <div className="font-mono opacity-70 mt-0.5 text-[10px] truncate">{q.fn}</div>
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{selected.args >= 1 ? "Employer / Address" : ""}</Label>
            <Input
              placeholder="0x..."
              value={addr1}
              onChange={(e) => setAddr1(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          {selected.args === 2 && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                {queryType === "deposit" ? "Token Address (blank = POL)" : "Employee Address"}
              </Label>
              <Input
                placeholder="0x..."
                value={addr2}
                onChange={(e) => setAddr2(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>

        <Button
          variant="polygon"
          size="sm"
          onClick={handleQuery}
          disabled={loading || !addr1}
        >
          {loading ? "Querying..." : "Query Contract"}
        </Button>

        {error && <p className="text-destructive text-xs">{error}</p>}

        {result !== null && (
          <pre className="bg-muted/30 border border-border/50 rounded p-3 text-xs text-white overflow-auto max-h-64 font-mono">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/analytics/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <Badge variant="outline" className="text-polygon-purple border-polygon-purple/40 text-xs">
              Public · On-Chain
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Live on-chain analytics for{" "}
            <a
              href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-polygon-purple hover:underline"
            >
              {shortenAddress(CONTRACT_ADDRESS)}
            </a>
            {" "}· Polygon Amoy
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="h-4 w-4 text-polygon-purple" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">TVL</span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : (
              <TVLDisplay tvl={stats?.tvl ?? {}} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-polygon-purple" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Employers</span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : (
              <span className="text-3xl font-bold text-white">{stats?.totalEmployers ?? 0}</span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-polygon-purple" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Active Employees</span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : (
              <span className="text-3xl font-bold text-white">{stats?.totalActiveEmployees ?? 0}</span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-polygon-purple" />
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid Out</span>
            </div>
            {loading ? (
              <div className="h-8 bg-muted/30 rounded animate-pulse" />
            ) : (
              <TotalPaidDisplay totalPaid={stats?.totalPaid ?? {}} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Payroll Runs", value: stats?.totalPayrollRuns ?? 0, icon: ArrowUpDown },
          { label: "Payment Txns", value: stats?.totalTransactions ?? 0, icon: Activity },
          { label: "Tokens Supported", value: TOKEN_OPTIONS.length, icon: Coins },
          { label: "Network", value: "Amoy", icon: Wallet },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-card/30 border-border/40">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold text-white">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Employer Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-polygon-purple" />
              Registered Employers
            </CardTitle>
            <CardDescription>All companies registered on the contract</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.employers.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No companies registered yet</p>
            ) : (
              <div className="space-y-3">
                {stats?.employers.map((emp) => (
                  <div key={emp.address} className="border border-border/50 rounded-lg p-4 space-y-3 hover:border-polygon-purple/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{emp.name}</p>
                        <a
                          href={`https://amoy.polygonscan.com/address/${emp.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-muted-foreground hover:text-polygon-purple flex items-center gap-1"
                        >
                          {shortenAddress(emp.address)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 border-border/50">
                        {emp.payrollInterval < 3600
                          ? `${emp.payrollInterval}s interval`
                          : `${Math.round(emp.payrollInterval / 86400)}d interval`}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Employees</p>
                        <p className="font-medium text-white">{emp.activeEmployees} active</p>
                        {emp.streamingEmployees > 0 && (
                          <p className="text-xs text-cyan-400">{emp.streamingEmployees} streaming</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Payroll Runs</p>
                        <p className="font-medium text-white">{emp.payrollRuns}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Registered</p>
                        <p className="font-medium text-white text-xs">{emp.registeredAt ? formatDate(emp.registeredAt) : "—"}</p>
                      </div>
                    </div>
                    {Object.keys(emp.deposits).length > 0 && (
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground mb-1">Deposited Balance</p>
                        <div className="flex flex-wrap gap-2">
                          {TOKEN_OPTIONS.map((t) => {
                            const raw = BigInt(emp.deposits[t.symbol] ?? "0");
                            if (raw === 0n) return null;
                            return (
                              <span key={t.symbol} className="text-xs bg-polygon-purple/10 border border-polygon-purple/20 rounded px-2 py-0.5 text-white">
                                {formatTokenAmount(raw, t.decimals)} {t.symbol}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-polygon-purple" />
              Live Event Feed
            </CardTitle>
            <CardDescription>Last 20 on-chain events across all employers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-muted/20 rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.recentEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No events yet</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {stats?.recentEvents.map((ev, i) => {
                  const tokenInfo = ev.token ? getTokenInfo(ev.token) : null;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:border-border/60 transition-colors">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 mt-0.5 ${eventBadgeColor(ev.type)}`}>
                        {ev.type.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{ev.label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono">{shortenAddress(ev.employer)}</span>
                          {ev.amount && tokenInfo && (
                            <span className="text-xs text-polygon-purple">
                              {formatTokenAmount(BigInt(ev.amount), tokenInfo.decimals)} {tokenInfo.symbol}
                            </span>
                          )}
                        </div>
                      </div>
                      {ev.txHash && (
                        <a
                          href={`https://amoy.polygonscan.com/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-polygon-purple shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-polygon-purple" />
            Token Breakdown
          </CardTitle>
          <CardDescription>TVL and total paid out per supported token</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {TOKEN_OPTIONS.map((t) => {
              const tvlRaw = BigInt(stats?.tvl[t.address.toLowerCase()] ?? "0");
              const paidRaw = BigInt(stats?.totalPaid[t.address.toLowerCase()] ?? "0");
              return (
                <div key={t.address} className="border border-border/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{t.symbol}</span>
                    <span className="text-xs text-muted-foreground">{t.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Locked (TVL)</p>
                      <p className="font-bold text-polygon-purple">
                        {loading ? "—" : formatTokenAmount(tvlRaw, t.decimals)} {t.symbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Paid Out</p>
                      <p className="font-medium text-white">
                        {loading ? "—" : formatTokenAmount(paidRaw, t.decimals)} {t.symbol}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground truncate border-t border-border/30 pt-2">
                    {t.address === NATIVE_TOKEN ? "Native" : shortenAddress(t.address)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contract Reader */}
      <ContractReader />

      {/* Footer */}
      {stats && (
        <p className="text-center text-xs text-muted-foreground">
          Last fetched: {new Date(stats.fetchedAt).toLocaleTimeString()} ·{" "}
          <a
            href={`https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-polygon-purple hover:underline"
          >
            View contract on PolygonScan
          </a>
        </p>
      )}
    </div>
  );
}
