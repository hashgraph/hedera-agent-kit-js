# Hedera Tools - Detailed Reference

This document provides detailed parameter specifications and example prompts for all tools in the Hedera Agent Kit.

For a high-level overview of available plugins, see [HEDERAPLUGINS.md](./HEDERAPLUGINS.md).

---

## Table of Contents

- [Account Tools](#account-tools)
    - [TRANSFER_HBAR_TOOL](#transfer_hbar_tool)
    - [CREATE_ACCOUNT_TOOL](#create_account_tool)
    - [UPDATE_ACCOUNT_TOOL](#update_account_tool)
    - [DELETE_ACCOUNT_TOOL](#delete_account_tool)
    - [APPROVE_HBAR_ALLOWANCE_TOOL](#approve_hbar_allowance_tool)
    - [DELETE_HBAR_ALLOWANCE_TOOL](#delete_hbar_allowance_tool)
    - [TRANSFER_HBAR_WITH_ALLOWANCE_TOOL](#transfer_hbar_with_allowance_tool)
    - [SIGN_SCHEDULE_TRANSACTION_TOOL](#sign_schedule_transaction_tool)
    - [SCHEDULE_DELETE_TOOL](#schedule_delete_tool)
- [Account Query Tools](#account-query-tools)
    - [GET_ACCOUNT_QUERY_TOOL](#get_account_query_tool)
    - [GET_HBAR_BALANCE_QUERY_TOOL](#get_hbar_balance_query_tool)
    - [GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL](#get_account_token_balances_query_tool)
- [Consensus Tools](#consensus-tools)
    - [CREATE_TOPIC_TOOL](#create_topic_tool)
    - [SUBMIT_TOPIC_MESSAGE_TOOL](#submit_topic_message_tool)
    - [DELETE_TOPIC_TOOL](#delete_topic_tool)
    - [UPDATE_TOPIC_TOOL](#update_topic_tool)
- [Consensus Query Tools](#consensus-query-tools)
    - [GET_TOPIC_INFO_QUERY_TOOL](#get_topic_info_query_tool)
    - [GET_TOPIC_MESSAGES_QUERY_TOOL](#get_topic_messages_query_tool)
- [Token Tools](#token-tools)
    - [CREATE_FUNGIBLE_TOKEN_TOOL](#create_fungible_token_tool)
    - [CREATE_NON_FUNGIBLE_TOKEN_TOOL](#create_non_fungible_token_tool)
    - [MINT_FUNGIBLE_TOKEN_TOOL](#mint_fungible_token_tool)
    - [MINT_NON_FUNGIBLE_TOKEN_TOOL](#mint_non_fungible_token_tool)
    - [ASSOCIATE_TOKEN_TOOL](#associate_token_tool)
    - [DISSOCIATE_TOKEN_TOOL](#dissociate_token_tool)
    - [UPDATE_TOKEN_TOOL](#update_token_tool)
    - [AIRDROP_FUNGIBLE_TOKEN_TOOL](#airdrop_fungible_token_tool)
    - [APPROVE_TOKEN_ALLOWANCE_TOOL](#approve_token_allowance_tool)
    - [DELETE_TOKEN_ALLOWANCE_TOOL](#delete_token_allowance_tool)
    - [TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL](#transfer_fungible_token_with_allowance_tool)
    - [APPROVE_NFT_ALLOWANCE_TOOL](#approve_nft_allowance_tool)
    - [DELETE_NFT_ALLOWANCE_TOOL](#delete_nft_allowance_tool)
    - [TRANSFER_NON_FUNGIBLE_TOKEN_TOOL](#transfer_non_fungible_token_tool)
    - [TRANSFER_NFT_WITH_ALLOWANCE_TOOL](#transfer_nft_with_allowance_tool)
- [Token Query Tools](#token-query-tools)
    - [GET_TOKEN_INFO_QUERY_TOOL](#get_token_info_query_tool)
    - [GET_PENDING_AIRDROP_TOOL](#get_pending_airdrop_tool)
- [EVM Tools](#evm-tools)
    - [CREATE_ERC20_TOOL](#create_erc20_tool)
    - [TRANSFER_ERC20_TOOL](#transfer_erc20_tool)
    - [CREATE_ERC721_TOOL](#create_erc721_tool)
    - [MINT_ERC721_TOOL](#mint_erc721_tool)
    - [TRANSFER_ERC721_TOOL](#transfer_erc721_tool)
- [EVM Query Tools](#evm-query-tools)
    - [GET_CONTRACT_INFO_QUERY_TOOL](#get_contract_info_query_tool)
- [Transaction Query Tools](#transaction-query-tools)
    - [GET_TRANSACTION_RECORD_QUERY_TOOL](#get_transaction_record_query_tool)
- [Misc Query Tools](#misc-query-tools)
    - [GET_EXCHANGE_RATE_TOOL](#get_exchange_rate_tool)

---

## Account Tools

### TRANSFER_HBAR_TOOL

Transfer HBAR between accounts. Supports scheduled transactions.

#### Parameters

| Parameter         | Type                                         | Required | Description                                                                      |
|-------------------|----------------------------------------------|----------|----------------------------------------------------------------------------------|
| `transfers`       | `Array<{accountId: string, amount: number}>` | ✅        | Array of transfers. Each object has `accountId` (recipient) and `amount` (HBAR). |
| `sourceAccountId` | `string`                                     | ❌        | Account ID of the HBAR owner (defaults to operator).                             |
| `transactionMemo` | `string`                                     | ❌        | Memo to include with the transaction.                                            |

#### Example Prompts

```
Transfer 1 HBAR to 0.0.12345
Send 0.5 HBAR to account 0.0.2222
Transfer 2 HBAR to 0.0.3333 with memo "Payment for services"
Send 1 HBAR to 0.0.1111 and 2 HBAR to 0.0.2222
Transfer 0.1 HBAR from 0.0.5555 to 0.0.6666
Please send 5 HBAR to account 0.0.7777
Can you move 10 HBAR to 0.0.9999?
Pay 0.01 HBAR to 0.0.1010
```

#### Example (Scheduled)

```
Send 0.5 HBAR to account 0.0.2222. Schedule it and make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### CREATE_ACCOUNT_TOOL

Creates a new Hedera account. Supports scheduled transactions.

#### Parameters

| Parameter                       | Type     | Required | Default      | Description                                          |
|---------------------------------|----------|----------|--------------|------------------------------------------------------|
| `publicKey`                     | `string` | ❌        | operator key | Public key to use for the account.                   |
| `accountMemo`                   | `string` | ❌        | `null`       | Memo for the account (max 100 chars).                |
| `initialBalance`                | `number` | ❌        | `0`          | Initial HBAR balance.                                |
| `maxAutomaticTokenAssociations` | `number` | ❌        | `-1`         | Max automatic token associations (-1 for unlimited). |

#### Example Prompts

```
Create a new Hedera account
Create an account with memo "Payment account" and initial balance 1.5 HBAR
Create account funded with 0.01 HBAR
Create an account with max automatic token associations 10
Schedule creation of an account with max automatic token associations 10
```

#### Example (Scheduled)

```
Schedule creation of an account with max automatic token associations 10. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### UPDATE_ACCOUNT_TOOL

Update an account's metadata. Supports scheduled transactions.

#### Parameters

| Parameter                       | Type      | Required | Description                                  |
|---------------------------------|-----------|----------|----------------------------------------------|
| `accountId`                     | `string`  | ❌        | Account ID to update (defaults to operator). |
| `maxAutomaticTokenAssociations` | `number`  | ❌        | Max automatic token associations.            |
| `stakedAccountId`               | `string`  | ❌        | Account to stake to.                         |
| `accountMemo`                   | `string`  | ❌        | New account memo.                            |
| `declineStakingReward`          | `boolean` | ❌        | Whether to decline staking rewards.          |

#### Example Prompts

```
Update account 0.0.12345 to have max auto associations of 10
Set my account memo to "Updated account"
```

#### Example (Scheduled)

```
Schedule an account update for account 0.0.1234. Set the account memo to "updated with scheduled transaction". Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### DELETE_ACCOUNT_TOOL

Delete an account and transfer its assets.

#### Parameters

| Parameter           | Type     | Required | Description                                                    |
|---------------------|----------|----------|----------------------------------------------------------------|
| `accountId`         | `string` | ✅        | The account ID to delete.                                      |
| `transferAccountId` | `string` | ❌        | Account to transfer remaining funds to (defaults to operator). |

#### Example Prompts

```
Delete account 0.0.12345
Delete account 0.0.12345 and transfer funds to 0.0.67890
```

---

### APPROVE_HBAR_ALLOWANCE_TOOL

Approve an HBAR spending allowance for a spender account.

#### Parameters

| Parameter          | Type     | Required | Description                                     |
|--------------------|----------|----------|-------------------------------------------------|
| `ownerAccountId`   | `string` | ❌        | Owner account ID (defaults to operator).        |
| `spenderAccountId` | `string` | ✅        | Spender account ID.                             |
| `amount`           | `number` | ✅        | Amount of HBAR to approve (cannot be negative). |
| `transactionMemo`  | `string` | ❌        | Memo for the transaction.                       |

#### Example Prompts

```
Approve 5 HBAR allowance for account 0.0.12345
Allow account 0.0.12345 to spend up to 10 HBAR from my account
```

---

### DELETE_HBAR_ALLOWANCE_TOOL

Delete an HBAR allowance from an owner to a spender.

#### Parameters

| Parameter          | Type     | Required | Description                              |
|--------------------|----------|----------|------------------------------------------|
| `ownerAccountId`   | `string` | ❌        | Owner account ID (defaults to operator). |
| `spenderAccountId` | `string` | ✅        | Spender account ID.                      |
| `transactionMemo`  | `string` | ❌        | Memo for the transaction.                |

#### Example Prompts

```
Delete HBAR allowance from 0.0.123 to 0.0.456
Delete HBAR allowance for 0.0.123
```

---

### TRANSFER_HBAR_WITH_ALLOWANCE_TOOL

Transfer HBAR using an existing allowance. Supports scheduled transactions.

#### Parameters

| Parameter         | Type                                         | Required | Description                                                                     |
|-------------------|----------------------------------------------|----------|---------------------------------------------------------------------------------|
| `transfers`       | `Array<{accountId: string, amount: number}>` | ✅        | List of transfers. Each object has `accountId` (recipient) and `amount` (HBAR). |
| `sourceAccountId` | `string`                                     | ✅        | Account ID of the HBAR owner (the allowance granter).                           |
| `transactionMemo` | `string`                                     | ❌        | Memo for the transaction.                                                       |

#### Example Prompts

```
Transfer 1 HBAR from 0.0.123 to 0.0.456 using allowance
Use allowance from account 0.0.123 to send 5 HBAR to 0.0.789
```

#### Example (Scheduled)

```
Transfer 1 HBAR from 0.0.123 to 0.0.456 using allowance. Schedule this transaction and make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### SIGN_SCHEDULE_TRANSACTION_TOOL

Sign a scheduled transaction on the Hedera network.

#### Parameters

| Parameter    | Type     | Required | Description                                  |
|--------------|----------|----------|----------------------------------------------|
| `scheduleId` | `string` | ✅        | The ID of the scheduled transaction to sign. |

#### Example Prompts

```
Sign scheduled transaction 0.0.12345
Add my signature to schedule 0.0.12345
```

---

### SCHEDULE_DELETE_TOOL

Delete a scheduled transaction so it will not execute.

#### Parameters

| Parameter    | Type     | Required | Description                                    |
|--------------|----------|----------|------------------------------------------------|
| `scheduleId` | `string` | ✅        | The ID of the scheduled transaction to delete. |

#### Example Prompts

```
Delete scheduled transaction 0.0.12345
Cancel schedule 0.0.12345
```

---

## Account Query Tools

### GET_ACCOUNT_QUERY_TOOL

Returns comprehensive account information for a given Hedera account.

#### Parameters

| Parameter   | Type     | Required | Description              |
|-------------|----------|----------|--------------------------|
| `accountId` | `string` | ✅        | The account ID to query. |

#### Example Prompts

```
Get account info for 0.0.12345
What is the public key for account 0.0.12345?
Show me details about account 0.0.12345
```

---

### GET_HBAR_BALANCE_QUERY_TOOL

Returns the HBAR balance for a given Hedera account.

#### Parameters

| Parameter   | Type     | Required | Description                                            |
|-------------|----------|----------|--------------------------------------------------------|
| `accountId` | `string` | ❌        | Account ID to query (defaults to operator if omitted). |

#### Example Prompts

```
What is the HBAR balance of account 0.0.1234?
Check HBAR for 0.0.4321
Check my HBAR balance
Get my HBAR balance
```

---

### GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL

Returns token balances for a Hedera account.

#### Parameters

| Parameter   | Type     | Required | Description                                                           |
|-------------|----------|----------|-----------------------------------------------------------------------|
| `accountId` | `string` | ❌        | Account ID to query (defaults to operator).                           |
| `tokenId`   | `string` | ❌        | Token ID to filter for. If not provided, all token balances returned. |

#### Example Prompts

```
Get my token balances
What tokens does 0.0.12345 hold?
Show balance of token 0.0.11111 for account 0.0.12345
```

---

## Consensus Tools

### CREATE_TOPIC_TOOL

Create a new topic on the Hedera network.

#### Parameters

| Parameter         | Type      | Required | Description                                |
|-------------------|-----------|----------|--------------------------------------------|
| `topicMemo`       | `string`  | ❌        | A memo for the topic.                      |
| `transactionMemo` | `string`  | ❌        | An optional memo for the transaction.      |
| `isSubmitKey`     | `boolean` | ❌        | Whether to set a submit key for the topic. |

#### Example Prompts

```
Create a new topic
Create a topic with memo "Payments" and set submit key
Open a new consensus topic
Create topic with transaction memo "TX: memo"
```

---

### SUBMIT_TOPIC_MESSAGE_TOOL

Submit a message to a topic on the Hedera network. Supports scheduled transactions.

#### Parameters

| Parameter         | Type     | Required | Description                                   |
|-------------------|----------|----------|-----------------------------------------------|
| `topicId`         | `string` | ✅        | The ID of the topic to submit the message to. |
| `message`         | `string` | ✅        | The message to submit to the topic.           |
| `transactionMemo` | `string` | ❌        | An optional memo for the transaction.         |

#### Example Prompts

```
Submit message "Hello World" to topic 0.0.12345
Post "Event logged" to topic 0.0.12345
```

#### Example (Scheduled)

```
Submit message "Hello World" to topic 0.0.12345. Schedule it and make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### DELETE_TOPIC_TOOL

Delete a topic on the Hedera network.

#### Parameters

| Parameter | Type     | Required | Description                |
|-----------|----------|----------|----------------------------|
| `topicId` | `string` | ✅        | ID of the topic to delete. |

#### Example Prompts

```
Delete topic 0.0.12345
```

---

### UPDATE_TOPIC_TOOL

Update a topic on the Hedera network.

#### Parameters

| Parameter            | Type                | Required | Description                                                              |
|----------------------|---------------------|----------|--------------------------------------------------------------------------|
| `topicId`            | `string`            | ✅        | Topic ID to update.                                                      |
| `topicMemo`          | `string`            | ❌        | New memo for the topic.                                                  |
| `adminKey`           | `boolean \| string` | ❌        | New admin key. Pass `true` to use operator key, or a public key string.  |
| `submitKey`          | `boolean \| string` | ❌        | New submit key. Pass `true` to use operator key, or a public key string. |
| `autoRenewAccountId` | `string`            | ❌        | Account to automatically pay for renewal.                                |
| `autoRenewPeriod`    | `number`            | ❌        | Auto renew period in seconds.                                            |
| `expirationTime`     | `string`            | ❌        | New expiration time for the topic (ISO string).                          |

#### Example Prompts

```
Update topic 0.0.5005 with memo 'new memo' and set submit key to my key
For topic 0.0.1234 set memo "hello", auto renew period 7890000 and expiration time 2030-01-01T00:00:00Z
Set my key as admin key for topic 0.0.12345
```

---

## Consensus Query Tools

### GET_TOPIC_INFO_QUERY_TOOL

Returns information for a given Hedera Consensus Service (HCS) topic.

#### Parameters

| Parameter | Type     | Required | Description            |
|-----------|----------|----------|------------------------|
| `topicId` | `string` | ✅        | The topic ID to query. |

#### Example Prompts

```
Get info for topic 0.0.12345
Show me details about topic 0.0.12345
```

---

### GET_TOPIC_MESSAGES_QUERY_TOOL

Returns messages for a given Hedera Consensus Service (HCS) topic.

#### Parameters

| Parameter   | Type     | Required | Description                                  |
|-------------|----------|----------|----------------------------------------------|
| `topicId`   | `string` | ✅        | The topic ID to query.                       |
| `startTime` | `string` | ❌        | Start datetime for message filtering.        |
| `endTime`   | `string` | ❌        | End datetime for message filtering.          |
| `limit`     | `number` | ❌        | Limit of messages to retrieve (default 100). |

#### Example Prompts

```
Get messages from topic 0.0.12345
Show the last 10 messages from topic 0.0.12345
Get messages from topic 0.0.12345 after 2024-01-01
```

---

## Token Tools

### CREATE_FUNGIBLE_TOKEN_TOOL

Creates a fungible token on Hedera. Supports scheduled transactions.

#### Parameters

| Parameter           | Type      | Required | Default    | Description                                                                        |
|---------------------|-----------|----------|------------|------------------------------------------------------------------------------------|
| `tokenName`         | `string`  | ✅        | —          | The name of the token.                                                             |
| `tokenSymbol`       | `string`  | ❌        | —          | The symbol of the token.                                                           |
| `initialSupply`     | `number`  | ❌        | `0`        | Initial supply of the token (in display units, the tool handles parsing).          |
| `supplyType`        | `string`  | ❌        | `"finite"` | Supply type: `"finite"` or `"infinite"`.                                           |
| `maxSupply`         | `number`  | ❌        | `1000000`  | Max supply (in display units, only applicable for finite tokens).                  |
| `decimals`          | `number`  | ❌        | `0`        | Number of decimal places.                                                          |
| `treasuryAccountId` | `string`  | ❌        | operator   | Treasury account for the token (defaults to operator).                             |
| `isSupplyKey`       | `boolean` | ❌        | `false`    | Whether to set a supply key.                                                       |

#### Example Prompts

```
Create a new fungible token called MyToken with symbol MTK
Create a fungible token named GoldCoin with symbol GOLD, initial supply 1000, decimals 2, and finite supply
Create a fungible token MySupplyToken with symbol SUP, treasury account 0.0.5005 and set supply key
Make a fungible token named TestToken with symbol TST
Create fungible GLD, Gold, token with infinite supply
```

#### Example (Scheduled)

```
Schedule create fungible token transaction called MyToken with symbol MTK. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### CREATE_NON_FUNGIBLE_TOKEN_TOOL

Creates a non-fungible token (NFT) on Hedera. Supports scheduled transactions.

#### Parameters

| Parameter           | Type      | Required | Default    | Description                                                                      |
|---------------------|-----------|----------|------------|----------------------------------------------------------------------------------|
| `tokenName`         | `string`  | ✅        | —          | Name of the token.                                                               |
| `tokenSymbol`       | `string`  | ✅        | —          | Symbol of the token.                                                             |
| `supplyType`        | `string`  | ❌        | `"finite"` | The supply type of the token. Can be `"finite"` or `"infinite"`.                 |
| `maxSupply`         | `number`  | ❌        | `100`      | Maximum NFT supply. Only applicable if `supplyType` is `"finite"`.               |
| `isSupplyKey`       | `boolean` | ❌        | `false`    | If `true`, sets a supply key on the token, allowing future minting.              |
| `treasuryAccountId` | `string`  | ❌        | operator   | Treasury account for the token (defaults to operator).                           |

#### Example Prompts

```
Create an NFT collection called MyNFTs with symbol MNFT
Create a non-fungible token named ArtCollection with max supply 50
Create an NFT called LimitedEdition with symbol LE and set supply key
Create an NFT with infinite supply called OpenArt with symbol OPEN
```

#### Example (Scheduled)

```
Schedule create non-fungible token transaction called MyToken with symbol MTK. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### MINT_FUNGIBLE_TOKEN_TOOL

Mints additional supply of an existing fungible token. Supports scheduled transactions.

#### Parameters

| Parameter | Type     | Required | Description                                                            |
|-----------|----------|----------|------------------------------------------------------------------------|
| `tokenId` | `string` | ✅        | The token ID to mint.                                                  |
| `amount`  | `number` | ✅        | Amount to mint (in display units, the tool handles parsing).           |

#### Example Prompts

```
Mint 1000 of token 0.0.12345
Mint 50 tokens for 0.0.12345
```

#### Example (Scheduled)

```
Schedule mint 10 of token 0.0.12345. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### MINT_NON_FUNGIBLE_TOKEN_TOOL

Mints NFTs with unique metadata for an existing NFT class. Supports scheduled transactions.

#### Parameters

| Parameter | Type       | Required | Description                                         |
|-----------|------------|----------|-----------------------------------------------------|
| `tokenId` | `string`   | ✅        | The token ID to mint.                               |
| `uris`    | `string[]` | ✅        | Array of metadata URIs (max 10).                    |

#### Example Prompts

```
Mint 0.0.5005 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json
Mint NFTs for token 0.0.6006 with metadata URIs: ipfs://uri1, ipfs://uri2, ipfs://uri3
Mint NFT 0.0.7007 with metadata ipfs://abc123
```

#### Example (Scheduled)

```
Schedule Mint 0.0.5005 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### ASSOCIATE_TOKEN_TOOL

Associates one or more tokens with an account.

#### Parameters

| Parameter   | Type       | Required | Description                                            |
|-------------|------------|----------|--------------------------------------------------------|
| `accountId` | `string`   | ❌        | Account to associate tokens to (defaults to operator). |
| `tokenIds`  | `string[]` | ✅        | Array of token IDs to associate.                       |

#### Example Prompts

```
Associate token 0.0.12345 with my account
Associate tokens 0.0.123 and 0.0.456 to account 0.0.789
```

---

### DISSOCIATE_TOKEN_TOOL

Dissociates one or more tokens from an account.

#### Parameters

| Parameter         | Type       | Required | Description                                        |
|-------------------|------------|----------|----------------------------------------------------|
| `tokenIds`        | `string[]` | ✅        | Array of token IDs to dissociate.                  |
| `accountId`       | `string`   | ❌        | Account to dissociate from (defaults to operator). |
| `transactionMemo` | `string`   | ❌        | Memo for the transaction.                          |

#### Example Prompts

```
Dissociate token 0.0.12345 from my account
Dissociate tokens 0.0.123 and 0.0.456 from account 0.0.789
```

---

### UPDATE_TOKEN_TOOL

Update token metadata.

#### Parameters

| Parameter            | Type                | Required | Description                                 |
|----------------------|---------------------|----------|---------------------------------------------|
| `tokenId`            | `string`            | ✅        | Token ID to update.                         |
| `tokenName`          | `string`            | ❌        | New name for the token (up to 100 chars).   |
| `tokenSymbol`        | `string`            | ❌        | New symbol for the token (up to 100 chars). |
| `treasuryAccountId`  | `string`            | ❌        | New treasury account.                       |
| `adminKey`           | `boolean \| string` | ❌        | New admin key.                              |
| `kycKey`             | `boolean \| string` | ❌        | New KYC key.                                |
| `freezeKey`          | `boolean \| string` | ❌        | New freeze key.                             |
| `wipeKey`            | `boolean \| string` | ❌        | New wipe key.                               |
| `supplyKey`          | `boolean \| string` | ❌        | New supply key.                             |
| `feeScheduleKey`     | `boolean \| string` | ❌        | New fee schedule key.                       |
| `pauseKey`           | `boolean \| string` | ❌        | New pause key.                              |
| `metadataKey`        | `boolean \| string` | ❌        | New metadata key.                           |
| `metadata`           | `string`            | ❌        | New metadata (hex or base64).               |
| `tokenMemo`          | `string`            | ❌        | New token memo (up to 100 chars).           |
| `autoRenewAccountId` | `string`            | ❌        | Account to pay for renewal.                 |

#### Example Prompts

```
Update token 0.0.12345 name to "NewTokenName"
Set my key as admin key for token 0.0.12345
Update token 0.0.12345 with new memo "Updated token"
```

---

### AIRDROP_FUNGIBLE_TOKEN_TOOL

Airdrops a fungible token to multiple recipients.

#### Parameters

| Parameter         | Type                                         | Required | Description                                                                |
|-------------------|----------------------------------------------|----------|----------------------------------------------------------------------------|
| `tokenId`         | `string`                                     | ✅        | The token ID to airdrop.                                                   |
| `recipients`      | `Array<{accountId: string, amount: number}>` | ✅        | List of recipients with account ID and amount (in display units).          |
| `sourceAccountId` | `string`                                     | ❌        | Source account ID (defaults to operator).                                  |
| `transactionMemo` | `string`                                     | ❌        | Memo for the transaction.                                                  |

#### Example Prompts

```
Airdrop 10 HTS tokens 0.0.1234 from 0.0.1001 to 0.0.2002
Airdrop 5 of token 0.0.9999 from 0.0.1111 to 0.0.2222 and 0.0.3333
Airdrop 15 HTS tokens 0.0.7777 to 0.0.3001 and 0.0.3002 from 0.0.1500
```

---

### APPROVE_TOKEN_ALLOWANCE_TOOL

Approve fungible token spending allowances.

#### Parameters

| Parameter          | Type                                       | Required | Description                                                               |
|--------------------|--------------------------------------------|----------|---------------------------------------------------------------------------|
| `ownerAccountId`   | `string`                                   | ❌        | Owner account ID (defaults to operator if omitted).                       |
| `spenderAccountId` | `string`                                   | ✅        | Spender account ID.                                                       |
| `tokenApprovals`   | `Array<{tokenId: string, amount: number}>` | ✅        | List of token approvals with token ID and amount (in display units).      |
| `transactionMemo`  | `string`                                   | ❌        | Memo for the transaction.                                                 |

#### Example Prompts

```
Approve 100 tokens 0.0.12345 for spender 0.0.67890
Allow 0.0.67890 to spend 50 of my token 0.0.12345
```

---

### DELETE_TOKEN_ALLOWANCE_TOOL

Delete fungible token allowance(s).

#### Parameters

| Parameter          | Type       | Required | Description                                                    |
|--------------------|------------|----------|----------------------------------------------------------------|
| `ownerAccountId`   | `string`   | ❌        | Owner account ID (defaults to operator if omitted).            |
| `spenderAccountId` | `string`   | ✅        | Spender account ID.                                            |
| `tokenIds`         | `string[]` | ✅        | Array of token IDs specifying which allowances to remove.      |
| `transactionMemo`  | `string`   | ❌        | Memo for the transaction.                                      |

#### Example Prompts

```
Delete token allowance for account 0.0.123 on token 0.0.456
Remove allowance for spender 0.0.123 on tokens 0.0.456 and 0.0.789
```

---

### TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL

Transfers a fungible token using an existing token allowance. Supports scheduled transactions.

#### Parameters

| Parameter         | Type                                         | Required | Description                                                       |
|-------------------|----------------------------------------------|----------|-------------------------------------------------------------------|
| `tokenId`         | `string`                                     | ✅        | The token ID to transfer.                                         |
| `sourceAccountId` | `string`                                     | ✅        | Account ID of the token owner (the allowance granter).            |
| `transfers`       | `Array<{accountId: string, amount: number}>` | ✅        | List of transfers with recipient and amount (in display units).   |
| `transactionMemo` | `string`                                     | ❌        | Memo for the transaction.                                         |

#### Example Prompts

```
Spend allowance from 0.0.1002 to send 25 tokens 0.0.33333 to 0.0.2002
Use allowance from 0.0.1002 to transfer 50 tokens 0.0.33333 to 0.0.2002 and 75 to 0.0.3003
```

#### Example (Scheduled)

```
Transfer 100 of fungible token '0.0.33333' from 0.0.1002 to 0.0.2002 using allowance. Schedule this transaction and make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### APPROVE_NFT_ALLOWANCE_TOOL

Approves an NFT allowance for specific serials or all serials.

#### Parameters

| Parameter          | Type       | Required | Description                                                           |
|--------------------|------------|----------|-----------------------------------------------------------------------|
| `ownerAccountId`   | `string`   | ❌        | Owner account ID (defaults to operator).                              |
| `spenderAccountId` | `string`   | ✅        | Spender account ID.                                                   |
| `tokenId`          | `string`   | ✅        | The NFT token ID.                                                     |
| `allSerials`       | `boolean`  | ❌        | If true, approves all current and future serials.                     |
| `serialNumbers`    | `number[]` | ❌        | Array of serial numbers to approve (required if allSerials is false). |
| `transactionMemo`  | `string`   | ❌        | Memo for the transaction.                                             |

#### Example Prompts

```
Approve NFT allowance for token 0.0.5005 serial 1 to spender 0.0.7007 from 0.0.6006 with memo 'gift'
Approve NFT allowance for token 0.0.1111 serials 2 and 3 to 0.0.2222
Authorize NFT allowance on 0.0.3333 for serials 5, 6, 7 to account 0.0.4444
Approve NFT allowance for all serials of token 0.0.5555 to spender 0.0.6666
Grant approval for the entire collection token 0.0.1010 to account 0.0.2020
```

---

### DELETE_NFT_ALLOWANCE_TOOL

Deletes NFT allowance(s) for specific serial numbers.

#### Parameters

| Parameter          | Type       | Required | Description                                               |
|--------------------|------------|----------|-----------------------------------------------------------|
| `ownerAccountId`   | `string`   | ❌        | Owner account ID (defaults to operator).                  |
| `tokenId`          | `string`   | ✅        | The NFT token ID.                                         |
| `serialNumbers`    | `number[]` | ✅        | Array of serial numbers to remove allowance for.          |
| `transactionMemo`  | `string`   | ❌        | Memo for the transaction.                                 |

#### Example Prompts

```
Delete NFT allowance for token 0.0.5005 serial 1
Remove NFT allowance for token 0.0.1111 serials 2 and 3
Revoke NFT allowance on 0.0.3333 for serials 5, 6, 7 from owner 0.0.4444
Delete allowance for NFT token 0.0.1234 serials 10 and 12 with memo "cleanup"
```

---

### TRANSFER_NON_FUNGIBLE_TOKEN_TOOL

Transfers NFTs from the operator's account to specified recipients. Supports scheduled transactions.

#### Parameters

| Parameter         | Type                                                 | Required | Description                                                         |
|-------------------|------------------------------------------------------|----------|---------------------------------------------------------------------|
| `tokenId`         | `string`                                             | ✅        | The NFT token ID to transfer.                                       |
| `recipients`      | `Array<{recipientId: string, serialNumber: number}>` | ✅        | List of recipients with recipient account ID and NFT serial number. |
| `transactionMemo` | `string`                                             | ❌        | Memo for the transaction.                                           |

#### Example Prompts

```
Transfer NFT 0.0.12345 serial 1 to 0.0.222
Send my NFT 0.0.12345 serials 1 and 2 to 0.0.333
Transfer NFT token 0.0.5555 serial 3 to account 0.0.6666 with memo "gift"
```

#### Example (Scheduled)

```
Transfer NFT 0.0.12345 serial 1 to 0.0.222. Schedule this transaction and make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### TRANSFER_NFT_WITH_ALLOWANCE_TOOL

Transfers NFTs using an existing token allowance.

#### Parameters

| Parameter         | Type                                                 | Required | Description                                                         |
|-------------------|------------------------------------------------------|----------|---------------------------------------------------------------------|
| `sourceAccountId` | `string`                                             | ✅        | The token owner (allowance granter).                                |
| `tokenId`         | `string`                                             | ✅        | The NFT token ID to transfer.                                       |
| `recipients`      | `Array<{recipientId: string, serialNumber: number}>` | ✅        | List of recipients with recipient account ID and NFT serial number. |
| `transactionMemo` | `string`                                             | ❌        | Memo for the transaction.                                           |

#### Example Prompts

```
Transfer NFT 0.0.12345 serial 1 from 0.0.111 to 0.0.222 using allowance
Use allowance to send serials 1 and 2 of NFT 0.0.12345 from 0.0.111 to 0.0.222
```

---

## Token Query Tools

### GET_TOKEN_INFO_QUERY_TOOL

Returns details of a given token (HTS).

#### Parameters

| Parameter | Type     | Required | Description            |
|-----------|----------|----------|------------------------|
| `tokenId` | `string` | ✅        | The token ID to query. |

#### Example Prompts

```
Get info for token 0.0.12345
What is the symbol for token 0.0.12345?
Show me details about token 0.0.12345
```

---

### GET_PENDING_AIRDROP_TOOL

Returns pending airdrops for a Hedera account.

#### Parameters

| Parameter   | Type     | Required | Description                                 |
|-------------|----------|----------|---------------------------------------------|
| `accountId` | `string` | ❌        | Account ID to query (defaults to operator). |

#### Example Prompts

```
Get my pending airdrops
Show pending airdrops for account 0.0.12345
```

---

## EVM Tools

### CREATE_ERC20_TOOL

Deploys a new ERC-20 token via the BaseERC20Factory. Supports scheduled transactions.

#### Parameters

| Parameter       | Type     | Required | Default | Description                  |
|-----------------|----------|----------|---------|------------------------------|
| `tokenName`     | `string` | ✅        | —       | The name of the token.       |
| `tokenSymbol`   | `string` | ✅        | —       | The symbol of the token.     |
| `decimals`      | `number` | ❌        | `18`    | Number of decimal places.    |
| `initialSupply` | `number` | ❌        | `0`     | Initial supply of the token. |

#### Example Prompts

```
Create an ERC20 token called MyToken with symbol MTK
Create ERC20 token TestCoin (TST) with 18 decimals and 1000000 initial supply
```

#### Example (Scheduled)

```
Schedule deploy ERC20 token called MyCoin with symbol MC, 500 initial supply, and 8 decimals. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### TRANSFER_ERC20_TOOL

Transfers an ERC-20 token. Supports scheduled transactions.

#### Parameters

| Parameter          | Type     | Required | Description                                       |
|--------------------|----------|----------|---------------------------------------------------|
| `contractId`       | `string` | ✅        | The ERC20 contract ID (EVM address or Hedera ID). |
| `recipientAddress` | `string` | ✅        | Recipient address (EVM or Hedera ID).             |
| `amount`           | `number` | ✅        | Amount to transfer.                               |

#### Example Prompts

```
Transfer 100 0.0.5678 ERC20 tokens from contract to 0x1234567890123456789012345678901234567890
Send 50 tokens from ERC20 contract 0.0.1234 to account 0.0.5678
Transfer 12 ERC20 tokens 0.0.1111 to 0.0.2222
Send 25 erc20 tokens from contract 0.0.1234 to 0.0.5678
Move 200 erc20 tokens of contract 0.0.3333 to address 0.0.4444
```

#### Example (Scheduled)

```
Schedule transfer 100 0.0.5678 ERC20 tokens from contract to 0x1234567890123456789012345678901234567890. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### CREATE_ERC721_TOOL

Deploys a new ERC-721 token via the BaseERC721Factory. Supports scheduled transactions.

#### Parameters

| Parameter     | Type     | Required | Description                      |
|---------------|----------|----------|----------------------------------|
| `tokenName`   | `string` | ✅        | The name of the token.           |
| `tokenSymbol` | `string` | ✅        | The symbol of the token.         |
| `baseURI`     | `string` | ✅        | The base URI for token metadata. |

#### Example Prompts

```
Create an ERC721 collection called MyNFTs with symbol MNFT and base URI https://example.com/nft/
Create ERC721 token ArtCollection (ART) with baseURI ipfs://bafybei...
```

#### Example (Scheduled)

```
Schedule deploy ERC721 token called MyNFT with symbol MNFT. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### MINT_ERC721_TOOL

Mints a new ERC-721 token. Supports scheduled transactions.

#### Parameters

| Parameter    | Type     | Required | Description                               |
|--------------|----------|----------|-------------------------------------------|
| `contractId` | `string` | ✅        | The ERC721 contract ID.                   |
| `toAddress`  | `string` | ❌        | Recipient address (defaults to operator). |

#### Example Prompts

```
Mint ERC721 token 0.0.12345
Mint ERC721 0.0.12345 to address 0x1234...5678
```

#### Example (Scheduled)

```
Schedule mint ERC721 token 0.0.5678 to 0x1234567890123456789012345678901234567890. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

### TRANSFER_ERC721_TOOL

Transfers an ERC-721 token. Supports scheduled transactions.

#### Parameters

| Parameter     | Type     | Required | Description                            |
|---------------|----------|----------|----------------------------------------|
| `contractId`  | `string` | ✅        | The ERC721 contract ID.                |
| `fromAddress` | `string` | ❌        | Sender address (defaults to operator). |
| `toAddress`   | `string` | ✅        | Recipient address (EVM or Hedera ID).  |
| `tokenId`     | `number` | ✅        | The ID of the token to transfer.       |

#### Example Prompts

```
Transfer ERC721 token 0.0.12345 with id 1 to 0.0.67890
Send ERC721 0.0.12345 token ID 5 from 0x123... to 0x456...
```

#### Example (Scheduled)

```
Schedule transfer ERC721 token 1 from contract 0.0.5678 from 0.0.1234 to 0x1234567890123456789012345678901234567890. Make it expire 01.02.2026 and wait for its expiration time with executing it.
```

---

## EVM Query Tools

### GET_CONTRACT_INFO_QUERY_TOOL

Returns details of a given smart contract.

#### Parameters

| Parameter    | Type     | Required | Description               |
|--------------|----------|----------|---------------------------|
| `contractId` | `string` | ✅        | The contract ID to query. |

#### Example Prompts

```
Get info for contract 0.0.12345
Show me details about contract 0.0.12345
What is the EVM address of contract 0.0.12345?
```

---

## Transaction Query Tools

### GET_TRANSACTION_RECORD_QUERY_TOOL

Returns details for a given transaction ID.

#### Parameters

| Parameter       | Type     | Required | Description                                         |
|-----------------|----------|----------|-----------------------------------------------------|
| `transactionId` | `string` | ✅        | Transaction ID in format `shard.realm.num-sss-nnn`. |
| `nonce`         | `number` | ❌        | Optional nonce value for the transaction.           |

#### Example Prompts

```
Get transaction record for 0.0.12345-1234567890-123456789
Show me details about transaction 0.0.12345@1234567890.123456789
```

---

## Misc Query Tools

### GET_EXCHANGE_RATE_TOOL

Returns the Hedera network HBAR exchange rate.

#### Parameters

| Parameter   | Type     | Required | Description                                                                           |
|-------------|----------|----------|---------------------------------------------------------------------------------------|
| `timestamp` | `string` | ❌        | Historical timestamp (seconds or nanos since epoch). If omitted, returns latest rate. |

#### Example Prompts

```
Get the current HBAR exchange rate
What is the HBAR to USD rate?
Get exchange rate at timestamp 1726000000
```
