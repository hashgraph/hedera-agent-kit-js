"use client";

import * as React from "react";

import {
  useChatExtension,
} from "@/features/chat/extension";

// Looks up the card renderer registered by an extension for `part.toolName`
// and projects the canonical tool-part shape onto the renderer's
// `ToolPartProps` contract. Substrate stays oblivious to what any specific
// extension does with the call.
export function ChatToolPart({ part }) {
  const { toolRenderers } = useChatExtension();
  const renderer = toolRenderers[part.toolName];
  if (!renderer?.card) return null;
  const props = {
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    input: part.input,
    output: part.state === "output-available" ? part.output : undefined,
    state: part.state,
    errorMessage: part.state === "output-error" ? part.errorText : undefined,
  };
  const Card = renderer.card;
  return <Card {...props} />;
}
