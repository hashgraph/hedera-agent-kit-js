"use client";

import * as React from "react";

import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";

export const ChatComposer = React.forwardRef(
  function ChatComposer({ status, errorMessage, onSend, onStop }, ref) {
    const [input, setInput] = React.useState("");
    const textareaRef = React.useRef(null);
    const isStreaming = status === "submitted" || status === "streaming";

    React.useImperativeHandle(
      ref,
      () => ({
        prefill(text) {
          setInput(text);
          requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(text.length, text.length);
          });
        },
      }),
      [],
    );

    function handleSubmit() {
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;
      onSend(trimmed);
      setInput("");
    }

    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-6">
        {errorMessage ? (
          <div className="text-destructive mb-2 text-sm">{errorMessage}</div>
        ) : null}
        <PromptInput
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            placeholder="Ask the agent anything…"
            onChange={(event) => setInput(event.target.value)}
            onSubmit={handleSubmit}
            disabled={isStreaming}
          />
          <PromptInputToolbar>
            <span className="text-muted-foreground text-xs">
              Enter to send · Shift+Enter for newline
            </span>
            <PromptInputSubmit
              status={status}
              onClick={(event) => {
                if (!isStreaming) return;
                event.preventDefault();
                onStop();
              }}
              disabled={!isStreaming && input.trim().length === 0}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>
    );
  },
);
