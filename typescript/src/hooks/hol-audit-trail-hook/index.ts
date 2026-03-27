import z from 'zod';

import {
  AbstractHook,
  PostSecondaryActionParams,
  PreToolExecutionParams,
  AgentMode,
} from '@/shared';
import { buildAuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import { AuditSession } from '@/hooks/hol-audit-trail-hook/audit/audit-session';
import { HolAuditWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/hol-audit-writer';

const configSchema = z.object({
  relevantTools: z.array(z.string()),
  sessionId: z
    .string()
    .regex(/^0\.0\.\d+$/, 'sessionId must be a valid Hedera topic ID in format 0.0.xxx'),
});

export type HolAuditTrailHookConfig = z.infer<typeof configSchema>;

/**
 * Hook that writes HOL-standards-compliant audit trails to an HCS session topic.
 *
 * Uses an HCS-2 INDEXED registry as the session topic to list audit entries.
 * Delegates to AuditSession + HolAuditWriter for all write operations.
 */
export class HolAuditTrailHook extends AbstractHook {
  relevantTools: string[];
  name: string;
  description: string;

  private session: AuditSession | null = null;
  private sessionId: string;

  /**
   * @param config.sessionId - Hedera topic ID (format `0.0.xxx`) used as the audit session registry.
   *   The topic should be created with memo `hcs-2:0:0` to be fully compliant with the HCS-2 standard.
   *   See {@link https://hol.org/docs/standards/hcs-2/}
   * @param config.relevantTools - List of tool names that trigger audit trail logging.
   */
  constructor(config: HolAuditTrailHookConfig) {
    super();
    const validated = configSchema.parse(config);
    this.relevantTools = validated.relevantTools;
    this.name = 'HOL Audit Trail Hook';
    this.description =
      'Hook to add HOL-standards-compliant audit trail to HCS topics. Available only in Agent Mode AUTONOMOUS.';
    this.sessionId = validated.sessionId;
  }

  getSessionId(): string {
    return this.session?.getSessionId() ?? this.sessionId;
  }

  async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    if (params.context.mode === AgentMode.RETURN_BYTES) {
      throw new Error(
        `Unsupported hook: HolAuditTrailHook is available only in Agent Mode AUTONOMOUS. Stopping the agent execution before tool ${method} is executed.`,
      );
    }
  }

  async postToolExecutionHook(params: PostSecondaryActionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    try {
      if (!this.session) {
        const writer = new HolAuditWriter(params.client);
        this.session = new AuditSession(writer, this.sessionId);
      }

      const entry = buildAuditEntry({
        tool: method,
        params: params.normalisedParams,
        result: {
          raw: params.toolResult?.raw as Record<string, any>,
          message: params.toolResult?.humanMessage,
        },
      });

      await this.session.writeEntry(entry);
    } catch (error) {
      console.error(`HolAuditTrailHook: Failed to log audit entry for tool ${method}:`, error);
    }
  }
}
