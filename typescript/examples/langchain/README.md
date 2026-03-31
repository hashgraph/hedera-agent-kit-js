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

### Return Bytes Agent (Web / Robust Parsing)
`npm run langchain:return-bytes-tool-calling-agent-web`
A variant of the Return Bytes agent with robust parsing logic for handling various Buffer serialization formats (e.g. browser `Uint8Array`, JSON objects).
