import { Transaction } from "@hiero-ledger/sdk";

import { createSubmitClient } from "./hedera-client";

// Stateless POST. The user has signed the unsigned bytes the server emitted
// for an awaiting-approval card via their own CLI / wallet / signing pipeline,
// and is now handing them back so the server can broadcast. No operator key
// is required on the server: a fully-signed Hedera transaction can be
// submitted by anyone with network access.
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON");
  }

  if (typeof body.signedBytes !== "string" || body.signedBytes.length === 0) {
    return jsonError(400, "signedBytes (base64) is required");
  }

  let bytes;
  try {
    bytes = decodeBase64(body.signedBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(400, `Could not decode signedBytes as base64: ${message}`);
  }

  let tx;
  try {
    tx = Transaction.fromBytes(new Uint8Array(bytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(400, `Could not parse transaction bytes: ${message}`);
  }

  const client = createSubmitClient();
  try {
    const submission = await tx.execute(client);
    const receipt = await submission.getReceipt(client);
    const envelope = {
      raw: {
        status: receipt.status.toString(),
        transactionId: tx.transactionId?.toString() ?? "",
        accountId: receipt.accountId?.toString(),
        tokenId: receipt.tokenId?.toString(),
        topicId: receipt.topicId?.toString(),
        scheduleId: receipt.scheduleId?.toString(),
      },
      humanMessage: `Transaction submitted: ${receipt.status.toString()}.`,
    };
    return Response.json(envelope, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(502, message);
  } finally {
    client.close();
  }
}

function decodeBase64(value) {
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
    throw new Error("input contains non-base64 characters");
  }
  const buffer = Buffer.from(cleaned, "base64");
  if (buffer.length === 0) {
    throw new Error("input decoded to zero bytes");
  }
  return buffer;
}

function jsonError(status, message) {
  return Response.json({ error: message }, { status });
}
