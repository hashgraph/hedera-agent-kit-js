# Available Tools

The Hedera Agent Kit provides a comprehensive set of tools organized into **plugins** by the type of Hedera service they
interact with. These tools can be used by an AI agent, like the ones in the typescript/examples folder, and enable a
user to interact with Hedera services using natural language.

Want additional Hedera
tools? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request).

## Plugin Architecture

The tools are now organized into plugins, each containing related functionality:

- **Core Account Plugin**: Tools for Hedera Account Service operations
- **Core Consensus Plugin**: Tools for Hedera Consensus Service (HCS) operations
- **Core Token Plugin**: Tools for Hedera Token Service operations
- **Core EVM Plugin**: Tools for interacting with EVM smart contracts on Hedera (ERC-20 and ERC-721)
- **Core Queries Plugin**: Tools for querying Hedera network data

See [an example of how to create a plugin](../typescript/examples/plugin/example-plugin.ts) as well as how they can be
used to build with using [Langchain](../typescript/examples/langchain/plugin-tool-calling-agent.ts) or using
the [Vercel AI SDK](../typescript/examples/ai-sdk/plugin-tool-calling-agent.ts)

Plugins can be found in [typescript/src/plugins](../typescript/src/plugins)

## Plugins and Available Tools

### Core Account Plugin Tools (core-account-plugin)

This plugin provides tools for Hedera Account Service operations

| Tool Name             | Description                                                                                                       | Usage                                                                                                                                                                                                                                              |
|-----------------------|-------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `TRANSFER_HBAR_TOOL`  | Transfer HBAR between accounts                                                                                    | Provide the amount of of HBAR to transfer, the account to transfer to, and optionally, a transaction memo.                                                                                                                                         |
| `CREATE_ACCOUNT_TOOL` | Creates new hedera account, either for a provided public key, or for the keypair provided in the operator account | Provide agreement text, type of key that should be generated, and optionally account memo, initial balance and max auto association                                                                                                                |
| `UPDATE_ACCOUNT_TOOL` | Update an account's metadata                                                                                      | Provide the account ID to update (required), the max automatic token associations (number, optional), id of account to staked to (string, optional), account memo (string, optional) and if staking rewards should be declined (boolean, optional) |
| `DELETE_ACCOUNT_TOOL` | Delete an account and send all remaining assets to a specified account                                            | Provide the ID of account to delete (required) and the transfer account ID to send the remaining assets to (optional). If transfer account is not specified the operator's account ID will be used                                                 |

### Core Hedera Consensus Service Plugin Tools (core-consensus-plugin)

| Tool Name                   | Description                                       | Usage                                                                                                                                             |
|-----------------------------|---------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_TOPIC_TOOL`         | Create a new topic on the Hedera network          | Optionally provide a topic memo (string) and whether to set a submit key (boolean - set to true if you want to set a submit key, otherwise false) | 
| `SUBMIT_TOPIC_MESSAGE_TOOL` | Submit a message to a topic on the Hedera network | Provide the topic ID (string, required) and the message to submit (string, required)                                                              | 

### Core Hedera Token Service Plugin Tools (core-token-plugin)

A plugin for the Hedera Token Service (HTS), enabling you to create and manage fungible and non-funglible tokens on the
Hedera network

| Tool Name                        | Description                                                         | Usage                                                                                                                                                                                                                                                                                                                                                                  |
|----------------------------------|---------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_FUNGIBLE_TOKEN_TOOL`     | Creates a fungible token on Hedera                                  | Provide the token name (string, required). Optionally provide token symbol (string), initial supply (int), supply type ("finite" or "infinite", defaults to "finite"), max supply (int, defaults to 1,000,000 if finite), decimals (int, defaults to 0), treasury account ID (string, uses operator account if not specified), and whether to set supply key (boolean) |
| `CREATE_NON_FUNGIBLE_TOKEN_TOOL` | Creates a non-fungible token (NFT) on Hedera                        | Provide the token name and token symbol. Optionally provide max supply (defaults to 100) and treasury account ID                                                                                                                                                                                                                                                       |
| `AIRDROP_FUNGIBLE_TOKEN_TOOL`    | Airdrops a fungible token to multiple recipients on Hedera          | Provide the token ID and recipients array. Optionally provide source account ID (string, uses operator account if not specified) and transaction memo (string)                                                                                                                                                                                                         |
| `MINT_NON_FUNGIBLE_TOKEN_TOOL`   | Mints NFTs with unique metadata for an existing NFT class on Hedera | Provide the token ID and URIs array                                                                                                                                                                                                                                                                                                                                    |
| `MINT_FUNGIBLE_TOKEN_TOOL`       | Mints additional supply of an existing fungible token on Hedera     | Provide the token ID and amount to mint                                                                                                                                                                                                                                                                                                                                |

### Core EVM Plugin Tools (core-evm-plugin)

This plugin provides tools for interacting with EVM smart contracts on Hedera, including creating and managing ERC-20
and ERC-721 tokens via on-chain factory contracts and standard function calls.

