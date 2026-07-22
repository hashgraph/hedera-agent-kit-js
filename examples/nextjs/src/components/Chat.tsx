"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { signAndExecuteBytes, getPairedAccountId, connectWallet, ensureWalletConnector } from "@/lib/walletconnect";
import { useMessageSubmit } from "@/hooks/useMessageSubmit";
import { useAutoSign } from "@/hooks/useAutoSign";
import { Message, AgentMode, PendingTransaction } from "@/types";

// WalletConnect rejections are plain objects, not Error instances
function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
        return (e as { message: string }).message;
    }
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    const mode = process.env.NEXT_PUBLIC_AGENT_MODE as AgentMode | undefined;
    const [accountId, setAccountId] = useState<string>('');
    const [isSigning, setIsSigning] = useState(false);

    const { submitMessage } = useMessageSubmit({
        mode,
        onMessagesChange: setMessages,
        onPendingBytesChange: setPendingTx,
        onTxStatusReset: () => { },
    });

    const focusComposer = useCallback(() => {
        if (typeof window === "undefined") return;
        const doFocus = () => {
            const el = inputRef.current ?? (document.getElementById("agent-composer") as HTMLTextAreaElement | null);
            if (el) {
                el.focus();
                try {
                    const len = el.value.length;
                    el.setSelectionRange(len, len);
                } catch { }
            }
        };
        requestAnimationFrame(() => requestAnimationFrame(doFocus));
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!input.trim()) return;

        setError(null);
        setLoading(true);

        try {
            await submitMessage(input, messages);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
            setInput("");
            focusComposer();
        }
    }, [input, messages, submitMessage, focusComposer]);

    const handleSign = useCallback(async () => {
        if (!pendingTx) return;
        try {
            setIsSigning(true);

            // ensure connector initialised
            await ensureWalletConnector('warn');

            // ensure we have an account id; if not, attempt to pair then derive
            let acct = accountId;
            if (!acct) {
                try {
                    acct = await getPairedAccountId();
                    setAccountId(acct);
                } catch {
                    const session = await connectWallet();
                    const derived = session?.namespaces?.hedera?.accounts?.[0]?.split(':').pop() ?? '';
                    if (!derived) throw new Error('No wallet account available after connecting');
                    acct = derived;
                    setAccountId(acct);
                }
            }

            const bytes = typeof window === 'undefined'
                ? Buffer.from(pendingTx.bytesBase64, 'base64')
                : Uint8Array.from(atob(pendingTx.bytesBase64), c => c.charCodeAt(0));

            const result = await signAndExecuteBytes({ bytes, accountId: acct });
            setMessages(m => [...m, { role: 'assistant', content: JSON.stringify(result) }]);
        } catch (e) {
            // rejection in the wallet is final: discard the prepared bytes
            setMessages(m => [...m, { role: 'assistant', content: `Transaction was not signed (${errorMessage(e)}). The prepared bytes were discarded.` }]);
        } finally {
            setPendingTx(null);
            setIsSigning(false);
        }
    }, [pendingTx, accountId]);

    useAutoSign({
        mode,
        pendingBytes: pendingTx?.bytesBase64 ?? null,
        isSigning,
        signAndExecute: handleSign,
    });

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-base">Agent Chat</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                    <MessageList messages={messages} />
                </ScrollArea>

                {error && (
                    <Alert variant="destructive" className="mt-3">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter>
                <MessageInput
                    ref={inputRef}
                    value={input}
                    onChange={setInput}
                    onSubmit={handleSubmit}
                    disabled={loading}
                />
            </CardFooter>
        </Card>
    );
}
