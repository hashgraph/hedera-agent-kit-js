import { ChatShell } from "@/features/chat/components/ChatShell";
import { getMutatingToolMethods } from "@/features/chat-hedera/server";
import { ChatHederaModeToggle } from "@/features/chat-hedera";
import { ChatWalletButton } from "@/features/chat-wallet";

import { plugins } from "../../../../../shared/config.js";

// Derive the mutating-tools set on the server so the client doesn't need to
// bundle the Hedera SDK just to bucket query vs. mutating tools. The plugin
// manifest is static, so hoist the computation to module init.
const mutatingToolMethods = Array.from(getMutatingToolMethods(plugins));

export default async function ChatPage({ params }) {
  const { id } = await params;
  return (
    <ChatShell
      chatId={decodeURIComponent(id)}
      mutatingToolMethods={mutatingToolMethods}
      headerSlots={
        <>
          <ChatHederaModeToggle />
          <ChatWalletButton />
        </>
      }
    />
  );
}
