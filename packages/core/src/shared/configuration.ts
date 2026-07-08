import { IHederaMirrornodeService } from './hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { Plugin } from './plugin';
import { AbstractHook } from './hook';
import { ExecuteStrategyResult, TransactionStrategy } from './strategies/tx-mode-strategy';

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
   * Custom strategy mode. The agent delegates transaction signing and execution to a custom
   * strategy handler supplied via `context.transactionStrategy`. This mode is designed for
   * Human-in-the-Loop approval setups or integrations with remote signing services (such as
   * enclaves, MPC services, or secure API signing endpoints).
   *
   * The strategy **must** return `ExecuteStrategyResult` (`{ raw: RawTransactionResponse, humanMessage: string }`),
   * which is enforced by the `TransactionStrategy` interface. This guarantees full compatibility
   * with audit-trail hooks (`HcsAuditTrailHook`, `HolAuditTrailHook`) and the standard tool
   * output pipeline.
   */
  CUSTOM = 'custom',
}

/**
 * Settings and execution context applied to all requests and tools within the kit.
 */
export type Context = {
  /**
   * The connected Account ID. Used by tools to identify which account
   * transactions are being built for.
   * Required when mode is `AgentMode.RETURN_BYTES` for running non-query tools
   * Recommended for `AgentMode.CUSTOM` and  `AgentMode.AUTONOMUS`.
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
   * Required when `mode` is set to `AgentMode.CUSTOM`. Most custom strategies also require
   * `accountId` to be set in the Context to determine the transaction payer.
   *
   * The strategy must return `ExecuteStrategyResult` (`{ raw: RawTransactionResponse, humanMessage: string }`).
   * This is enforced by the `TransactionStrategy` interface and enables audit-trail hooks to work
   * identically to `AgentMode.AUTONOMOUS`.
   */
  transactionStrategy?: TransactionStrategy<ExecuteStrategyResult>;

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
