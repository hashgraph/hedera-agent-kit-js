# Available Tools

The Hedera Agent Kit provides a comprehensive set of tools organized into **plugins** by the type of Hedera service they
interact with. These tools can be used by an AI agent, like the ones in the `typescript/examples` folder, and enable a
user to interact with Hedera services using natural language.

Want additional Hedera
tools? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request).

## Plugin Architecture

The tools are now organized into plugins, each containing related functionality:

* **Core Account Plugin**: Tools for Hedera Account Service operations
* **Core Account Query Plugin**: Tools for querying Hedera Account Service related data
* **Core Consensus Plugin**: Tools for Hedera Consensus Service (HCS) operations
* **Core Consensus Query Plugin**: Tools for querying Hedera Consensus Service (HCS) related data
* **Core Token Plugin**: Tools for Hedera Token Service (HTS) operations
* **Core Token Query Plugin**: Tools for querying Hedera Token Service related data
* **Core EVM Plugin**: Tools for interacting with EVM smart contracts on Hedera (ERC-20 and ERC-721)
* **Core EVM Query Plugin**: Tools for querying smart contract–related data on Hedera
* **Core Transactions Plugin**: Tools for handling Hedera transaction–related operations

> ⚠️ **Note**: The **Core Hedera Queries Plugin** (`core-queries-plugin`) is now **deprecated**.
> Its tools have been split into their respective **query plugins** (Account, Token, Consensus, and EVM).

See [an example of how to create a plugin](../typescript/examples/plugin/example-plugin.ts) as well as how they can be
used to build with using [Langchain](../typescript/examples/langchain/plugin-tool-calling-agent.ts) or using
the [Vercel AI SDK](../typescript/examples/ai-sdk/plugin-tool-calling-agent.ts)

Plugins can be found in [typescript/src/plugins](../typescript/src/plugins)

## Plugins and Available Tools

### Core Account Plugin Tools (`core-account-plugin`)

This plugin provides tools for Hedera **Account Service operations**:

| Tool Name             | Description                                                                                                    | Usage                                                                                                                                                                                                      |
|-----------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `TRANSFER_HBAR_TOOL`  | Transfer HBAR between accounts                                                                                 | Provide the amount of HBAR to transfer, the account to transfer to, and optionally, a transaction memo.                                                                                                    |
| `CREATE_ACCOUNT_TOOL` | Creates a new Hedera account, either for a provided public key or for the operator account’s generated keypair | Provide agreement text, type of key that should be generated, and optionally account memo, initial balance, and max auto-association                                                                       |
| `UPDATE_ACCOUNT_TOOL` | Update an account's metadata                                                                                   | Provide the account ID (required), the max automatic token associations (optional), the staking account ID (optional), account memo (optional), and whether staking rewards should be declined (optional). |
| `DELETE_ACCOUNT_TOOL` | Delete an account and transfer its assets to a specified account                                               | Provide the account ID to delete (required) and a transfer account ID (optional). If not specified, the operator’s account will be used.                                                                   |
| `SIGN_SCHEDULE_TRANSACTION_TOOL` | Signs a scheduled transaction on the Hedera network | Provide the schedule ID (required) of the scheduled transaction to sign. Returns the transaction ID upon successful signing. |


---

### Core Account Query Plugin Tools (`core-account-query-plugin`)

This plugin provides tools for fetching **Account Service (HAS)** related information from Hedera Mirror Node.

| Tool Name                               | Description                                                          | Usage                                                                                                                   |
|-----------------------------------------|----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `GET_ACCOUNT_QUERY_TOOL`                | Returns comprehensive account information for a given Hedera account | Provide an account ID to query                                                                                          |
| `GET_HBAR_BALANCE_QUERY_TOOL`           | Returns the HBAR balance for a given Hedera account                  | Provide an account ID to query (optional – defaults to operator account)                                                |
| `GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL` | Returns token balances for a Hedera account                          | Provide the account ID to query (optional – defaults to operator account). Optionally specify a token ID for filtering. |

---

### Core Consensus Plugin Tools (`core-consensus-plugin`)

A plugin for **Consensus Service (HCS)**, enabling creation and posting to topics.

| Tool Name                   | Description                                       | Usage                                                                               |
|-----------------------------|---------------------------------------------------|-------------------------------------------------------------------------------------|
| `CREATE_TOPIC_TOOL`         | Create a new topic on the Hedera network          | Optionally provide a topic memo (string) and whether to set a submit key (boolean). |
| `SUBMIT_TOPIC_MESSAGE_TOOL` | Submit a message to a topic on the Hedera network | Provide the topic ID (required) and the message to submit (required).               |

---

### Core Consensus Query Plugin Tools (`core-consensus-query-plugin`)

This plugin provides tools for fetching **Consensus Service (HCS)** related information from Hedera Mirror Node.

| Tool Name                       | Description                                                       | Usage                                                                                                      |
|---------------------------------|-------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `GET_TOPIC_MESSAGES_QUERY_TOOL` | Returns messages for a given Hedera Consensus Service (HCS) topic | Provide the topic ID (required). Optionally provide start time, end time, and limit for message filtering. |

---

### Core Token Plugin Tools (`core-token-plugin`)

A plugin for the Hedera **Token Service (HTS)**, enabling creation and management of fungible
and non-fungible tokens.

