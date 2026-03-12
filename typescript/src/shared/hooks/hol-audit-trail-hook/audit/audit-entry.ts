import z from 'zod';

import { HOL_AUDIT_ENTRY_TYPE, HOL_AUDIT_ENTRY_VERSION, HOL_AUDIT_ENTRY_SOURCE } from '@/shared/hooks/hol-audit-trail-hook/audit/constants';

export type AuditEntry = {
  type: typeof HOL_AUDIT_ENTRY_TYPE;
  version: typeof HOL_AUDIT_ENTRY_VERSION;
  source: string;
  timestamp: string;
  tool: string;
  params: Record<string, any>;
  result: {
    raw: Record<string, any>;
    message: string | null;
  };
};

export type BuildAuditEntryParams = {
  tool: string;
  params?: Record<string, any>;
  result?: {
    raw?: Record<string, any>;
    message?: string | null;
  };
};

export const auditEntrySchema = z.object({
  type: z.literal(HOL_AUDIT_ENTRY_TYPE),
  version: z.literal(HOL_AUDIT_ENTRY_VERSION),
  source: z.string().describe('Identifier of the system that produced this entry.'),
  timestamp: z.string().describe('ISO 8601 timestamp of when the tool was executed.'),
  tool: z.string().describe('Name of the tool that was executed.'),
  params: z.record(z.any()).describe('Normalised parameters passed to the tool.'),
  result: z.object({
    raw: z.record(z.any()).describe('Raw result returned by the tool.'),
    message: z.string().nullable().describe('Human-readable result message.'),
  }),
});

export function buildAuditEntry(params: BuildAuditEntryParams): AuditEntry {
  return {
    type: HOL_AUDIT_ENTRY_TYPE,
    version: HOL_AUDIT_ENTRY_VERSION,
    source: HOL_AUDIT_ENTRY_SOURCE,
    timestamp: new Date().toISOString(),
    tool: params.tool,
    params: params.params ?? {},
    result: {
      raw: params.result?.raw ?? {},
      message: params.result?.message ?? null,
    },
  };
}
