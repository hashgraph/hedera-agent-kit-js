# Hedera Agent Kit - LangChain Policy System Example

This example demonstrates how to use the "DIY" Policy System with a **LangChain agent**.

## Overview

The example initializes a `HederaLangchainToolkit` with two policies:
1. **RequiredMemoPolicy**: Blocks any transaction that does not have a memo.
2. **MaxHbarTransferPolicy**: Blocks any HBAR transfer greater than 5 HBAR.

The agent uses `gpt-4o-mini` to interpret natural language commands and execute Hedera tools. If the agent attempts an action that violates a policy, the tool execution will fail, and the error will be returned to the agent (and logged).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Fill in your:
   - Hedera Testnet Account ID
   - Hedera Testnet Private Key
   - OpenAI API Key

3. Run the demo:
   ```bash
   npm start
   ```

## Usage

Try asking the agent:

> "Transfer 1 HBAR to 0.0.12345"
*(This should fail and show an error about missing memo)*

> "Transfer 10 HBAR to 0.0.12345 with memo 'Too much'"
*(This should fail and show an error about max amount)*

> "Transfer 1 HBAR to 0.0.12345 with memo 'Valid transaction'"
*(This should succeed)*