| Tool Name                        | Description                                               | Usage                                                                                                                                                                                             |
|----------------------------------|-----------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_FUNGIBLE_TOKEN_TOOL`     | Creates a fungible token on Hedera                        | Provide the token name (required). Optionally set symbol, initial supply, supply type ("finite" or "infinite"), max supply, decimals, treasury account ID (defaults to operator), and supply key. |
| `CREATE_NON_FUNGIBLE_TOKEN_TOOL` | Creates a non-fungible token (NFT) on Hedera              | Provide token name and symbol. Optionally set max supply (defaults to 100) and treasury account ID.                                                                                               |
| `AIRDROP_FUNGIBLE_TOKEN_TOOL`    | Airdrops a fungible token to multiple recipients          | Provide the token ID and recipients array. Optionally specify a source account ID (defaults to operator) and transaction memo.                                                                    |
| `MINT_NON_FUNGIBLE_TOKEN_TOOL`   | Mints NFTs with unique metadata for an existing NFT class | Provide the token ID and metadata URIs.                                                                                                                                                           |
| `MINT_FUNGIBLE_TOKEN_TOOL`       | Mints additional supply of an existing fungible token     | Provide the token ID and amount to mint.                                                                                                                                                          |

---

### Core Token Query Plugin Tools (`core-token-query-plugin`)

This plugin provides tools for fetching **Token Service (HTS)** related information from Hedera Mirror Node.

| Tool Name                    | Description                                   | Usage                                             |
|------------------------------|-----------------------------------------------|---------------------------------------------------|
| `GET_TOKEN_INFO_QUERY_TOOL`  | Returns details of a given token (HTS)        | Provide the token ID (required).                  |
| `GET_PENDING_AIRDROP_TOOL`   | Returns pending airdrops for a Hedera account | Provide the account ID (optional, defaults to operator). |

---

### Core EVM Plugin Tools (`core-evm-plugin`)

This plugin provides tools for interacting with EVM smart contracts on Hedera, including creating and managing ERC-20
and ERC-721 tokens via on-chain factory contracts and standard function calls.

| Tool Name              | Description                                           | Usage                                                                                                          |
|------------------------|-------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `CREATE_ERC20_TOOL`    | Deploys a new ERC-20 token via the BaseERC20Factory   | Provide token name and symbol (required). Optionally set decimals (default 18) and initial supply (default 0). |
| `TRANSFER_ERC20_TOOL`  | Transfers an ERC-20 token                             | Provide contract ID, recipient address, and amount. Supports both EVM and Hedera IDs.                          |
| `CREATE_ERC721_TOOL`   | Deploys a new ERC-721 token via the BaseERC721Factory | Provide token name, symbol, and base URI (all required).                                                       |
| `MINT_ERC721_TOOL`     | Mints a new ERC-721 token                             | Provide contract ID and recipient address. Supports both EVM and Hedera IDs.                                   |
| `TRANSFER_ERC721_TOOL` | Transfers an ERC-721 token                            | Provide contract ID, from address, to address, and token ID. Supports both EVM and Hedera IDs.                 |

---

### Core EVM Query Plugin Tools (`core-evm-query-plugin`)

This plugin provides tools for fetching EVM smart contract-related information from Hedera Mirror Node.

| Tool Name                      | Description                               | Usage                               |
|--------------------------------|-------------------------------------------|-------------------------------------|
| `GET_CONTRACT_INFO_QUERY_TOOL` | Returns details of a given smart contract | Provide the contract ID (required). |

---

### Core Transactions Plugin Tools (`core-transactions-plugin`)

Tools for **transaction-related operations** on Hedera.

| Tool Name                           | Description                                | Usage                                                                         |
|-------------------------------------|--------------------------------------------|-------------------------------------------------------------------------------|
| `GET_TRANSACTION_RECORD_QUERY_TOOL` | Returns details for a given transaction id | Provide the transaction ID (required). Optionally, provide transaction nonce. |

---

### Core Misc Queries Plugin Tools (`core-misc-query-plugin`)

This plugin provides tools for fetching miscellaneous information from the Hedera Mirror Node.

| Tool Name                 | Description                                              | Usage                                                                                       |
|---------------------------|----------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `GET_EXCHANGE_RATE_TOOL`  | Returns the Hedera network HBAR exchange rate            | Optionally provide `timestamp` (seconds or nanos since epoch) to query a historical rate.   |

---

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
  coreAccountQueryPlugin,
  coreConsensusQueryPlugin,
  coreTokenQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
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
      MINT_FUNGIBLE_TOKEN_TOOL,
      CREATE_ERC20_TOOL,
      TRANSFER_HBAR_TOOL,
      GET_ACCOUNT_QUERY_TOOL,
      GET_CONTRACT_INFO_QUERY_TOOL,
      // etc.
    ], // use an empty array if you want to load all tools
    context: {
      mode: AgentMode.AUTONOMOUS,
    },
    plugins: [
      coreAccountPlugin,
      coreAccountQueryPlugin,
      coreConsensusPlugin,
      coreConsensusQueryPlugin,
      coreTokenPlugin,
      coreTokenQueryPlugin,
      coreEVMPlugin,
      coreEVMQueryPlugin,
      coreMiscQueriesPlugin,
    ],
  },
});
  ```