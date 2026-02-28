"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import AddEmployeeModal from "@/components/AddEmployeeModal";
import EmployeeTable from "@/components/EmployeeTable";
import FundsPanel from "@/components/FundsPanel";
import AIInsights from "@/components/AIInsights";
import PaymentHistory from "@/components/PaymentHistory";
import PayrollStatusCard from "@/components/PayrollStatusCard";
import NetworkGuard from "@/components/NetworkGuard";
import {
  useCompany,
  useIsRegistered,
  useEmployees,
  useRegisterCompany,
  useExecutePayroll,
} from "@/hooks/usePayrollRegistry";
import type { Employee } from "@/hooks/usePayrollRegistry";
import { useToast } from "@/hooks/use-toast";
import { Users, DollarSign, Zap, Sparkles, Building2 } from "lucide-react";
import { formatDate } from "@/lib/constants";

function EmployerPage() {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const { data: isRegistered, refetch: refetchRegistered } = useIsRegistered(address);
  const { data: company, refetch: refetchCompany } = useCompany(address);
  const { data: employeesData, refetch: refetchEmployees } = useEmployees(address);

  const { register, isPending: isRegistering } = useRegisterCompany();
  const { executePayroll, isPending: isExecuting } = useExecutePayroll();

  const [showAddModal, setShowAddModal] = useState(false);

  // Registration form
  const [regForm, setRegForm] = useState({
    name: "",
    description: "",
    payrollInterval: "60", // 60s default for testnet demo
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-white">Connect your wallet</h2>
        <p className="text-muted-foreground text-sm">Connect as the employer / company owner</p>
        <ConnectButton />
      </div>
    );
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!regForm.name) return;
    try {
      await register(
        regForm.name,
        regForm.description,
        BigInt(regForm.payrollInterval)
      );
      toast({ title: "Company registered!", description: `${regForm.name} is live on Polygon.`, variant: "success" });
      refetchRegistered();
      refetchCompany();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  async function handleRunPayroll() {
    try {
      await executePayroll();
      toast({ title: "Payroll executed!", description: "All due lump-sum employees have been paid.", variant: "success" });
      refetchEmployees();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  function refetchAll() {
    refetchEmployees();
    refetchCompany();
    refetchRegistered();
  }

  // Flatten employees from tuple response
  const employees: Employee[] = employeesData
    ? (employeesData as [string[], Employee[]])[1]
    : [];
  const activeEmployees = employees.filter((e) => e.isActive);
  const lumpSumCount = activeEmployees.filter((e) => e.paymentType === 0).length;
  const streamingCount = activeEmployees.filter((e) => e.paymentType === 1).length;

  const companyData = company as
    | { name: string; description: string; isRegistered: boolean; createdAt: bigint; payrollInterval: bigint }
    | undefined;

  // ── Not registered yet ────────────────────────────────────────────────────
  if (!isRegistered) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Register Your Company</CardTitle>
            <CardDescription>
              One-time setup to start paying your team onchain via Polygon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Company Name</Label>
                <Input
                  placeholder="Acme Corp"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  placeholder="Global crypto-native team"
                  value={regForm.description}
                  onChange={(e) => setRegForm({ ...regForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payroll Interval (seconds)</Label>
                <Input
                  type="number"
                  min="1"
                  value={regForm.payrollInterval}
                  onChange={(e) => setRegForm({ ...regForm, payrollInterval: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  60s = testnet demo · 2419200 = 28 days production
                </p>
              </div>
              <Button type="submit" variant="polygon" className="w-full" disabled={isRegistering}>
                {isRegistering ? "Registering..." : "Register Company"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{companyData?.name}</h1>
          <p className="text-muted-foreground text-sm">
            {companyData?.description} · Registered {formatDate(Number(companyData?.createdAt || BigInt(0)))}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} variant="outline">
          + Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Total Employees", value: activeEmployees.length },
          { icon: DollarSign, label: "Lump Sum", value: lumpSumCount },
          { icon: Zap, label: "Streaming", value: streamingCount },
          {
            icon: Building2,
            label: "Payroll Interval",
            value: `${companyData?.payrollInterval || 0}s`,
          },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="h-5 w-5 text-polygon-purple shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-white">{String(value)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payroll Status */}
      <PayrollStatusCard
        employer={address!}
        onExecute={handleRunPayroll}
        isExecuting={isExecuting}
      />

      {/* Main Tabs */}
      <Tabs defaultValue="employees">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="employees">
            Employees
            {activeEmployees.length > 0 && (
              <Badge variant="secondary" className="ml-2">{activeEmployees.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="funds">Funds</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <EmployeeTable employees={employees} onSuccess={refetchAll} />
        </TabsContent>

        <TabsContent value="funds" className="mt-4">
          <FundsPanel employer={address!} onSuccess={refetchAll} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PaymentHistory employer={address!} />
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AIInsights companyName={companyData?.name || ""} employees={activeEmployees} />
        </TabsContent>
      </Tabs>

      <AddEmployeeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refetchAll}
      />
    </div>
  );
}

// Wrap the page with network enforcement
export default function EmployerPageWithGuard() {
  return (
    <NetworkGuard>
      <EmployerPage />
    </NetworkGuard>
  );
}
