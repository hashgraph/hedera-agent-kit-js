"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureWalletConnector, connectWallet, disconnectAllSessions, getPairedAccountId } from "@/lib/walletconnect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Variant = "panel" | "compact";

export default function WalletConnectPanel({ variant = "panel" }: { variant?: Variant }) {
    const [connected, setConnected] = useState(false);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const c = await ensureWalletConnector("warn");
                const isConnected = Boolean((c as unknown as { signers?: unknown[] }).signers?.length);
                setConnected(isConnected);
                if (isConnected) {
                    try {
                        const acct = await getPairedAccountId();
                        setAccountId(acct);
                    } catch {
                        // ignore if cannot derive
                    }
                }
                // basic session event hooks
                (c as unknown as { walletConnectClient?: { on: (evt: string, cb: () => void) => void } }).walletConnectClient?.on('session_update', async () => {
                    setConnected(true);
                    try {
                        const acct = await getPairedAccountId();
                        setAccountId(acct);
                    } catch {
                        setAccountId(null);
                    }
                });
                (c as unknown as { walletConnectClient?: { on: (evt: string, cb: () => void) => void } }).walletConnectClient?.on('session_delete', () => {
                    setConnected(false);
                    setAccountId(null);
                });
            } catch {
                // ignore on load
            }
        })();
    }, []);

    const onConnect = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            await connectWallet();
            setConnected(true);
            try {
                const acct = await getPairedAccountId();
                setAccountId(acct);
            } catch {
                setAccountId(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    const onDisconnect = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            await disconnectAllSessions();
            setConnected(false);
            setAccountId(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    if (variant === "compact") {
        return (
            <div className="flex items-center gap-2">
                {connected ? (
                    <>
                        <Badge variant="secondary" className="text-xs">{accountId ?? "—"}</Badge>
                        <Button variant="outline" size="sm" onClick={onDisconnect} disabled={loading}>Disconnect</Button>
                    </>
                ) : (
                    <Button size="sm" onClick={onConnect} disabled={loading}>Connect</Button>
                )}
                {error && <span className="text-xs text-red-600">{error}</span>}
            </div>
        );
    }

    return (
        <div className="w-full max-w-xl border rounded p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm">WalletConnect</span>
                {connected ? (
                    <button className="text-sm underline" onClick={onDisconnect} disabled={loading}>Disconnect</button>
                ) : (
                    <button className="text-sm underline" onClick={onConnect} disabled={loading}>Connect</button>
                )}
            </div>
            <div className="text-xs text-gray-600">Account: {accountId ?? "—"}</div>
            {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
    );
}