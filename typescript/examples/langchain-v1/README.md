# Hedera Agent Kit - LangChain v1 Examples

This directory contains examples of using the Hedera Agent Kit with LangChain v1.
For more information navigate to (DEVEXAMPLES.md)[https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md]

## Available Agents

### Plugin Tool Calling Agent
`npm run langchain:plugin-tool-calling-agent`
An agent that uses plugins for tool discovery.

### Return Bytes Agent (Human-in-the-Loop)
`npm run langchain:return-bytes-tool-calling-agent`
An agent that returns transaction bytes for manual signing/execution instead of executing them directly.

### Return Bytes Agent (Web / Robust Parsing)
`npm run langchain:return-bytes-tool-calling-agent-web`
A variant of the Return Bytes agent with robust parsing logic for handling various Buffer serialization formats (e.g. browser `Uint8Array`, JSON objects).
