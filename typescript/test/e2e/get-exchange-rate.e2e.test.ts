import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReactAgent } from 'langchain';
import { Client } from '@hashgraph/sdk';
import { createLangchainTestSetup, type LangchainTestSetup } from '../utils';
import { ResponseParserService } from '@/langchain';
import { itWithRetry } from '../utils/retry-util';

describe('Get Exchange Rate E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let client: Client;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    client = testSetup.client;
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
    if (client) client.close();
  });

  it(
    'returns the current exchange rate when no timestamp is provided',
    itWithRetry(async () => {
      const input = 'What is the current HBAR exchange rate?';

      const result: any = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw.current_rate).toBeTruthy();
      expect(typeof parsedResponse[0].parsedData.raw.current_rate.cent_equivalent).toBe('number');
      expect(typeof parsedResponse[0].parsedData.raw.current_rate.hbar_equivalent).toBe('number');
      expect(typeof parsedResponse[0].parsedData.raw.current_rate.expiration_time).toBe('number');

      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Current exchange rate');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Next exchange rate');
    }),
  );

  it(
    'handles invalid timestamp',
    itWithRetry(async () => {
      const input = 'Get the HBAR exchange rate at time monday-01';

      const result: any = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      console.log('invalid timestamp ', parsedResponse[0].parsedData.raw);

      expect(parsedResponse).toBeTruthy();
      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.raw.error).toContain('Not Found');
    }),
  );

  it(
    'returns exchange rate for a valid epoch seconds timestamp',
    itWithRetry(async () => {
      // Example: a historical timestamp in seconds since epoch
      const ts = '1726000000';
      const input = `Get the HBAR exchange rate at timestamp ${ts}`;

      const result: any = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw.current_rate).toBeTruthy();
      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Details for timestamp:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Current exchange rate');
    }),
  );

  it(
    'returns exchange rate for a valid precise timestamp (nanos)',
    itWithRetry(async () => {
      const ts = '1757512862.640825000';
      const input = `Get the HBAR exchange rate at timestamp ${ts}`;

      const result: any = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw).toEqual({
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
    }),
  );
});
