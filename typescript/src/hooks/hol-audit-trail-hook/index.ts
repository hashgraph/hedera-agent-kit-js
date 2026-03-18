import { AbstractHook, PostSecondaryActionParams, PreToolExecutionParams, AgentMode, Context } from '@/shared';
import { buildAuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import { AuditSession } from '@/hooks/hol-audit-trail-hook/audit/audit-session';
import { HolAuditWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/hol-audit-writer';

export type HolAuditTrailHookConfig = {
  relevantTools: string[];
  sessionTopicId?: string;
};

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
  private sessionTopicId?: string;

  constructor(config: HolAuditTrailHookConfig) {
    super();
    this.relevantTools = config.relevantTools;
    this.name = 'HOL Audit Trail Hook';
    this.description =
      'Hook to add HOL-standards-compliant audit trail to HCS topics. Available only in Agent Mode AUTONOMOUS.';
    this.sessionTopicId = config.sessionTopicId;
  }

  getSessionTopicId(): string | null {
    return this.session?.getSessionId() ?? this.sessionTopicId ?? null;
  }

  async preToolExecutionHook(
    context: Context,
    _params: PreToolExecutionParams,
    method: string,
  ): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    if (context.mode === AgentMode.RETURN_BYTES) {
      throw new Error(
        `Unsupported hook: HolAuditTrailHook is available only in Agent Mode AUTONOMOUS. Stopping the agent execution before tool ${method} is executed.`,
      );
    }
  }

  async postToolExecutionHook(
    _context: Context,
    params: PostSecondaryActionParams,
    method: string,
  ): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    try {
      if (!this.session) {
        const writer = new HolAuditWriter(params.client);
        this.session = new AuditSession(writer, this.sessionTopicId);
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
