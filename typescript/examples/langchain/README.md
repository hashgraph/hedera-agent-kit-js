# Hedera Agent Kit - LangChain Examples

This directory contains examples of using the Hedera Agent Kit with LangChain (Classic).
For more information navigate to (DEVEXAMPLES.md)[https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md]

## Available Agents

### Tool Calling Agent
`npm run langchain:tool-calling-agent`
A basic agent that can natively call tools.

### Structured Chat Agent
`npm run langchain:structured-chat-agent`
An agent that uses a structured chat prompt.

### Return Bytes Agent (Human-in-the-Loop)
`npm run langchain:return-bytes-tool-calling-agent`
An agent that returns transaction bytes for manual signing/execution instead of executing them directly.

#### Migration note (breaking change)

`RETURN_BYTES` now standardizes `raw.bytes` to `Uint8Array` across Node.js and web. If you previously parsed Node-specific Buffer payloads (`{ type: 'Buffer', data: [...] }`), migrate to a `Uint8Array` parser.

Before:

```ts
const realBytes = Buffer.isBuffer(bytesObject)
  ? bytesObject
  : Buffer.from(bytesObject.data);
```

After:
```ts
const bytes = toolCall.parsedData.raw.bytes;
const tx = Transaction.fromBytes(bytes);
```
