// Core public API - only approved shared/core exports
// No plugins or hooks are exported from the root barrel

// Primary types
export { default as HederaAgentAPI } from './shared/api';
export { AgentMode } from './shared/configuration';
export type { Configuration, Context } from './shared/configuration';
export type { Plugin } from './shared/plugin';
export { PluginRegistry } from './shared/plugin';
export type { Tool } from './shared/tools';
export { ToolDiscovery } from './shared/tool-discovery';
export { default as HederaBuilder } from './shared/hedera-utils/hedera-builder';

// Utility exports used by plugins and toolkit packages
export { handleTransaction } from './shared/strategies/tx-mode-strategy';
export type {
  RawTransactionResponse,
  ExecuteStrategyResult,
} from './shared/strategies/tx-mode-strategy';
export { ExecuteStrategy } from './shared/strategies/tx-mode-strategy';
export { AccountResolver } from './shared/utils/account-resolver';
export { PromptGenerator } from './shared/utils/prompt-generator';
export {
  transactionToolOutputParser,
  untypedQueryOutputParser,
} from './shared/utils/default-tool-output-parsing';
export { IHederaMirrornodeService } from './shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
export { getMirrornodeService } from './shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
export { HederaMirrornodeServiceDefaultImpl } from './shared/hedera-utils/mirrornode/hedera-mirrornode-service-default-impl';
export { toBaseUnit, toDisplayUnit } from './shared/hedera-utils/decimals-utils';
export { toHbar } from './shared/hedera-utils/hbar-conversion-utils';
export type { TransferHbarInput, TokenTransferMinimalParams } from './shared/hedera-utils/types';

// Constants
export {
  ERC20_FACTORY_ADDRESSES,
  ERC721_FACTORY_ADDRESSES,
  ERC20_FACTORY_ABI,
  ERC721_FACTORY_ABI,
  ERC20_TRANSFER_FUNCTION_NAME,
  ERC20_TRANSFER_FUNCTION_ABI,
  ERC721_TRANSFER_FUNCTION_NAME,
  ERC721_TRANSFER_FUNCTION_ABI,
  ERC721_MINT_FUNCTION_NAME,
  ERC721_MINT_FUNCTION_ABI,
  getERC20FactoryAddress,
  getERC721FactoryAddress,
} from './shared/constants/contracts';

// Parameter normaliser
export { default as HederaParameterNormaliser } from './shared/hedera-utils/hedera-parameter-normaliser';

// Mirrornode types (re-exported for consumer and test use)
export type {
  AccountResponse,
  TokenBalance,
  TokenBalancesResponse,
  TopicMessagesResponse,
  TopicMessagesQueryParams,
  TopicInfo,
  TokenInfo,
  TransactionDetailsResponse,
  ContractInfo,
  ExchangeRateResponse,
  TokenAirdropsResponse,
  TokenAllowanceResponse,
  NftBalanceResponse,
  ScheduledTransactionDetailsResponse,
} from './shared/hedera-utils/mirrornode/types';

// Parameter schemas (used by plugins and tests)
export { contractExecuteTransactionParametersNormalised } from './shared/parameter-schemas/evm.zod';
export * from './shared/parameter-schemas/account.zod';
export * from './shared/parameter-schemas/token.zod';
export * from './shared/parameter-schemas/consensus.zod';
export * from './shared/parameter-schemas/common.zod';
export * from './shared/parameter-schemas/evm.zod';
export * from './shared/parameter-schemas/transaction.zod';
export * from './shared/parameter-schemas/core-misc.zod';
