import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";

// Disable SSR for wallet providers — RainbowKit/wagmi must not run during
// static page generation (it throws when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
// is absent at build time).
const Providers = dynamic(() => import("@/components/Providers"), { ssr: false });

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
