"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signAndExecuteBytes, getPairedAccountId, connectWallet, ensureWalletConnector } from "@/lib/walletconnect";
import { API_ENDPOINTS } from "@/lib/constants";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingBytes, setPendingBytes] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<string | null>(null);
    const [accountId, setAccountId] = useState<string>("");
    const [openReview, setOpenReview] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    const mode = process.env.NEXT_PUBLIC_AGENT_MODE;

    // In HITL mode, avoid auto-initializing WalletConnect on page load; derive account id on demand in submit/sign flows

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
        // double rAF to ensure DOM updates settled after state changes
        requestAnimationFrame(() => requestAnimationFrame(doFocus));
    }, []);

    const submit = useCallback(async () => {
        setError(null);
        setLoading(true);
        // Reset signing state for a fresh request cycle
        setTxStatus(null);
        setOpenReview(false);
        setPendingBytes(null);
        const nextMessages = [...messages, { role: "user", content: input } as Message];
        setMessages(nextMessages);
        try {
            if (mode === "human") {
                // auto-derive accountId from wallet if not already set
                let acct = accountId;
                if (!acct) {
                    try { acct = await getPairedAccountId(); setAccountId(acct); } catch { }
                }
                const res = await fetch(API_ENDPOINTS.WALLET_PREPARE, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input, accountId: acct || undefined, messages: nextMessages }),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
                if (json.bytesBase64) {
                    // Ensure stale statuses don't block the next auto-sign/dialog flow
                    setTxStatus(null);
                    setPendingBytes(json.bytesBase64);
                    setMessages(m => [...m, { role: "assistant", content: "Transaction requires signature." }]);
                } else {
                    const text = typeof json.result?.output === 'string'
                        ? json.result.output
                        : typeof json.result === 'string'
                            ? json.result
                            : JSON.stringify(json.result);
                    setMessages(m => [...m, { role: "assistant", content: text }]);
                }
            } else {
                const res = await fetch(API_ENDPOINTS.AGENT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input, messages: nextMessages }),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) throw new Error(json.error || "Request failed");
                const text = typeof json.result?.output === 'string'
                    ? json.result.output
                    : typeof json.result === 'string'
                        ? json.result
                        : JSON.stringify(json.result);
                setMessages(m => [...m, { role: "assistant", content: text }]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
            setInput("");
            focusComposer();
        }
    }, [input, messages, accountId, mode, focusComposer]);

    const sign = useCallback(async () => {
        if (!pendingBytes) return;
        try {
            setTxStatus("pending");
            // ensure connector initialised with low-noise logger
            await ensureWalletConnector("warn");
            // ensure we have an account id; if not, attempt to pair then derive
            let acct = accountId;
            if (!acct) {
                try {
                    acct = await getPairedAccountId();
                    setAccountId(acct);
                } catch {
                    const session = await connectWallet();
                    const derived = session?.namespaces?.hedera?.accounts?.[0]?.split(":").pop() ?? "";
                    if (!derived) throw new Error("No wallet account available after connecting");
                    acct = derived;
                    setAccountId(acct);
                }
            }
            const bytes = typeof window === "undefined" ? Buffer.from(pendingBytes, "base64") : Uint8Array.from(atob(pendingBytes), c => c.charCodeAt(0));
            setIsSigning(true);
            const result = await signAndExecuteBytes({ bytes, accountId: acct });
            setTxStatus("confirmed");
            setMessages(m => [...m, { role: "assistant", content: JSON.stringify(result) }]);
            setPendingBytes(null);
            setOpenReview(false);
        } catch (e) {
            setTxStatus(null);
            setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            setIsSigning(false);
        }
    }, [pendingBytes, accountId]);

    const reviewVisible = useMemo(() => mode === "human" && Boolean(pendingBytes), [mode, pendingBytes]);

    // When bytes are ready in HITL mode, auto-sign if already paired; otherwise open dialog
    useEffect(() => {
        // Only guard while actively signing to prevent duplicate concurrent calls
        if (!reviewVisible || isSigning) return;
        (async () => {
            try {
                // Consider wallet paired if we can derive an account id
                let acct = accountId;
                if (!acct) {
                    try { acct = await getPairedAccountId(); setAccountId(acct); } catch { /* not paired */ }
                }
                if (acct && !isSigning) {
                    await sign();
                } else {
                    setOpenReview(true);
                }
            } catch {
                setOpenReview(true);
            }
        })();
    }, [reviewVisible, isSigning, accountId, sign]);

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-base">Agent Chat</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[60vh] pr-4">
                    {messages.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No messages yet.</div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {messages.map((m, i) => (
                                <div key={i} className={cn("flex items-start gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                                    {m.role === "assistant" && (
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback>A</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            "max-w-[75%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words overflow-x-hidden",
                                            m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                                        )}
                                        style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                                    >
                                        {m.content}
                                    </div>
                                    {m.role === "user" && (
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {error && (
                    <Alert variant="destructive" className="mt-3">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="gap-2">
                <Textarea
                    ref={inputRef}
                    id="agent-composer"
                    value={input}
                    placeholder="Ask the agent..."
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                    className="min-h-[44px] max-h-40 resize-y"
                    disabled={loading}
                />
                <Button onClick={submit} disabled={loading || !input}>
                    <Send className="mr-2 h-4 w-4" /> Send
                </Button>
            </CardFooter>

            <Dialog open={openReview} onOpenChange={setOpenReview}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Review & Sign</DialogTitle>
                        <DialogDescription>
                            A signing request has been sent to your wallet. Continue to sign and submit.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center justify-between">
                        <Badge variant={txStatus === "confirmed" ? "default" : "secondary"}>{txStatus ?? "pending"}</Badge>
                        <Button onClick={() => void sign()} disabled={txStatus === "confirmed"}>
                            Sign in wallet
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}


