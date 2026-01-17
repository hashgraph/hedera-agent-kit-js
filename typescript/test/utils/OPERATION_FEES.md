# Hedera Operation Fees

This document lists the USD fees for Hedera operations used in the test wrapper and tests.

## Crypto Service

| Operation               | USD ($) |
| ----------------------- | ------- |
| CryptoCreate            | $0.05   |
| CryptoTransfer          | $0.0001 |
| CryptoDelete            | $0.005  |
| CryptoApproveAllowance  | $0.05   |
| CryptoGetAccountBalance | $0.00   |
| CryptoGetInfo           | $0.0001 |

## Consensus Service

| Operation              | USD ($) |
| ---------------------- | ------- |
| ConsensusCreateTopic   | $0.01   |
| ConsensusDeleteTopic   | $0.005  |
| ConsensusSubmitMessage | $0.0001 |
| ConsensusGetTopicInfo  | $0.0001 |

## Token Service

| Operation                           | USD ($) |
| ----------------------------------- | ------- |
| TokenAirdrop (no prior association) | $0.10   |
| TokenAssociate                      | $0.05   |
| TokenCreate                         | $1.00   |
| TokenDelete                         | $0.001  |
| TokenGetInfo                        | $0.0001 |
| TokenGetNftInfo                     | $0.0001 |
| TokenMint (fungible)                | $0.001  |
| TokenMint (non-fungible)            | $0.02   |
| TokenTransfer                       | $0.001  |

## Smart Contract Service

| Operation         | USD ($) |
| ----------------- | ------- |
| ContractCreate    | $1.00   |
| ContractCall      | $0.00   |
| ContractCallLocal | $0.001  |
| ContractGetInfo   | $0.0001 |

## Miscellaneous

| Operation            | USD ($) |
| -------------------- | ------- |
| TransactionGetRecord | $0.0001 |

---

**Reference:** [Hedera Fees Documentation](https://hedera.com/fees)
