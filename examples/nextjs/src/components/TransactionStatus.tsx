import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { TransactionStatus as TxStatus } from "@/types";

interface TransactionStatusProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    txStatus: TxStatus;
    onSign: () => void;
}

export function TransactionStatus({
    open,
    onOpenChange,
    txStatus,
    onSign,
}: TransactionStatusProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Review & Sign</DialogTitle>
                    <DialogDescription>
                        A signing request has been sent to your wallet. Continue to sign and submit.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-between">
                    <Badge variant={txStatus === "confirmed" ? "default" : "secondary"}>
                        {txStatus ?? "pending"}
                    </Badge>
                    <Button onClick={onSign} disabled={txStatus === "confirmed"}>
                        Sign in wallet
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}