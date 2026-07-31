import { IHederaMirrornodeService } from './hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { Plugin } from './plugin';
import { AbstractHook } from './hook';
import {
  ExecuteStrategyResult,
  ReturnBytesStrategyResult,
  TransactionStrategy,
} from './strategies/tx-mode-strategy';

/**
 * Defines the execution and signing mode for transactions created by the agent.
 */
export enum AgentMode {
  /**
   * Autonomous execution mode. The agent signs transactions using the local operator
   * private key and executes them directly on the Hedera network.
   */
  AUTONOMOUS = 'autonomous',
  
  /**
   * Return bytes mode. The agent does not sign or execute transactions. Instead,
   * it freezes the transaction and returns the raw unsigned transaction bytes (as Uint8Array)
   * to the client application, shifting signing and broadcast out-of-band.
   */
  RETURN_BYTES = 'returnBytes',
  
  /**
   * Custom execute mode. The agent delegates transaction signing **and execution** to a custom
   * strategy handler supplied via `context.transactionStrategy`. This mode is designed for
   * Human-in-the-Loop approval setups or integrations with remote signing services (such as
   * enclaves, MPC services, or secure API signing endpoints) that ultimately broadcast the
   * transaction and return a receipt.
   *
   * The strategy **must** return `ExecuteStrategyResult` (`{ raw: RawTransactionResponse, humanMessage: string }`),
   * which is enforced by the `TransactionStrategy` interface. This guarantees full compatibility
   * with audit-trail hooks (`HcsAuditTrailHook`, `HolAuditTrailHook`) and the standard tool
   * output pipeline. Behaves like `AUTONOMOUS` from the perspective of downstream consumers.
   */
  CUSTOM_EXECUTE_TX = 'customExecuteTx',

  /**
   * Custom return-bytes mode. The agent delegates transaction assembly to a custom strategy
   * handler supplied via `context.transactionStrategy`, but the strategy does **not** execute.
   * Instead it freezes the transaction and returns raw bytes for out-of-band signing/broadcast.
   *
   * This is the extensibility point for multi-party / delegated-payer flows where the payer
   * identity (e.g. an agent covering HBAR fees) differs from the subject account
   * (`context.accountId`, the asset owner who must sign). The strategy is free to call
   * `setTransactionId(TransactionId.generate(payerAccountId))` before freezing.
   *
   * The strategy **must** return `ReturnBytesStrategyResult` (`{ bytes: Uint8Array }`). Behaves
   * like `RETURN_BYTES` from the perspective of downstream consumers: post-execution lookups are
   * skipped and receipt-based audit-trail hooks (`HcsAuditTrailHook`, `HolAuditTrailHook`) are
   * unsupported (they reject this mode).
   */
  CUSTOM_RETURN_BYTES = 'customReturnBytes',
}

/**
 * True when `mode` produces serialized transaction bytes instead of executing on-chain.
 *
 * Groups `RETURN_BYTES` and `CUSTOM_RETURN_BYTES`. Call-sites that must skip post-execution work
 * (receipt/record lookups, receipt-based audit hooks) should branch on this rather than checking
 * `RETURN_BYTES` alone.
 */
export const isReturnBytesMode = (mode?: AgentMode): boolean =>
  mode === AgentMode.RETURN_BYTES || mode === AgentMode.CUSTOM_RETURN_BYTES;

/**
 * True when `mode` delegates to a user-supplied `context.transactionStrategy`.
 *
 * Groups `CUSTOM_EXECUTE_TX` and `CUSTOM_RETURN_BYTES`. Both require `transactionStrategy` to be
 * present in the `Context`.
 */
export const isCustomMode = (mode?: AgentMode): boolean =>
  mode === AgentMode.CUSTOM_EXECUTE_TX || mode === AgentMode.CUSTOM_RETURN_BYTES;

/**
 * Settings and execution context applied to all requests and tools within the kit.
 */
export type Context = {
  /**
   * The connected Account ID. Used by tools to identify which account
   * transactions are being built for.
   * Required when mode is `AgentMode.RETURN_BYTES` or `AgentMode.CUSTOM_RETURN_BYTES` for running
   * non-query tools.
   * Recommended for `AgentMode.CUSTOM_EXECUTE_TX` and `AgentMode.AUTONOMOUS`.
   */
  accountId?: string;

  /**
   * The public key of the connected account. Passed in configuration or
   * dynamically resolved using the Mirrornode based on the `accountId`.
   */
  accountPublicKey?: string;

  /**
   * Specifies the transaction execution mode. Defaults to `AgentMode.AUTONOMOUS`.
   */
  mode?: AgentMode;

  /**
   * A custom transaction strategy instance that handles signing and broadcasting.
   * Required when `mode` is set to `AgentMode.CUSTOM_EXECUTE_TX` or `AgentMode.CUSTOM_RETURN_BYTES`.
   * Most custom strategies also require `accountId` to be set in the Context.
   *
   * The required return shape depends on the mode:
   * - `CUSTOM_EXECUTE_TX` — the strategy must return `ExecuteStrategyResult`
   *   (`{ raw: RawTransactionResponse, humanMessage: string }`), enabling audit-trail hooks to work
   *   identically to `AgentMode.AUTONOMOUS`.
   * - `CUSTOM_RETURN_BYTES` — the strategy must return `ReturnBytesStrategyResult`
   *   (`{ bytes: Uint8Array }`), behaving like `AgentMode.RETURN_BYTES`.
   */
  transactionStrategy?:
    | TransactionStrategy<ExecuteStrategyResult>
    | TransactionStrategy<ReturnBytesStrategyResult>;

  /**
   * Optional custom Mirrornode service implementation.
   */
  mirrornodeService?: IHederaMirrornodeService;

  /**
   * Hook middleware instances executed at key lifecycle points during tool runs.
   * (Used for policy checks, auditing, custom filtering, etc.)
   */
  hooks?: AbstractHook[];
};

/**
 * Configuration options used to initialize the Hedera Agent Kit.
 */
export type Configuration = {
  /**
   * Optional list of specific tool method names to load. If empty or omitted,
   * all tools defined in the registered plugins are loaded.
   */
  tools?: string[];
  
  /**
   * The list of plugin instances to register with the agent. Plugins must be
   * explicitly provided to enable their tools.
   */
  plugins?: Plugin[];
  
  /**
   * The global execution context for the kit, configuring connected accounts,
   * execution modes, custom signing strategies, and audit hooks.
   */
  context?: Context;
};
