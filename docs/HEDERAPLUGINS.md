# Available Tools

The Hedera Agent Kit provides a comprehensive set of tools organized into **plugins** by the type of Hedera service they
interact with. These tools can be used by an AI agent, like the ones in the `typescript/examples` folder, and enable a
user to interact with Hedera services using natural language.

Want additional Hedera
tools? [Open an issue](https://github.com/hedera-dev/hedera-agent-kit/issues/new?template=toolkit_feature_request.yml&labels=feature-request).

## Plugin Architecture

The tools are organized into plugins, each containing related functionality:

* **Core Account Plugin**: Tools for Hedera Account Service operations
* **Core Account Query Plugin**: Tools for querying Hedera Account Service related data
* **Core Consensus Plugin**: Tools for Hedera Consensus Service (HCS) operations
* **Core Consensus Query Plugin**: Tools for querying Hedera Consensus Service (HCS) related data
* **Core Token Plugin**: Tools for Hedera Token Service (HTS) operations
* **Core Token Query Plugin**: Tools for querying Hedera Token Service related data
* **Core EVM Plugin**: Tools for interacting with EVM smart contracts on Hedera (ERC-20 and ERC-721)
* **Core EVM Query Plugin**: Tools for querying smart contract-related data on Hedera
* **Core Misc Query Plugin**: Tools for fetching miscellaneous information from Hedera Mirror Node
* **Core Transaction Query Plugin**: Tools for handling Hedera transaction–related queries

See [an example of how to create a plugin](../typescript/examples/plugin/example-plugin.ts) as well as how they can be
used to build with using [Langchain](../typescript/examples/langchain/plugin-tool-calling-agent.ts) or using
the [Vercel AI SDK](../typescript/examples/ai-sdk/plugin-tool-calling-agent.ts).

Plugins can be found in [typescript/src/plugins](../typescript/src/plugins)

---

## Plugins and Available Tools

### Core Account Plugin Tools (`core-account-plugin`)

This plugin provides tools for Hedera **Account Service operations**:

| Tool Name                                                                                 | Description                                      | Details                                                                          |
|-------------------------------------------------------------------------------------------|--------------------------------------------------|----------------------------------------------------------------------------------|
| [`TRANSFER_HBAR_TOOL`](./HEDERATOOLS.md#transfer_hbar_tool)                               | Transfer HBAR between accounts                   | [View Parameters & Examples](./HEDERATOOLS.md#transfer_hbar_tool)                |
| [`APPROVE_HBAR_ALLOWANCE_TOOL`](./HEDERATOOLS.md#approve_hbar_allowance_tool)             | Approve an HBAR spending allowance               | [View Parameters & Examples](./HEDERATOOLS.md#approve_hbar_allowance_tool)       |
| [`DELETE_HBAR_ALLOWANCE_TOOL`](./HEDERATOOLS.md#delete_hbar_allowance_tool)               | Delete an HBAR allowance                         | [View Parameters & Examples](./HEDERATOOLS.md#delete_hbar_allowance_tool)        |
| [`TRANSFER_HBAR_WITH_ALLOWANCE_TOOL`](./HEDERATOOLS.md#transfer_hbar_with_allowance_tool) | Transfer HBAR using an allowance                 | [View Parameters & Examples](./HEDERATOOLS.md#transfer_hbar_with_allowance_tool) |
| [`CREATE_ACCOUNT_TOOL`](./HEDERATOOLS.md#create_account_tool)                             | Create a new Hedera account                      | [View Parameters & Examples](./HEDERATOOLS.md#create_account_tool)               |
| [`UPDATE_ACCOUNT_TOOL`](./HEDERATOOLS.md#update_account_tool)                             | Update an account's metadata                     | [View Parameters & Examples](./HEDERATOOLS.md#update_account_tool)               |
| [`DELETE_ACCOUNT_TOOL`](./HEDERATOOLS.md#delete_account_tool)                             | Delete an account                                | [View Parameters & Examples](./HEDERATOOLS.md#delete_account_tool)               |
| [`SIGN_SCHEDULE_TRANSACTION_TOOL`](./HEDERATOOLS.md#sign_schedule_transaction_tool)       | Sign a scheduled transaction                     | [View Parameters & Examples](./HEDERATOOLS.md#sign_schedule_transaction_tool)    |
| [`SCHEDULE_DELETE_TOOL`](./HEDERATOOLS.md#schedule_delete_tool)                           | Delete a scheduled transaction                   | [View Parameters & Examples](./HEDERATOOLS.md#schedule_delete_tool)              |

---

### Core Account Query Plugin Tools (`core-account-query-plugin`)

This plugin provides tools for fetching **Account Service (HAS)** related information from Hedera Mirror Node.

| Tool Name                                                                                             | Description                                          | Details                                                                                  |
|-------------------------------------------------------------------------------------------------------|------------------------------------------------------|------------------------------------------------------------------------------------------|
| [`GET_ACCOUNT_QUERY_TOOL`](./HEDERATOOLS.md#get_account_query_tool)                                   | Returns comprehensive account information            | [View Parameters & Examples](./HEDERATOOLS.md#get_account_query_tool)                    |
| [`GET_HBAR_BALANCE_QUERY_TOOL`](./HEDERATOOLS.md#get_hbar_balance_query_tool)                         | Returns the HBAR balance for a given account         | [View Parameters & Examples](./HEDERATOOLS.md#get_hbar_balance_query_tool)               |
| [`GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL`](./HEDERATOOLS.md#get_account_token_balances_query_tool)     | Returns token balances for a Hedera account          | [View Parameters & Examples](./HEDERATOOLS.md#get_account_token_balances_query_tool)     |

---

### Core Consensus Plugin Tools (`core-consensus-plugin`)

A plugin for **Consensus Service (HCS)**, enabling creation and posting to topics.

| Tool Name                                                                     | Description                                       | Details                                                                      |
|-------------------------------------------------------------------------------|---------------------------------------------------|------------------------------------------------------------------------------|
| [`CREATE_TOPIC_TOOL`](./HEDERATOOLS.md#create_topic_tool)                     | Create a new topic on the Hedera network          | [View Parameters & Examples](./HEDERATOOLS.md#create_topic_tool)             |
| [`SUBMIT_TOPIC_MESSAGE_TOOL`](./HEDERATOOLS.md#submit_topic_message_tool)     | Submit a message to a topic                       | [View Parameters & Examples](./HEDERATOOLS.md#submit_topic_message_tool)     |
| [`DELETE_TOPIC_TOOL`](./HEDERATOOLS.md#delete_topic_tool)                     | Delete a topic on the Hedera network              | [View Parameters & Examples](./HEDERATOOLS.md#delete_topic_tool)             |
| [`UPDATE_TOPIC_TOOL`](./HEDERATOOLS.md#update_topic_tool)                     | Update a topic on the Hedera network              | [View Parameters & Examples](./HEDERATOOLS.md#update_topic_tool)             |

---

### Core Consensus Query Plugin Tools (`core-consensus-query-plugin`)

This plugin provides tools for fetching **Consensus Service (HCS)** related information from Hedera Mirror Node.

| Tool Name                                                                         | Description                                             | Details                                                                          |
|-----------------------------------------------------------------------------------|---------------------------------------------------------|----------------------------------------------------------------------------------|
| [`GET_TOPIC_INFO_QUERY_TOOL`](./HEDERATOOLS.md#get_topic_info_query_tool)         | Returns information for a given HCS topic               | [View Parameters & Examples](./HEDERATOOLS.md#get_topic_info_query_tool)         |
| [`GET_TOPIC_MESSAGES_QUERY_TOOL`](./HEDERATOOLS.md#get_topic_messages_query_tool) | Returns messages for a given HCS topic                  | [View Parameters & Examples](./HEDERATOOLS.md#get_topic_messages_query_tool)     |

---

### Core Token Plugin Tools (`core-token-plugin`)

A plugin for the Hedera **Token Service (HTS)**, enabling creation and management of fungible and non-fungible tokens.

| Tool Name                                                                                                       | Description                                              | Details                                                                                            |
|-----------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [`CREATE_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#create_fungible_token_tool)                                     | Creates a fungible token on Hedera                       | [View Parameters & Examples](./HEDERATOOLS.md#create_fungible_token_tool)                          |
| [`CREATE_NON_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#create_non_fungible_token_tool)                             | Creates a non-fungible token (NFT) on Hedera             | [View Parameters & Examples](./HEDERATOOLS.md#create_non_fungible_token_tool)                      |
| [`MINT_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#mint_fungible_token_tool)                                         | Mints additional supply of a fungible token              | [View Parameters & Examples](./HEDERATOOLS.md#mint_fungible_token_tool)                            |
| [`MINT_NON_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#mint_non_fungible_token_tool)                                 | Mints NFTs with unique metadata                          | [View Parameters & Examples](./HEDERATOOLS.md#mint_non_fungible_token_tool)                        |
| [`ASSOCIATE_TOKEN_TOOL`](./HEDERATOOLS.md#associate_token_tool)                                                 | Associates one or more tokens with an account            | [View Parameters & Examples](./HEDERATOOLS.md#associate_token_tool)                                |
| [`DISSOCIATE_TOKEN_TOOL`](./HEDERATOOLS.md#dissociate_token_tool)                                               | Dissociates one or more tokens from an account           | [View Parameters & Examples](./HEDERATOOLS.md#dissociate_token_tool)                               |
| [`UPDATE_TOKEN_TOOL`](./HEDERATOOLS.md#update_token_tool)                                                       | Update token metadata                                    | [View Parameters & Examples](./HEDERATOOLS.md#update_token_tool)                                   |
| [`AIRDROP_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#airdrop_fungible_token_tool)                                   | Airdrops a fungible token to multiple recipients         | [View Parameters & Examples](./HEDERATOOLS.md#airdrop_fungible_token_tool)                         |
| [`APPROVE_TOKEN_ALLOWANCE_TOOL`](./HEDERATOOLS.md#approve_token_allowance_tool)                                 | Approve fungible token spending allowances               | [View Parameters & Examples](./HEDERATOOLS.md#approve_token_allowance_tool)                        |
| [`DELETE_TOKEN_ALLOWANCE_TOOL`](./HEDERATOOLS.md#delete_token_allowance_tool)                                   | Delete fungible token allowance(s)                       | [View Parameters & Examples](./HEDERATOOLS.md#delete_token_allowance_tool)                         |
| [`TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL`](./HEDERATOOLS.md#transfer_fungible_token_with_allowance_tool)   | Transfers fungible token using an allowance              | [View Parameters & Examples](./HEDERATOOLS.md#transfer_fungible_token_with_allowance_tool)         |
| [`APPROVE_NFT_ALLOWANCE_TOOL`](./HEDERATOOLS.md#approve_nft_allowance_tool)                                     | Approve NFT allowances                                   | [View Parameters & Examples](./HEDERATOOLS.md#approve_nft_allowance_tool)                          |
| [`TRANSFER_NON_FUNGIBLE_TOKEN_TOOL`](./HEDERATOOLS.md#transfer_non_fungible_token_tool)                         | Transfers NFTs from operator's account                   | [View Parameters & Examples](./HEDERATOOLS.md#transfer_non_fungible_token_tool)                    |
| [`TRANSFER_NFT_WITH_ALLOWANCE_TOOL`](./HEDERATOOLS.md#transfer_nft_with_allowance_tool)                         | Transfers NFTs using an allowance                        | [View Parameters & Examples](./HEDERATOOLS.md#transfer_nft_with_allowance_tool)                    |

---

### Core Token Query Plugin Tools (`core-token-query-plugin`)

This plugin provides tools for fetching **Token Service (HTS)** related information from Hedera Mirror Node.

| Tool Name                                                                       | Description                                   | Details                                                                        |
|---------------------------------------------------------------------------------|-----------------------------------------------|--------------------------------------------------------------------------------|
| [`GET_TOKEN_INFO_QUERY_TOOL`](./HEDERATOOLS.md#get_token_info_query_tool)       | Returns details of a given token (HTS)        | [View Parameters & Examples](./HEDERATOOLS.md#get_token_info_query_tool)       |
| [`GET_PENDING_AIRDROP_TOOL`](./HEDERATOOLS.md#get_pending_airdrop_tool)         | Returns pending airdrops for a Hedera account | [View Parameters & Examples](./HEDERATOOLS.md#get_pending_airdrop_tool)        |

---

### Core EVM Plugin Tools (`core-evm-plugin`)

This plugin provides tools for interacting with EVM smart contracts on Hedera, including creating and managing ERC-20 and ERC-721 tokens via on-chain factory contracts and standard function calls.

| Tool Name                                                             | Description                                           | Details                                                                  |
|-----------------------------------------------------------------------|-------------------------------------------------------|--------------------------------------------------------------------------|
| [`CREATE_ERC20_TOOL`](./HEDERATOOLS.md#create_erc20_tool)             | Deploys a new ERC-20 token via the BaseERC20Factory   | [View Parameters & Examples](./HEDERATOOLS.md#create_erc20_tool)         |
| [`TRANSFER_ERC20_TOOL`](./HEDERATOOLS.md#transfer_erc20_tool)         | Transfers an ERC-20 token                             | [View Parameters & Examples](./HEDERATOOLS.md#transfer_erc20_tool)       |
| [`CREATE_ERC721_TOOL`](./HEDERATOOLS.md#create_erc721_tool)           | Deploys a new ERC-721 token via the BaseERC721Factory | [View Parameters & Examples](./HEDERATOOLS.md#create_erc721_tool)        |
| [`MINT_ERC721_TOOL`](./HEDERATOOLS.md#mint_erc721_tool)               | Mints a new ERC-721 token                             | [View Parameters & Examples](./HEDERATOOLS.md#mint_erc721_tool)          |
| [`TRANSFER_ERC721_TOOL`](./HEDERATOOLS.md#transfer_erc721_tool)       | Transfers an ERC-721 token                            | [View Parameters & Examples](./HEDERATOOLS.md#transfer_erc721_tool)      |

---

### Core EVM Query Plugin Tools (`core-evm-query-plugin`)

This plugin provides tools for fetching EVM smart contract-related information from Hedera Mirror Node.

| Tool Name                                                                      | Description                               | Details                                                                      |
|--------------------------------------------------------------------------------|-------------------------------------------|------------------------------------------------------------------------------|
| [`GET_CONTRACT_INFO_QUERY_TOOL`](./HEDERATOOLS.md#get_contract_info_query_tool)| Returns details of a given smart contract | [View Parameters & Examples](./HEDERATOOLS.md#get_contract_info_query_tool)  |

---

### Core Transaction Query Plugin Tools (`core-transactions-query-plugin`)

Tools for **transaction-related queries** on Hedera.

| Tool Name                                                                                   | Description                                | Details                                                                              |
|---------------------------------------------------------------------------------------------|--------------------------------------------|--------------------------------------------------------------------------------------|
| [`GET_TRANSACTION_RECORD_QUERY_TOOL`](./HEDERATOOLS.md#get_transaction_record_query_tool)   | Returns details for a given transaction id | [View Parameters & Examples](./HEDERATOOLS.md#get_transaction_record_query_tool)     |

---

### Core Misc Query Plugin Tools (`core-misc-query-plugin`)

This plugin provides tools for fetching miscellaneous information from the Hedera Mirror Node.

| Tool Name                                                               | Description                                   | Details                                                                  |
|-------------------------------------------------------------------------|-----------------------------------------------|--------------------------------------------------------------------------|
| [`GET_EXCHANGE_RATE_TOOL`](./HEDERATOOLS.md#get_exchange_rate_tool)     | Returns the Hedera network HBAR exchange rate | [View Parameters & Examples](./HEDERATOOLS.md#get_exchange_rate_tool)    |

---

## Scheduled Transactions

Scheduled transactions are **not separate tools** — they use the *same tools* you already know (for example,
`UPDATE_ACCOUNT_TOOL`, `TRANSFER_HBAR_TOOL`, etc.), but with **additional optional parameters** passed in a
`schedulingParams` object.

From the user's perspective, scheduling simply means asking to **execute a transaction later**, or **once all signatures
are collected**, instead of immediately.

If `schedulingParams.isScheduled` is `false` or omitted, all other scheduling parameters are ignored.

### Supported Tools

The following tools support scheduling:

- `TRANSFER_HBAR_TOOL`
- `CREATE_ACCOUNT_TOOL`
- `UPDATE_ACCOUNT_TOOL`
- `CREATE_FUNGIBLE_TOKEN_TOOL`
- `CREATE_NON_FUNGIBLE_TOKEN_TOOL`
- `MINT_FUNGIBLE_TOKEN_TOOL`
- `MINT_NON_FUNGIBLE_TOKEN_TOOL`
- `TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL`
- `CREATE_ERC20_TOOL`
- `TRANSFER_ERC20_TOOL`
- `CREATE_ERC721_TOOL`
- `MINT_ERC721_TOOL`
- `TRANSFER_ERC721_TOOL`

### Scheduling Parameters

| Parameter                             | Type                | Default              | Description                                                                                                      |
|---------------------------------------|---------------------|----------------------|------------------------------------------------------------------------------------------------------------------|
| `schedulingParams.isScheduled`        | `boolean`           | `false`              | If `true`, the transaction will be created as a scheduled transaction.                                           |
| `schedulingParams.adminKey`           | `boolean \| string` | `false`              | Admin key that can delete or modify the scheduled transaction. Pass `true` to use operator key.                  |
| `schedulingParams.payerAccountId`     | `string`            | *(operator account)* | Account that will pay the transaction fee when executed.                                                         |
| `schedulingParams.expirationTime`     | `string` (ISO 8601) | —                    | Time when the scheduled transaction will expire if not fully signed.                                             |
| `schedulingParams.waitForExpiry`      | `boolean`           | `false`              | If `true`, execute at expiration time even if not all signatures are collected. Requires `expirationTime`.       |

### Example Prompts

```
Schedule a mint for token 0.0.5005 with metadata https://example.com/nft/1.json
```

```
Schedule Mint 0.0.5005 with metadata: ipfs://baf/metadata.json. Make it expire at 11.11.2025 10:00:00.
```

```
Schedule mint for token 0.0.5005 with URI ipfs://QmTest123 and use my operator key as admin key
```

---

## Using Hedera Plugins

Take a look at the example [tool-calling-agent.ts](../typescript/examples/langchain/tool-calling-agent.ts) for a
complete example of how to use the Hedera plugins.

First, you will need to import the core plugins, which contain all the tools you may want to use such as
`coreAccountPlugin`.

You also have the option to pick and choose which tools from a Hedera plugin you want to enable. If you choose to do
this, only the tools specified will be usable.

```javascript
import {
  AgentMode,
  Configuration,
  Context,
  coreAccountPlugin,
  coreAccountQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
  coreTokenPlugin,
  coreTokenQueryPlugin,
  coreEVMPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
} from 'hedera-agent-kit';
```

You will instantiate the HederaAgentToolkit with your chosen framework, defining the tools and plugins you want to use:

```javascript
const hederaAgentToolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    tools: [
      CREATE_FUNGIBLE_TOKEN_TOOL,
      MINT_FUNGIBLE_TOKEN_TOOL,
      TRANSFER_HBAR_TOOL,
      GET_ACCOUNT_QUERY_TOOL,
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