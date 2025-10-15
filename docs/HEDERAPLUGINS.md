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
* **Core EVM Query Plugin**: Tools for querying smart contract-related data on Hedera
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

| Tool Name                        | Description                                                                                                    | Usage                                                                                                                                                                                                                                       |
|----------------------------------|----------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `TRANSFER_HBAR_TOOL`             | Transfer HBAR between accounts                                                                                 | Provide the amount of HBAR to transfer, the account to transfer to, and optionally, a transaction memo. Supports scheduled transactions.                                                                                                    |
| `APPROVE_HBAR_ALLOWANCE_TOOL`    | Approve an HBAR spending allowance for a spender account                                                       | Provide optional owner account ID (defaults to operator if omitted), the spender account ID (required), the HBAR amount to approve (decimal supported, cannot be negative), and an optional transaction memo.                               |
| `DELETE_HBAR_ALLOWANCE_TOOL`     | Deletes an HBAR allowance from an owner to a spender                                                           | Provide optional owner account ID (defaults to operator if omitted), the spender account ID (required), an optional transaction memo                                                                                                        |
| `CREATE_ACCOUNT_TOOL`            | Creates a new Hedera account, either for a provided public key or for the operator account’s generated keypair | Provide agreement text, type of key that should be generated, and optionally account memo, initial balance, and max auto-association. Supports scheduled transactions.                                                                      |
| `UPDATE_ACCOUNT_TOOL`            | Update an account's metadata                                                                                   | Provide the account ID (required), the max automatic token associations (optional), the staking account ID (optional), account memo (optional), and whether staking rewards should be declined (optional). Supports scheduled transactions. |
| `DELETE_ACCOUNT_TOOL`            | Delete an account and transfer its assets to a specified account                                               | Provide the account ID to delete (required) and a transfer account ID (optional). If not specified, the operator’s account will be used.                                                                                                    |
| `SIGN_SCHEDULE_TRANSACTION_TOOL` | Signs a scheduled transaction on the Hedera network                                                            | Provide the schedule ID (required) of the scheduled transaction to sign. Returns the transaction ID upon successful signing.                                                                                                                |
| `SCHEDULE_DELETE_TOOL`           | Delete a scheduled transaction so it will not execute                                                          | Provide the schedule ID (required) of the scheduled transaction to delete. Returns the transaction ID upon successful deletion.                                                                                                             |

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

| Tool Name                   | Description                                       | Usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|-----------------------------|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_TOPIC_TOOL`         | Create a new topic on the Hedera network          | Optionally provide a topic memo (string) and whether to set a submit key (boolean).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `SUBMIT_TOPIC_MESSAGE_TOOL` | Submit a message to a topic on the Hedera network | Provide the topic ID (required) and the message to submit (required).                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DELETE_TOPIC_TOOL`         | Delete a topic on the Hedera network              | Provide the topic ID (required)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `UPDATE_TOPIC_TOOL`         | Update a topic on the Hedera network              | Provide the topic ID (required) and any optional fields to update: topicMemo, autoRenewAccountId, autoRenewPeriod, expirationTime, and key fields (adminKey, submitKey). For key fields, you can either specify a Hedera public key explicitly or indicate “use my key,” in which case the tool will automatically use the public key of your connected account. Only keys that were specified on topic creation can be updated; Hedera does not allow deleting keys. Only the fields included will be updated. |

---

### Core Consensus Query Plugin Tools (`core-consensus-query-plugin`)

This plugin provides tools for fetching **Consensus Service (HCS)** related information from Hedera Mirror Node.

| Tool Name                       | Description                                                          | Usage                                                                                                      |
|---------------------------------|----------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `GET_TOPIC_MESSAGES_QUERY_TOOL` | Returns messages for a given Hedera Consensus Service (HCS) topic    | Provide the topic ID (required). Optionally provide start time, end time, and limit for message filtering. |
| `GET_TOPIC_INFO_QUERY_TOOL`     | Returns information for a given Hedera Consensus Service (HCS) topic | Provide the topic ID (required).                                                                           |

---

### Core Token Plugin Tools (`core-token-plugin`)

A plugin for the Hedera **Token Service (HTS)**, enabling creation and management of fungible
and non-fungible tokens.

