import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { Client } from '@hashgraph/sdk';
import { createLangchainTestSetup, type LangchainTestSetup } from '../utils';
import { extractObservationFromLangchainResponse } from '../utils/general-util';
import { itWithRetry } from '../utils/retry-util';

describe('Get Exchange Rate E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let client: Client;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    client = testSetup.client;
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
    if (client) client.close();
  });

  it('returns the current exchange rate when no timestamp is provided', itWithRetry(async () => {
    const input = 'What is the current HBAR exchange rate?';

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeTruthy();
    expect(observation.raw).toBeTruthy();
    expect(observation.raw.current_rate).toBeTruthy();
    expect(typeof observation.raw.current_rate.cent_equivalent).toBe('number');
    expect(typeof observation.raw.current_rate.hbar_equivalent).toBe('number');
    expect(typeof observation.raw.current_rate.expiration_time).toBe('number');

    expect(typeof observation.humanMessage).toBe('string');
    expect(observation.humanMessage).toContain('Current exchange rate');
    expect(observation.humanMessage).toContain('Next exchange rate');
  }));

  it('handles invalid timestamp', itWithRetry(async () => {
    const input = 'Get the HBAR exchange rate at time monday-01';

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    console.log('invalid timestamp ', observation.raw);

    expect(observation).toBeTruthy();
    expect(typeof observation.humanMessage).toBe('string');
    expect(observation.raw.error).toContain('status: 404. Message: Not Found');
  }));

  it('returns exchange rate for a valid epoch seconds timestamp', itWithRetry(async () => {
    // Example: a historical timestamp in seconds since epoch
    const ts = '1726000000';
    const input = `Get the HBAR exchange rate at timestamp ${ts}`;

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeTruthy();
    expect(observation.raw).toBeTruthy();
    expect(observation.raw.current_rate).toBeTruthy();
    expect(typeof observation.humanMessage).toBe('string');
    expect(observation.humanMessage).toContain('Details for timestamp:');
    expect(observation.humanMessage).toContain('Current exchange rate');
  }));

  it('returns exchange rate for a valid precise timestamp (nanos)', itWithRetry(async () => {
    const ts = '1757512862.640825000';
    const input = `Get the HBAR exchange rate at timestamp ${ts}`;

    const result: any = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeTruthy();
    expect(observation.raw).toEqual({
      current_rate: {
        cent_equivalent: 703411,
        expiration_time: 1757516400,
        hbar_equivalent: 30000,
      },
      next_rate: {
        cent_equivalent: 707353,
        expiration_time: 1757520000,
        hbar_equivalent: 30000,
      },
      timestamp: '1757512862.640825000',
    });
  }));
});
