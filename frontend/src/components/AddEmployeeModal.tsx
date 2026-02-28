"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TOKEN_OPTIONS, PAYMENT_TYPES, parseTokenAmount, monthlyToStreamRate, getTokenInfo } from "@/lib/constants";
import { useAddEmployee } from "@/hooks/usePayrollRegistry";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEmployeeModal({ open, onClose, onSuccess }: Props) {
  const { addEmployee, isPending } = useAddEmployee();
  const { toast } = useToast();

  const [form, setForm] = useState({
    wallet: "",
    name: "",
    role: "",
    token: TOKEN_OPTIONS[0].address,
    paymentType: "0", // 0 = LUMP_SUM
    monthlySalary: "",
    streamRateMonthly: "", // we convert to per-second
  });

  const selectedToken = getTokenInfo(form.token);
  const isStreaming = form.paymentType === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.wallet || !form.name || !form.role) return;

    try {
      const monthlySalary = form.monthlySalary
        ? parseTokenAmount(form.monthlySalary, selectedToken.decimals)
        : 0n;

      const streamRate = isStreaming && form.streamRateMonthly
        ? monthlyToStreamRate(form.streamRateMonthly, selectedToken.decimals)
        : 0n;

      await addEmployee(
        form.wallet as `0x${string}`,
        form.name,
        form.role,
        form.token as `0x${string}`,
        monthlySalary,
        streamRate,
        Number(form.paymentType)
      );

      toast({ title: "Employee added", description: `${form.name} added successfully.`, variant: "success" });
      onSuccess();
      onClose();
      setForm({ wallet: "", name: "", role: "", token: TOKEN_OPTIONS[0].address, paymentType: "0", monthlySalary: "", streamRateMonthly: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Wallet Address</Label>
            <Input placeholder="0x..." value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="Alice Smith" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Role / Title</Label>
              <Input placeholder="Engineer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Token</Label>
              <Select value={form.token} onValueChange={(v) => setForm({ ...form, token: v })}>
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label>Payment Type</Label>
              <Select value={form.paymentType} onValueChange={(v) => setForm({ ...form, paymentType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Lump Sum (monthly)</SelectItem>
                  <SelectItem value="1">Streaming (per-second)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isStreaming ? (
            <div className="space-y-1.5">
              <Label>Monthly Salary ({selectedToken.symbol})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder={`e.g. 3000`}
                value={form.monthlySalary}
                onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Monthly Equivalent ({selectedToken.symbol})</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 3000 — converted to per-second rate"
                value={form.streamRateMonthly}
                onChange={(e) => setForm({ ...form, streamRateMonthly: e.target.value })}
                required
              />
              {form.streamRateMonthly && (
                <p className="text-xs text-muted-foreground">
                  Rate:{" "}
                  {(
                    Number(monthlyToStreamRate(form.streamRateMonthly, selectedToken.decimals)) /
                    10 ** selectedToken.decimals
                  ).toExponential(4)}{" "}
                  {selectedToken.symbol}/s
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="polygon" disabled={isPending}>
              {isPending ? "Confirming..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
