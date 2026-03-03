import { Policy, Context, PreToolExecutionParams } from '@/shared';
import { Client } from '@hashgraph/sdk';

export class RejectToolPolicy extends Policy {
  name = 'Reject Tool Call';
  description = 'Stops agent from calling predefined tools';
  relevantTools: string[] = [];

  constructor(relevantTools: string[]) {
    super();
    this.relevantTools = relevantTools; // set the relevant tools
  }

  /*
   * Override to block execution at PreToolExecution for relevant tools.
   * All relevant tools will be blocked from executing
   */
  protected shouldBlockPreToolExecution(
    _context: Context,
    _params: PreToolExecutionParams,
    _client: Client,
  ): boolean {
    console.log('RejectToolPolicy: tool call rejected - tool not allowed');
    return true;
  }
}
