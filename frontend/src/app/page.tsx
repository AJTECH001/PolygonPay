import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: "⚡",
    title: "Streaming Payments",
    desc: "Pay employees by the second. Real-time salary accrual — claim anytime, anywhere.",
  },
  {
    icon: "🌐",
    title: "Cross-Border by Default",
    desc: "No SWIFT. No banks. No 3–5 day delays. Instant settlement to any wallet globally.",
  },
  {
    icon: "💎",
    title: "Multi-Token",
    desc: "Pay in native POL, USDC, or any ERC-20. Employees choose their preferred token.",
  },
  {
    icon: "🤖",
    title: "AI Payroll Insights",
    desc: "Claude AI analyzes your payroll for anomalies, risks, and optimization suggestions.",
  },
  {
    icon: "🔒",
    title: "Non-Custodial",
    desc: "Funds held in an auditable smart contract. Withdraw unused balance anytime.",
  },
  {
    icon: "✅",
    title: "Verifiable On-Chain",
    desc: "Every payment is a transaction. Employees have cryptographic proof of compensation.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 sm:py-32 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-polygon-purple/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto space-y-6">
          <Badge variant="outline" className="text-polygon-purple border-polygon-purple/40">
            Built on Polygon Amoy
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white">
            Payroll for the{" "}
            <span className="text-polygon-purple">Onchain Economy</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Replace bank wires with smart contracts. Pay your global team in
            crypto — streaming per-second or scheduled lump-sum — in seconds,
            not days.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild variant="polygon" size="lg">
              <Link href="/employer">Launch as Employer</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/employee">Employee Portal</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 py-10">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-6 text-center">
          {[
            { label: "Settlement Time", value: "~2s", sub: "vs 3–5 days (SWIFT)" },
            { label: "Transaction Fee", value: "<$0.01", sub: "vs 3–5% (banks)" },
            { label: "Availability", value: "24/7", sub: "no banking hours" },
          ].map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="text-2xl sm:text-3xl font-bold text-polygon-purple">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm font-medium text-white">{stat.label}</div>
              <div className="text-xs text-muted-foreground">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
            Everything you need for global payroll
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <Card key={f.title} className="bg-card/50 border-border/50 hover:border-polygon-purple/40 transition-colors">
                <CardContent className="p-6 space-y-2">
                  <div className="text-2xl">{f.icon}</div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center border-t border-border/50">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-white">Ready to pay your team onchain?</h2>
          <p className="text-muted-foreground">
            Register your company, add employees, and run your first onchain payroll in minutes.
          </p>
          <Button asChild variant="polygon" size="lg">
            <Link href="/employer">Get Started</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
