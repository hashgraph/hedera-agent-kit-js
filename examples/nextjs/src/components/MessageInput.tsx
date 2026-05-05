import { forwardRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface MessageInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    disabled: boolean;
    placeholder?: string;
}

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
    function MessageInput({ value, onChange, onSubmit, disabled, placeholder = "Ask the agent..." }, ref) {
        const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
            }
        };

        return (
            <div className="w-full gap-2 flex">
                <Textarea
                    ref={ref}
                    id="agent-composer"
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-h-[44px] max-h-40 resize-y"
                    disabled={disabled}
                />
                <Button onClick={onSubmit} disabled={disabled || !value}>
                    <Send className="mr-2 h-4 w-4" /> Send
                </Button>
            </div>
        );
    }
);