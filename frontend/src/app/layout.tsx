import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavBar from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PolygonPay — Onchain Payroll",
  description:
    "Decentralized payroll for global teams. Pay employees onchain in POL, USDC, or any ERC-20 token — with per-second streaming or lump-sum runs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <NavBar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
