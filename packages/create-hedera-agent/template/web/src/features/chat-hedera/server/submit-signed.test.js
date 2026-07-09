import { beforeEach, describe, expect, it, vi } from "vitest";

const submitMock = vi.fn();
const receiptMock = vi.fn();
const fromBytesMock = vi.fn();
const closeMock = vi.fn();

// Mock the SDK before importing the route. The route reads
// `Transaction.fromBytes`, `tx.execute(client)`, and `submission.getReceipt`.
// We replace those with controllable test doubles.
vi.mock("@hiero-ledger/sdk", () => {
  return {
    Transaction: {
      fromBytes: (bytes) => fromBytesMock(bytes),
    },
    // Stubs for hedera-client.ts; it imports these too.
    AccountId: { fromString: (id) => ({ id, toString: () => id }) },
    PublicKey: { fromString: (s) => ({ s }) },
    PrivateKey: {
      fromStringECDSA: (s) => ({
        s,
        publicKey: { toStringDer: () => `pub:${s}` },
      }),
      fromStringED25519: (s) => ({
        s,
        publicKey: { toStringDer: () => `pub:${s}` },
      }),
    },
    Client: {
      forTestnet: () => ({
        setOperator: vi.fn(),
        setOperatorWith: vi.fn(),
        close: closeMock,
      }),
      forMainnet: () => ({
        setOperator: vi.fn(),
        setOperatorWith: vi.fn(),
        close: closeMock,
      }),
    },
  };
});

const VALID_SIGNED_B64 = Buffer.from([1, 2, 3, 4]).toString("base64");

async function callPost(body) {
  const { POST } = await import(
    "@/features/chat-hedera/server/submit-signed"
  );
  return POST(
    new Request("http://localhost/api/transactions/submit-signed", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/transactions/submit-signed", () => {
  beforeEach(() => {
    submitMock.mockReset();
    receiptMock.mockReset();
    fromBytesMock.mockReset();
    closeMock.mockReset();
  });

  it("should return a normalized receipt envelope on success", async () => {
    fromBytesMock.mockReturnValue({
      transactionId: { toString: () => "0.0.1234@1700000000.000000000" },
      execute: () => submitMock(),
    });
    submitMock.mockResolvedValue({ getReceipt: () => receiptMock() });
    receiptMock.mockResolvedValue({
      status: { toString: () => "SUCCESS" },
      accountId: undefined,
      tokenId: { toString: () => "0.0.9999" },
      topicId: undefined,
      scheduleId: undefined,
    });

    const res = await callPost({ signedBytes: VALID_SIGNED_B64 });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.raw.status).toBe("SUCCESS");
    expect(body.raw.transactionId).toBe("0.0.1234@1700000000.000000000");
    expect(body.raw.tokenId).toBe("0.0.9999");
    expect(body.humanMessage).toContain("SUCCESS");
    expect(closeMock).toHaveBeenCalled();
  });

  it("should return 400 when signedBytes is missing", async () => {
    const res = await callPost({});

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signedBytes/);
  });

  it("should return 400 when the body is not valid JSON", async () => {
    const res = await callPost("not-json");

    expect(res.status).toBe(400);
  });

  it("should return 400 when signedBytes contains non-base64 characters", async () => {
    const res = await callPost({ signedBytes: "this is not @base64!" });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/base64/);
  });

  it("should return 400 when the bytes can't be parsed as a transaction", async () => {
    fromBytesMock.mockImplementation(() => {
      throw new Error("invalid protobuf");
    });

    const res = await callPost({ signedBytes: VALID_SIGNED_B64 });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid protobuf/);
  });

  it("should return 502 when the SDK submission fails", async () => {
    fromBytesMock.mockReturnValue({
      transactionId: { toString: () => "0.0.1234@x" },
      execute: () => submitMock(),
    });
    submitMock.mockRejectedValue(new Error("INVALID_SIGNATURE"));

    const res = await callPost({ signedBytes: VALID_SIGNED_B64 });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toMatch(/INVALID_SIGNATURE/);
  });
});
