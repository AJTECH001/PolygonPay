"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { polygonAmoy } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function NetworkGuard({ children }: Props) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // Only enforce network check when wallet is connected
  const isWrongNetwork = isConnected && chainId !== polygonAmoy.id;

  if (isWrongNetwork) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Wrong Network</h2>
          <p className="text-muted-foreground text-sm">
            PolygonPay runs on{" "}
            <span className="text-white font-medium">Polygon Amoy Testnet</span>.
            Switch your wallet to continue.
          </p>

          {/* Network details */}
          <div className="w-full rounded-lg border border-border/50 bg-card/50 p-4 text-left space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network</span>
              <span className="text-white">Polygon Amoy</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chain ID</span>
              <span className="text-white">80002</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span className="text-white">POL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">RPC</span>
              <span className="text-white truncate ml-4">rpc-amoy.polygon.technology</span>
            </div>
          </div>

          <Button
            variant="polygon"
            className="w-full"
            disabled={isPending}
            onClick={() => switchChain({ chainId: polygonAmoy.id })}
          >
            {isPending ? "Switching..." : "Switch to Polygon Amoy"}
          </Button>

          <p className="text-xs text-muted-foreground">
            MetaMask will prompt you to add the network if it&apos;s not already configured.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
