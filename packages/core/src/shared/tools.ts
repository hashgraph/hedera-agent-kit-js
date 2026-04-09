import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';

export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
  // transactionToolOutputParser and untypedQueryOutputParser can be used. If required, define a custom parser
  outputParser?: (rawOutput: string) => { raw: any; humanMessage: string };
};

export default Tool;
