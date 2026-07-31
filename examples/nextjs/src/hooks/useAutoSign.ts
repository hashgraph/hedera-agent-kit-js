import { useEffect, useRef } from 'react';
import { AgentMode } from '@/types';

interface UseAutoSignProps {
    mode: AgentMode | undefined;
    pendingBytes: string | null;
    isSigning: boolean;
    signAndExecute: () => Promise<void>;
}

export function useAutoSign({ mode, pendingBytes, isSigning, signAndExecute }: UseAutoSignProps) {
    // sign each transaction at most once; rejection in the wallet is final
    const attemptedBytesRef = useRef<string | null>(null);

    useEffect(() => {
        if (mode !== 'human' || !pendingBytes || isSigning) return;
        if (attemptedBytesRef.current === pendingBytes) return;
        attemptedBytesRef.current = pendingBytes;
        void signAndExecute();
    }, [mode, pendingBytes, isSigning, signAndExecute]);
}
