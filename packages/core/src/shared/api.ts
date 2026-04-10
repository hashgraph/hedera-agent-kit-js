import { Client } from '@hashgraph/sdk';

import type { Context } from './configuration';
import { Tool } from './tools';

class HederaAgentAPI {
  client: Client;

  context: Context;

  tools: Tool[];

  constructor(client: Client, context?: Context, tools?: Tool[]) {
    this.client = client;
    if (!this.client.ledgerId) {
      throw new Error('Client must be connected to a network');
    }
    this.context = context || {};
    this.tools = tools || [];
  }

  async run(method: string, arg: unknown) {
    const tool = this.tools.find(t => t.method === method);
    if (tool) {
      const output = JSON.stringify(await tool.execute(this.client, this.context, arg));
      return output;
    } else {
      throw new Error('Invalid method ' + method);
    }
  }
}

export default HederaAgentAPI;
