import { createAgentBootstrap } from "@/lib/agent-config";
import WalletConnectClient from "@/components/WalletConnectClient";
import Chat from "@/components/Chat";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { mode, network } = createAgentBootstrap();
  return (
    <div className="min-h-screen w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Hedera Agent Chat</div>
            <Badge variant="secondary" className="text-xs">Mode: {mode}</Badge>
            <Badge variant="outline" className="text-xs">Network: {network}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {mode === "human" && <WalletConnectClient />}
          </div>
        </div>
        <Separator className="mt-4" />
      </header>

      <main className="mx-auto mt-6 w-full max-w-4xl">
        <Chat />
      </main>
    </div>
  );
}