| Tool Name              | Description                                           | Usage                                                                                                                                                                                                                 |
|------------------------|-------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_ERC20_TOOL`    | Deploys a new ERC-20 token via the BaseERC20Factory   | Provide the token name (string, required) and token symbol (string, required). Optionally provide decimals (int, defaults to 18) and initial supply (int, defaults to 0).                                             |
| `TRANSFER_ERC20_TOOL`  | Transfers an existing ERC-20 token                    | Provide the contract ID (string, required), recipient address (string, required), and amount to transfer (number, required). The contract ID and addresses can be either EVM addresses or Hedera IDs.                 |
| `CREATE_ERC721_TOOL`   | Deploys a new ERC-721 token via the BaseERC721Factory | Provide the token name (string, required), token symbol (string, required), and base URI (string, required).                                                                                                          |
| `MINT_ERC721_TOOL`     | Mints a new ERC-721 token                             | Provide the contract ID (string, required) and to address (string, required). The contract ID and address can be either EVM addresses or Hedera IDs.                                                                  |
| `TRANSFER_ERC721_TOOL` | Transfers an existing ERC-721 token                   | Provide the contract ID (string, required), from address (string, required), to address (string, required), and token ID (number, required). The contract ID and addresses can be either EVM addresses or Hedera IDs. |

### Core Hedera Queries Plugin Tools (core-queries-plugin)

These tools provided by the toolkit enable you to complete (free) queries against mirror nodes on the Hedera network.

| Tool Name                               | Description                                                          | Usage                                                                                                                               |
|-----------------------------------------|----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `GET_ACCOUNT_QUERY_TOOL`                | Returns comprehensive account information for a given Hedera account | Provide an account ID to query                                                                                                      |
| `GET_HBAR_BALANCE_QUERY_TOOL`           | Returns the HBAR balance for a given Hedera account                  | Requires a Hedera account ID to query (uses context operator account if not specified)                                              |
| `GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL` | Returns token balances for a Hedera account                          | Provide the account ID to query (optional - uses context account if not provided). Optionally, provide a specific token ID to query |
| `GET_TOPIC_MESSAGES_QUERY_TOOL`         | Returns messages for a given Hedera Consensus Service (HCS) topic    | Provide the topic ID to query (required). Optionally, provide start time, end time, and limit for message filtering                 |
| `GET_TOKEN_INFO_QUERY_TOOL`             | Returns details of a given token (HTS)                               | Provide the ID of token to query (required).                                                                                        |
| `GET_TRANSACTION_RECORD_QUERY_TOOL`     | Returns details for a given transaction id                           | Provide the transaction ID (required). Optionally, provide transaction nonce.                                                       |

## Using Hedera Plugins

Take a look at the example [tool-calling-agent.ts](../typescript/examples/langchain/tool-calling-agent.ts) for a
complete example of how to use the Hedera plugins.

First, you will need to import the core plugins, which contain all the tools you may want to use such as
`coreAccountPlugin`.

You also have the option to pick and choose which tools from a Hedera plugin you want to enable. If you choose to do
this, only the tools specified will be usable. You will need to import the constants for each tool name, such as
`coreAccountPluginToolNames`, which will enables you to pass specific tools to the configuration object.

`AgentMode` , `Configuration`, and `Context` are also required to be imported to configure the plugins.

```javascript
import {
  AgentMode,
  Configuration,
  Context,
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  coreEVMPlugin,
  coreEVMPluginToolNames,
  coreQueriesPlugin,
  coreQueriesPluginToolNames,
} from 'hedera-agent-kit';
```

You will instantiate the HederaAgentToolkit with your chosen framework, defining the tools and plugins you want to use,
and mode (AUTONOMOUS or RETURN_BYTES for human in the loop), as well as the plugins you wish to use:

```javascript
 const hederaAgentToolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    tools: [
      CREATE_FUNGIBLE_TOKEN_TOOL,
      CREATE_NON_FUNGIBLE_TOKEN_TOOL,
      AIRDROP_FUNGIBLE_TOKEN_TOOL,
      MINT_NON_FUNGIBLE_TOKEN_TOOL,
      CREATE_ERC20_TOOL,
      CREATE_ERC721_TOOL,
      TRANSFER_ERC20_TOOL,
      MINT_ERC721_TOOL,
      TRANSFER_ERC721_TOOL,
      TRANSFER_HBAR_TOOL,
      CREATE_TOPIC_TOOL,
      SUBMIT_TOPIC_MESSAGE_TOOL,
      GET_HBAR_BALANCE_QUERY_TOOL,
      GET_ACCOUNT_QUERY_TOOL,
      // etc.
    ], // use an empty array if you want to load all tools
    context: {
      mode: AgentMode.AUTONOMOUS,
    },
    plugins: [coreTokenPlugin, coreEVMPlugin, coreAccountPlugin, coreConsensusPlugin, coreQueriesPlugin],
  },
});
  ```