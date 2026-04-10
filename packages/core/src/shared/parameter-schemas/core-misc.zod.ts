import { Context } from '@/shared/configuration';
import { z } from 'zod';

export const exchangeRateQueryParameters = (_context: Context) =>
  z.object({
    timestamp: z
      .string()
      .describe('Historical timestamp to query (seconds or nanos since epoch)')
      .optional(),
  });