| Tool Name                                     | Description                                                   | Usage                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|-----------------------------------------------|---------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_FUNGIBLE_TOKEN_TOOL`                  | Creates a fungible token on Hedera                            | Provide the token name (required). Optionally set symbol, initial supply, supply type ("finite" or "infinite"), max supply, decimals, treasury account ID (defaults to operator), and supply key. Supports scheduled transactions.                                                                                                                                                                                                                                                                                                                                                                     |
| `CREATE_NON_FUNGIBLE_TOKEN_TOOL`              | Creates a non-fungible token (NFT) on Hedera                  | Provide token name and symbol. Optionally set max supply (defaults to 100) and treasury account ID. Supports scheduled transactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `AIRDROP_FUNGIBLE_TOKEN_TOOL`                 | Airdrops a fungible token to multiple recipients              | Provide the token ID and recipients array. Optionally specify a source account ID (defaults to operator) and transaction memo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `MINT_NON_FUNGIBLE_TOKEN_TOOL`                | Mints NFTs with unique metadata for an existing NFT class     | Provide the token ID and metadata URIs. Supports scheduled transactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `MINT_FUNGIBLE_TOKEN_TOOL`                    | Mints additional supply of an existing fungible token         | Provide the token ID and amount to mint. Supports scheduled transactions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DISSOCIATE_FUNGIBLE_TOKEN_TOOL`              | Dissociates fungible tokens from an account                   | Provide an array of token IDs to dissociate. Optionally specify the account ID (defaults to operator) and a transaction memo                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                                                                                                                       |
| `ASSOCIATE_TOKEN_TOOL`                        | Associates one or more tokens with an account                 | Provide an array of token IDs to associate (required). Optionally specify the account ID to associate (defaults to operator account).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `UPDATE_TOKEN_TOOL`                           | Update token's metadata                                       | Provide the token ID (required) and any optional fields to update: tokenName, tokenSymbol, treasuryAccountId, tokenMemo, autoRenewAccountId, metadata, and key fields (adminKey, kycKey, freezeKey, wipeKey, supplyKey, feeScheduleKey, pauseKey, metadataKey). For key fields, you can either specify a Hedera public key explicitly or indicate “use my key,” in which case the tool will automatically use the public key of your connected account. Only keys that were specified on token creation can be updated; Hedera does not allow deleting keys. Only the fields included will be updated. |
| `APPROVE_NFT_ALLOWANCE_TOOL`                  | Approves an NFT allowance for specific serials or all serials | Provide optional ownerAccountId (defaults to operator if omitted), the spenderAccountId (required), the tokenId (required), and either set allSerials to true to approve all current and future serials or provide serialNumbers (number[]) to approve specific serials. Optionally include transactionMemo.                                                                                                                                                                                                                                                                                           |
| `TRANSFER_NFT_WITH_ALLOWANCE_TOOL`            | Transfers NFTs using an existing token allowance              | Provide the sourceAccountId (token owner, required), tokenId (required), and recipients array (each with recipientId and serialNumber, all required). Optionally include a transactionMemo.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL` | Transfers a fungible token using an existing token allowance  | Provide the token ID (required), source account ID (required, the allowance granter), and an array of transfers (each with recipient account ID and amount). Optionally include a transaction memo. Supports scheduled transactions.                                                                                                                                                                                                                                                                                                                                                                   |
| `DISSOCIATE_TOKEN_TOOL`                       | Dissociates one or more tokens from an account                | Provide an array of token IDs to dissociate (required). Optionally specify the account ID to dissociate from (defaults to operator) and a transaction memo.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `TRANSFER_HBAR_WITH_ALLOWANCE_TOOL`           | Transfers HBAR using an existing allowance                    | Provide the source account ID (required, the allowance granter) and an array of transfers (each with recipient account ID and amount). Optionally include a transaction memo.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `DELETE_TOKEN_ALLOWANCE_TOOL`                 | Delete fungible token allowance(ies)                          | Provide optional owner account ID (defaults to operator if omitted), the spenderAccountId (required), an array of tokenIds (required) specifying which allowances to remove, and an optional transaction memo.                                                                                                                                                                                                                                                                                                                                                                                         |
| `APPROVE_TOKEN_ALLOWANCE_TOOL`                | Approve fungible token spending allowances                    | Provide optional owner account ID (defaults to operator if omitted), the spender account ID (required), an array of token allowances each with tokenId and amount (positive integer), and an optional transaction memo.                                                                                                                                                                                                                                                                                                                                                                                |

---

### Core Token Query Plugin Tools (`core-token-query-plugin`)

This plugin provides tools for fetching **Token Service (HTS)** related information from Hedera Mirror Node.

| Tool Name                   | Description                                   | Usage                                                    |
|-----------------------------|-----------------------------------------------|----------------------------------------------------------|
| `GET_TOKEN_INFO_QUERY_TOOL` | Returns details of a given token (HTS)        | Provide the token ID (required).                         |
| `GET_PENDING_AIRDROP_TOOL`  | Returns pending airdrops for a Hedera account | Provide the account ID (optional, defaults to operator). |

---

### Core EVM Plugin Tools (`core-evm-plugin`)

This plugin provides tools for interacting with EVM smart contracts on Hedera, including creating and managing ERC-20
and ERC-721 tokens via on-chain factory contracts and standard function calls.

| Tool Name              | Description                                           | Usage                                                                                                                                           |
|------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `CREATE_ERC20_TOOL`    | Deploys a new ERC-20 token via the BaseERC20Factory   | Provide token name and symbol (required). Optionally set decimals (default 18) and initial supply (default 0). Supports scheduled transactions. |
| `TRANSFER_ERC20_TOOL`  | Transfers an ERC-20 token                             | Provide contract ID, recipient address, and amount. Supports both EVM and Hedera IDs. Supports scheduled transactions.                          |
| `CREATE_ERC721_TOOL`   | Deploys a new ERC-721 token via the BaseERC721Factory | Provide token name, symbol, and base URI (all required). Supports scheduled transactions.                                                       |
| `MINT_ERC721_TOOL`     | Mints a new ERC-721 token                             | Provide contract ID and recipient address. Supports both EVM and Hedera IDs. Supports scheduled transactions.                                   |
| `TRANSFER_ERC721_TOOL` | Transfers an ERC-721 token                            | Provide contract ID, from address, to address, and token ID. Supports both EVM and Hedera IDs. Supports scheduled transactions.                 |

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

| Tool Name                | Description                                   | Usage                                                                                     |
|--------------------------|-----------------------------------------------|-------------------------------------------------------------------------------------------|
| `GET_EXCHANGE_RATE_TOOL` | Returns the Hedera network HBAR exchange rate | Optionally provide `timestamp` (seconds or nanos since epoch) to query a historical rate. |

---

## Scheduled Transactions

Scheduled transactions are **not separate tools** — they use the *same tools* you already know (for example,
`UPDATE_ACCOUNT_TOOL`, `TRANSFER_HBAR_TOOL`, etc.), but with **additional optional parameters** passed in a
`schedulingParams` object.

From the user's perspective, scheduling simply means asking to **execute a transaction later**, or **once all signatures
are collected**, instead of immediately.

If `schedulingParams.isScheduled` is `false` or omitted, all other scheduling parameters are ignored.

---

### Supported Tools

The following tools support scheduling:

- `CREATE_FUNGIBLE_TOKEN_TOOL`
- `CREATE_NON_FUNGIBLE_TOKEN_TOOL`
- `MINT_NON_FUNGIBLE_TOKEN_TOOL`
- `MINT_FUNGIBLE_TOKEN_TOOL`
- `TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL`
- `TRANSFER_HBAR_TOOL`
- `UPDATE_ACCOUNT_TOOL`
- `CREATE_ACCOUNT_TOOL`
- `CREATE_ERC20_TOOL`
- `TRANSFER_ERC20_TOOL`
- `CREATE_ERC721_TOOL`
- `MINT_ERC721_TOOL`
- `TRANSFER_ERC721_TOOL`

---

### Scheduling Transactions

To schedule transaction for a supported tool, the user needs to pass additional parameters.
Those parameters define how the **schedule entity** behaves — not the inner transaction itself.

| Parameter                             | Type                | Default              | Description                                                                                                                                                                                                                                                                                                       |
|---------------------------------------|---------------------|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **`schedulingParams.isScheduled`**    | `boolean`           | `false`              | If `true`, the transaction will be created as a scheduled transaction. If `false` or omitted, all other scheduling parameters are ignored.                                                                                                                                                                        |
| **`schedulingParams.adminKey`**       | `boolean \| string` | `false`              | The admin key that can delete or modify the scheduled transaction before execution. <br> • If `true`, the operator’s public key will be used. <br> • If `false` or omitted, the operator’s key will be used automatically as the default. <br> • If a string is passed, it will be interpreted as a specific key. |
| **`schedulingParams.payerAccountId`** | `string`            | *(operator account)* | The account that will pay the transaction fee when the scheduled transaction executes. <br> If not set, the payer of the original `ScheduleCreate` transaction (the operator) will be charged the service fee when the scheduled transaction executes.                                                            |
| **`schedulingParams.expirationTime`** | `string` (ISO 8601) | —                    | The time when the scheduled transaction will expire if it has not been fully signed. User can pass it in human-friendly form and the llm will parse it to correct ISO representation                                                                                                                              |
| **`schedulingParams.waitForExpiry`**  | `boolean`           | `false`              | If `true`, the scheduled transaction will be executed at its expiration time, even if not all signatures have been collected. Requires `expirationTime` to be set. If `false`, the transaction executes as soon as all required signatures are present.                                                           |

---

### Notes

- Setting any scheduling parameter implies **delayed execution** through the Hedera Schedule Service.
- The network will automatically execute the scheduled transaction once all required signatures are collected, or at its
  expiration time if `waitForExpiry` is `true`.
- If no `payerAccountId` is specified, **the operator account (creator of the schedule)** will be charged for the
  execution fee.
- If no `adminKey` is provided, **the operator’s public key** will be used as the admin key by default.
- These parameters are passed through the `schedulingParams` object and map directly to the internal SDK schema.

---

**Example usage in plain english**

```
Schedule a mint for token 0.0.5005 with metadata https://example.com/nft/1.json
```

```
Schedule Mint 0.0.5005 with metadata: ipfs://baf/metadata.json. Make it expire at 11.11.2025 10:00:00 and wait for its expiration time with executing it.
```

```
Schedule mint for token 0.0.5005 with URI ipfs://QmTest123 and use my operator key as admin key
```

```
Schedule mint NFT 0.0.5005 with metadata https://example.com/nft.json and set admin key to 302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7
```

```
Schedule mint NFT for token 0.0.5005 with metadata ipfs://QmTest456 and let account 0.0.1234 pay for it
```

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