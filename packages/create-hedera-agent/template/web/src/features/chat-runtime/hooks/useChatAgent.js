"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";

import {
  chatMessageFromUIMessage,
  chatMessagesToUIMessages,
  chatStatusFromAiSdk,
} from "../utils/mappers";

// `useChatAgent` is the chat substrate's sole client-side runtime entrypoint.
// Substrate code talks canonical `ChatMessage` / `ChatStatus` types in both
// directions; the hook hides ai-sdk specifics (transport, auto-resubmit,
// runtime status union) behind a stable interface that alternative runtime
// adapters (e.g. the LangChain overlay) implement with the same shape.

export function useChatAgent({
  id,
  initialMessages,
  getRequestBody,
  api = "/api/chat",
}) {
  // Ref the request-body contributor so the transport, captured once in the
  // useMemo below, always reads the freshest function. This is the same trick
  // the previous `modeRef`-with-`prepareSendMessagesRequest` flow used: the
  // SDK's auto-resubmit after `addToolResult` does not surface a per-call body
  // override, so the per-request hook has to source the latest values itself.
  const getRequestBodyRef = React.useRef(getRequestBody);
  React.useEffect(() => {
    getRequestBodyRef.current = getRequestBody;
  }, [getRequestBody]);

  // Materialize canonical initial messages once per chat id. ai-sdk's `useChat`
  // does not re-read its `messages` prop after mount. The chat is re-mounted
  // on chat-id change via the caller's React `key`, so a single conversion at
  // construction time is sufficient.
  const initialUIMessages = React.useMemo(
    () => chatMessagesToUIMessages(initialMessages),
    // Re-run only when the chat instance changes. Re-rendering with the same
    // initial messages must not rebuild the array. `useChat` would discard
    // streamed state otherwise.
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
    // Stable for the lifetime of the hook instance. Mode and other extension
    // contributions flow through the ref above; the transport itself never
    // needs to be rebuilt.
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
    // Preserve the auto-resubmit-after-tool-completion behavior: once every
    // tool call has a final output (success / failure / rejected), trigger
    // another model step so the agent sees the result.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const messages = React.useMemo(
    () => uiMessages.map((m) => chatMessageFromUIMessage(m)),
    [uiMessages],
  );

  const status = chatStatusFromAiSdk(aiSdkStatus);

  const sendMessage = React.useCallback(
    ({ text }) => sendUIMessage({ text }),
    [sendUIMessage],
  );

  const addToolResult = React.useCallback(
    async ({ tool, toolCallId, output }) => {
      await addUIToolResult({ tool, toolCallId, output });
    },
    [addUIToolResult],
  );

  return { messages, status, error, sendMessage, stop, addToolResult };
}
