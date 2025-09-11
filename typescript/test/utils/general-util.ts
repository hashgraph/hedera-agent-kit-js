/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * Useful for adding delays in async operations or testing scenarios.
 *
 * @param ms - The number of milliseconds to wait before resolving the promise
 * @returns A promise that resolves after the specified delay
 *
 * @example
 * ```typescript
 * // Wait for 1 second
 * await wait(4000);
 * console.log('This runs after 1 second');
 * ```
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts and parses the observation from the last intermediate step of a Langchain agent result.
 * This function is designed to work with Langchain agent execution results that contain
 * intermediate steps with observations.
 *
 * @param agentResult - The result object from a Langchain agent execution containing intermediateSteps
 * @returns The parsed observation object from the last intermediate step
 *
 * @throws {Error} When no intermediate steps are found in the agent result
 * @throws {Error} When no observation is found in the last intermediate step
 * @throws {SyntaxError} When the observation cannot be parsed as JSON
 *
 * @example
 * ```typescript
 * const agentResult = {
 *   intermediateSteps: [
 *     { observation: '{"status": "success", "data": "result"}' }
 *   ]
 * };
 * const observation = extractObservationFromLangchainResponse(agentResult);
 * console.log(observation); // { status: "success", data: "result" }
 * ```
 */
export function extractObservationFromLangchainResponse(agentResult: any): any {
  if (!agentResult.intermediateSteps || agentResult.intermediateSteps.length === 0) {
    throw new Error('No intermediate steps found in agent result');
  }
  const lastStep = agentResult.intermediateSteps[agentResult.intermediateSteps.length - 1];
  const observationRaw = lastStep.observation;
  if (!observationRaw) throw new Error('No observation found in intermediate step');
  return JSON.parse(observationRaw);
}
