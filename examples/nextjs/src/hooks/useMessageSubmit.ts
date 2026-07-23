import { useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/constants';
import { Message, AgentMode, WalletPrepareResponse, AgentResponse, PendingTransaction } from '@/types';
import { getPairedAccountId } from '@/lib/walletconnect';

interface UseMessageSubmitProps {
    mode: AgentMode | undefined;
    onMessagesChange: (updateFn: (messages: Message[]) => Message[]) => void;
    onPendingBytesChange: (tx: PendingTransaction | null) => void;
    onTxStatusReset: () => void;
}

export function useMessageSubmit({
    mode,
    onMessagesChange,
    onPendingBytesChange,
    onTxStatusReset,
}: UseMessageSubmitProps) {
    const submitHumanModeMessage = useCallback(async (input: string, nextMessages: Message[]) => {
        const acctId = await getPairedAccountId()
        const response = await fetch(API_ENDPOINTS.WALLET_PREPARE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                input,
                // accountId: accountId || undefined,
                accountId: acctId,
                messages: nextMessages
            }),
        });

        const json: WalletPrepareResponse = await response.json();
        if (!response.ok || !json.ok) {
            throw new Error(json.error || "Request failed");
        }

        if (json.bytesBase64) {
            const { bytesBase64, transactionId, payerAccountId, transactionType, expiresAt, memo } = json;
            onPendingBytesChange({ bytesBase64, transactionId, payerAccountId, transactionType, expiresAt, memo });
            const summary = [
                transactionType && `type: ${transactionType}`,
                payerAccountId && `payer: ${payerAccountId}`,
                transactionId && `id: ${transactionId}`,
                memo && `memo: ${memo}`,
                expiresAt && `expires: ${new Date(expiresAt).toLocaleTimeString()}`,
            ].filter(Boolean).join(', ');
            onMessagesChange(m => [...m, {
                role: "assistant",
                content: `Transaction requires signature${summary ? ` (${summary})` : ''}.`,
            }]);
            return;
        }

        const text = json.result || "";
        onMessagesChange(m => [...m, { role: "assistant", content: text }]);
    }, [onPendingBytesChange, onMessagesChange]);

    const submitAgentModeMessage = useCallback(async (input: string, nextMessages: Message[]) => {
        const response = await fetch(API_ENDPOINTS.AGENT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input, messages: nextMessages }),
        });

        const json: AgentResponse = await response.json();
        if (!response.ok || !json.ok) {
            throw new Error(json.error || "Request failed");
        }

        const text = json.result;
        onMessagesChange(m => [...m, { role: "assistant", content: text }]);
    }, [onMessagesChange]);

    const submitMessage = useCallback(async (input: string, messages: Message[]) => {
        onTxStatusReset();
        onPendingBytesChange(null);

        const nextMessages = [...messages, { role: "user" as const, content: input }];
        onMessagesChange(() => nextMessages);

        if (mode === "human") {
            await submitHumanModeMessage(input, nextMessages);
        } else {
            await submitAgentModeMessage(input, nextMessages);
        }
    }, [mode, submitHumanModeMessage, submitAgentModeMessage, onMessagesChange, onPendingBytesChange, onTxStatusReset]);

    return { submitMessage };
}