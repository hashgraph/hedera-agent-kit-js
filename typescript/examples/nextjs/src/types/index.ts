export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type AgentMode = "human" | "auto";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  error?: string;
  mode?: AgentMode;
  network?: string;
} & T;

export type AgentResponse = ApiResponse<{
  result: string;
}>;

export type WalletPrepareResponse = ApiResponse<{
  result?: string;
  bytesBase64?: string;
}>;

export type ChatState = {
  messages: Message[];
  input: string;
  loading: boolean;
  error: string | null;
  pendingBytes: string | null;
};