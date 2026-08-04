"use client";

import dynamic from "next/dynamic";

const WalletConnectPanel = dynamic(() => import("./WalletConnect"), { ssr: false });

export default function WalletConnectClient() {
    return <WalletConnectPanel variant="compact" />;
}


