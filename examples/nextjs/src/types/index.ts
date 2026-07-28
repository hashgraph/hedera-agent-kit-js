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

// Envelope returned by RETURN_BYTES mode tools (bytes + signing context)
export type PendingTransaction = {
  bytesBase64: string;
  transactionId?: string;
  payerAccountId?: string;
  transactionType?: string;
  expiresAt?: string;
  memo?: string;
};

export type WalletPrepareResponse = ApiResponse<{
  result?: string;
} & Partial<PendingTransaction>>;

export type ChatState = {
  messages: Message[];
  input: string;
  loading: boolean;
  error: string | null;
  pendingBytes: string | null;
};