"use client";

import { LedgerId } from "@hashgraph/sdk";
import {
    DAppConnector,
    HederaChainId,
    HederaJsonRpcMethod,
    HederaSessionEvent,
} from "@hashgraph/hedera-wallet-connect";
import { HederaNetwork } from "./agent-config";


let connectorSingleton: DAppConnector | undefined;

export function mapNetworkToLedgerId(network: HederaNetwork): LedgerId {
    return network === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;
}

export function getAllowedChains(): string[] {
    // Allow both Hedera Native chain ids; wallets handle the selected session chain
    return [HederaChainId.Mainnet, HederaChainId.Testnet];
}

export function getNetwork(): HederaNetwork {
    return (process.env.NEXT_PUBLIC_NETWORK as HederaNetwork) || "testnet";
}

export function toHip30AccountId(network: HederaNetwork, accountId: string): string {
    // network:shard.realm.num
    const hip30Network = network === "mainnet" ? "hedera:mainnet" : "hedera:testnet";
    return `${hip30Network}:${accountId}`;
}

export function initWalletConnector(): DAppConnector {
    if (connectorSingleton) return connectorSingleton;

    const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
    if (!projectId) throw new Error("NEXT_PUBLIC_WC_PROJECT_ID is required");

    const network = getNetwork();
    const ledgerId = mapNetworkToLedgerId(network);

    const metadata = {
        name: "Hedera Agent App",
        description: "HITL signing via Hedera WalletConnect",
        url: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
        icons: ["https://avatars.githubusercontent.com/u/31002956"],
    };

    connectorSingleton = new DAppConnector(
        metadata,
        ledgerId,
        projectId,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        getAllowedChains(),
    );

    return connectorSingleton;
}

export async function ensureWalletConnector(logger: "error" | "warn" | "info" = "warn") {
    const c = initWalletConnector();
    if (!c.walletConnectClient) {
        await c.init({ logger });
    }
    return c;
}

export async function connectWallet() {
    const c = await ensureWalletConnector();
    return c.openModal();
}

export async function disconnectAllSessions() {
    const c = await ensureWalletConnector();
    await c.disconnectAll();
}

/**
 * Returns the first paired Hedera account id (shard.realm.num) from the active WalletConnect session.
 * Throws if no session is connected.
 */
export async function getPairedAccountId(): Promise<string> {
    const c = await ensureWalletConnector("warn");
    type WalletConnectClientLike = {
        session?: {
            getAll?: () => Array<{
                namespaces?: {
                    hedera?: {
                        accounts?: string[];
                    };
                };
            }>;
        };
    };
    const wc = (c as unknown as { walletConnectClient?: WalletConnectClientLike }).walletConnectClient;
    // WalletConnect v2 sessions live under client.session.getAll()
    const sessions = wc?.session?.getAll?.() ?? [];
    const accounts: string[] = [];
    for (const s of sessions) {
        const ns = s?.namespaces?.hedera;
        if (ns?.accounts && Array.isArray(ns.accounts)) {
            accounts.push(...ns.accounts);
        }
    }
    // Fallback: attempt to read from connector signers shape if present
    if (accounts.length === 0 && (c as unknown as { signers?: Array<{ accounts?: string[] }> }).signers) {
        const signers = (c as unknown as { signers?: Array<{ accounts?: string[] }> }).signers ?? [];
        for (const signer of signers) {
            if (Array.isArray(signer.accounts)) accounts.push(...signer.accounts);
        }
    }
    if (accounts.length === 0) {
        throw new Error("No connected wallet session. Please connect your wallet first.");
    }
    // accounts are HIP-30 identifiers like "hedera:testnet:0.0.1234" → return the trailing account id
    const first = accounts[0];
    const parts = String(first).split(":");
    return parts[parts.length - 1];
}

export async function signAndExecuteBytes(params: { bytes: Uint8Array | ArrayBuffer; accountId: string }) {
    const c = await ensureWalletConnector();
    const network = getNetwork();
    const hip30 = toHip30AccountId(network, params.accountId);
    const base64 = toBase64(params.bytes);
    // WalletConnect v2 expects a single string for the transaction list (base64-encoded bytes list)
    // Here we pass a single-transaction list encoded as a string
    return c.signAndExecuteTransaction({ signerAccountId: hip30, transactionList: base64 });
}

export function toBase64(bytes: Uint8Array | ArrayBuffer): string {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof window === "undefined") {
        return Buffer.from(u8).toString("base64");
    }
    let binary = "";
    u8.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
    if (typeof window === "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64"));
    }
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}