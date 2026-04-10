import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Message } from "@/types";

interface MessageListProps {
    messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
    if (messages.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">No messages yet.</div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
                <div
                    key={i}
                    className={cn(
                        "flex items-start gap-2",
                        m.role === "user" ? "justify-end" : "justify-start"
                    )}
                >
                    {m.role === "assistant" && (
                        <Avatar className="h-6 w-6">
                            <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                    )}
                    <div
                        className={cn(
                            "max-w-[75%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words overflow-x-hidden",
                            m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
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
    );
}