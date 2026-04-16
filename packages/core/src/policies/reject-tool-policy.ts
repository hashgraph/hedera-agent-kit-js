import { AbstractPolicy, PreToolExecutionParams } from '@/shared';

export class RejectToolPolicy extends AbstractPolicy {
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
  protected shouldBlockPreToolExecution(_params: PreToolExecutionParams, _method: string): boolean {
    console.log('RejectToolPolicy: tool call rejected - tool not allowed');
    return true;
  }
}
