import { useEffect } from 'react';
import { getPairedAccountId } from '@/lib/walletconnect';
import { AgentMode } from '@/types';

interface UseAutoSignProps {
    mode: AgentMode | undefined;
    pendingBytes: string | null;
    isSigning: boolean;
    accountId: string;
    signAndExecute: () => Promise<void>;
    onAccountIdChange: (accountId: string) => void;
    onOpenReview: (open: boolean) => void;
}

export function useAutoSign({
    mode,
    pendingBytes,
    isSigning,
    accountId,
    signAndExecute,
    onAccountIdChange,
    onOpenReview,
}: UseAutoSignProps) {
    const reviewVisible = mode === "human" && Boolean(pendingBytes);

    useEffect(() => {
        if (!reviewVisible || isSigning) return;

        (async () => {
            try {
                let acct = accountId;
                if (!acct) {
                    try { 
                        acct = await getPairedAccountId(); 
                        onAccountIdChange(acct); 
                    } catch { 
                    }
                }
                
                if (acct && !isSigning && pendingBytes) {
                    await signAndExecute();
                } else {
                    onOpenReview(true);
                }
            } catch {
                onOpenReview(true);
            }
        })();
    }, [reviewVisible, isSigning, accountId, pendingBytes, signAndExecute, onAccountIdChange, onOpenReview]);

    return { reviewVisible };
}