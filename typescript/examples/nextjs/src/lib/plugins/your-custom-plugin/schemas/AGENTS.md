# AGENTS.md — Schemas (schemas)

**Goal:** Centralize and document input validation for tools using **Zod**.

---

## Principles

- One Zod object per tool input shape (e.g., `<tool>.schema.ts`).
- **Describe every field** with `.describe()` so agents can auto-document params.
- Prefer specific refinements over `any`; encode formats (AccountId, TopicId) as strings with `.regex(...)` if helpful.
- Re-export common atoms (e.g., `accountIdSchema`, `topicIdSchema`, `tokenIdSchema`, `memoSchema`) from `schemas/index.ts`.

---

## Example atoms

```ts
// schemas/atoms.ts
import { z } from 'zod';

export const accountIdSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'Expected Hedera AccountId like 0.0.1234')
  .describe('Hedera AccountId (e.g., 0.0.1234)');

export const memoSchema = z
  .string()
  .max(100, 'Max 100 chars')
  .describe('Optional transaction memo');
```

## Example tool schema

```ts
// schemas/transfer-hbar.schema.ts
import { z } from 'zod';
import { accountIdSchema, memoSchema } from './atoms';

export const transferHbarParams = z.object({
  to: accountIdSchema.describe('Recipient AccountId'),
  amount: z.number().positive().describe('HBAR amount (whole HBAR)'),
  from: accountIdSchema.optional().describe('Sender AccountId; defaults to context'),
  memo: memoSchema.optional(),
});

export type TransferHbarParams = z.infer<typeof transferHbarParams>;
```

## Why Zod?

Hedera Agent Kit recommends Zod for robust input validation and clarity in tool definitions.

Zod schemas provide:

- Strong runtime validation,
- Self-documenting parameters (via .describe()),
- Easy TypeScript inference (z.infer).
