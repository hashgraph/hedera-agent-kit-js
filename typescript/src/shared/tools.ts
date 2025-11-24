import { z } from 'zod';
import { Client } from '@hashgraph/sdk';
import { Context } from './configuration';

export type Tool = {
  method: string;
  name: string;
  description: string;
  parameters: z.ZodObject<any, any>;
  execute: (client: Client, context: Context, params: any) => Promise<any>;
  outputParser: (rawOutput: string) => { raw: any; humanMessage: string };
};

export default Tool;
