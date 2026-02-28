"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// `ssr: false` must live in a Client Component — it is forbidden in Server Components.
// This wrapper ensures RainbowKit/wagmi never initialise during static page generation.
const Providers = dynamic(() => import("./Providers"), { ssr: false });

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
