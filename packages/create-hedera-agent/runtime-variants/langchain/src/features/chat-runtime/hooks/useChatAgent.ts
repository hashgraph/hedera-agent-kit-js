"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

import type { ChatMessage, ChatStatus } from "@/features/chat/types";
import {
  chatMessageFromUIMessage,
  chatMessagesToUIMessages,
  chatStatusFromAiSdk,
} from "../utils/mappers";

// `useChatAgent` is the chat substrate's sole client-side runtime entrypoint.
// The langchain overlay keeps the ai-sdk UIMessage stream protocol on the wire
// (the server's `createChatHandler` adapts langchain agent events to that shape
// inside `createUIMessageStream`), so this hook is structurally identical to
// the ai-sdk variant. Only the server-side handler differs.

export type UseChatAgentOptions = {
  id: string;
  initialMessages: ReadonlyArray<ChatMessage>;
  // Optional contributor that the hook calls per outgoing request, including
  // the AI SDK's auto-resubmit after `addToolResult`, which does not accept
  // per-call body overrides. Substrate threads the merged extension request-
  // body builder in; the hook never inspects the keys.
  getRequestBody?: () => Record<string, unknown>;
  // Endpoint the underlying transport posts to. Defaults to `/api/chat`.
  api?: string;
};

export type AddToolResultArgs = {
  tool: string;
  toolCallId: string;
  output: unknown;
};

export type UseChatAgentReturn = {
  messages: ChatMessage[];
  status: ChatStatus;
  error: Error | undefined;
  sendMessage: (input: { text: string }) => void;
  stop: () => void;
  addToolResult: (args: AddToolResultArgs) => Promise<void> | void;
};

export function useChatAgent({
  id,
  initialMessages,
  getRequestBody,
  api = "/api/chat",
}: UseChatAgentOptions): UseChatAgentReturn {
  // Ref the request-body contributor so the transport, captured once in the
  // useMemo below, always reads the freshest function. The SDK's auto-resubmit
  // after `addToolResult` does not surface a per-call body override, so the
  // per-request hook has to source the latest values itself.
  const getRequestBodyRef = React.useRef(getRequestBody);
  React.useEffect(() => {
    getRequestBodyRef.current = getRequestBody;
  }, [getRequestBody]);

  const initialUIMessages = React.useMemo(
    () => chatMessagesToUIMessages(initialMessages),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  const transport = React.useMemo(
    () =>
      new DefaultChatTransport({
        api,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const contributed = getRequestBodyRef.current?.() ?? {};
          return { body: { ...body, ...contributed, messages } };
        },
      }),
    [api],
  );

  const {
    messages: uiMessages,
    sendMessage: sendUIMessage,
    status: aiSdkStatus,
    stop,
    error,
    addToolResult: addUIToolResult,
  } = useChat({
    id,
    messages: initialUIMessages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const messages = React.useMemo(
    () => uiMessages.map((m: UIMessage) => chatMessageFromUIMessage(m)),
    [uiMessages],
  );

  const status = chatStatusFromAiSdk(aiSdkStatus);

  const sendMessage = React.useCallback(
    ({ text }: { text: string }) => sendUIMessage({ text }),
    [sendUIMessage],
  );

  const addToolResult = React.useCallback(
    async ({ tool, toolCallId, output }: AddToolResultArgs): Promise<void> => {
      await addUIToolResult({ tool, toolCallId, output });
    },
    [addUIToolResult],
  );

  return { messages, status, error, sendMessage, stop, addToolResult };
}
