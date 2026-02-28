"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTokenAmount, getTokenInfo, shortenAddress, formatDate } from "@/lib/constants";
import { useRemoveEmployee } from "@/hooks/usePayrollRegistry";
import type { Employee } from "@/hooks/usePayrollRegistry";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface Props {
  employees: Employee[];
  onSuccess: () => void;
}

export default function EmployeeTable({ employees, onSuccess }: Props) {
  const { removeEmployee, isPending } = useRemoveEmployee();
  const { toast } = useToast();

  const active = employees.filter((e) => e.isActive);

  if (active.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No active employees yet. Click &quot;Add Employee&quot; to get started.
      </div>
    );
  }

  async function handleRemove(wallet: `0x${string}`, name: string) {
    if (!confirm(`Remove ${name}? Their outstanding stream balance will be auto-settled.`)) return;
    try {
      await removeEmployee(wallet);
      toast({ title: "Employee removed", description: `${name} has been offboarded.`, variant: "success" });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            {["Name", "Role", "Wallet", "Token", "Salary", "Type", "Added", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {active.map((emp) => {
            const tokenInfo = getTokenInfo(emp.token);
            const isStreaming = emp.paymentType === 1;
            const salaryDisplay = isStreaming
              ? `${(Number(emp.streamRate) / 10 ** tokenInfo.decimals).toExponential(4)}/s`
              : formatTokenAmount(emp.monthlySalary, tokenInfo.decimals) + "/mo";

            return (
              <tr key={emp.wallet} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{emp.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{emp.role}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {shortenAddress(emp.wallet)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{tokenInfo.symbol}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-white">{salaryDisplay}</td>
                <td className="px-4 py-3">
                  {isStreaming ? (
                    <Badge variant="stream">Streaming</Badge>
                  ) : (
                    <Badge variant="success">Lump Sum</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(Number(emp.addedAt))}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-7 w-7"
                    disabled={isPending}
                    onClick={() => handleRemove(emp.wallet, emp.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
