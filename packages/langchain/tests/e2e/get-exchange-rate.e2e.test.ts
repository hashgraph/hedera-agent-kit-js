import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ReactAgent } from 'langchain';
import { Client } from '@hiero-ledger/sdk';
import { createLangchainTestSetup, type LangchainTestSetup } from '@tests/utils';
import { ResponseParserService } from '@hashgraph/hedera-agent-kit-langchain';
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
    async () => {
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
    },
  );

  it(
    'handles invalid timestamp',
    async () => {
      // Use epoch 0 (Jan 1 1970). Syntactically valid so the LLM forwards it to the
      // tool, but no network has exchange-rate data that far back, so mirror returns
      // 404. Avoids the LLM intercepting obviously-bad input (e.g. "not-a-valid-...")
      // and refusing to call the tool, which would yield an empty parsed response.
      const input = 'Get the HBAR exchange rate at timestamp 0';

      const result: any = await agent.invoke({
        messages: [{ role: 'user', content: input }],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse.length).toBeGreaterThan(0);
      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.raw.error).toMatch(/HTTP error! status: 4\d\d/);
    },
  );

  it(
    'returns exchange rate for a valid epoch seconds timestamp',
    async () => {
      // Derive a timestamp from the live rate so the test works on any network. Solo
      // has no historical exchange-rate data (only the active window), and testnet
      // prunes old buckets. The current bucket's `expiration_time - 1` is a value the
      // mirror is guaranteed to have right now.
      const currentResult: any = await agent.invoke({
        messages: [{ role: 'user', content: 'What is the current HBAR exchange rate?' }],
      });
      const current = responseParsingService.parseNewToolMessages(currentResult);
      const ts = String(current[0].parsedData.raw.current_rate.expiration_time - 1);

      const result: any = await agent.invoke({
        messages: [{ role: 'user', content: `Get the HBAR exchange rate at timestamp ${ts}` }],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw.current_rate).toBeTruthy();
      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Details for timestamp:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Current exchange rate');
    },
  );

  it(
    'returns exchange rate for a valid precise timestamp (nanos)',
    async () => {
      // Same dynamic-derivation approach, but in seconds.nanos format.
      const currentResult: any = await agent.invoke({
        messages: [{ role: 'user', content: 'What is the current HBAR exchange rate?' }],
      });
      const current = responseParsingService.parseNewToolMessages(currentResult);
      const ts = `${current[0].parsedData.raw.current_rate.expiration_time - 1}.000000000`;

      const result: any = await agent.invoke({
        messages: [{ role: 'user', content: `Get the HBAR exchange rate at timestamp ${ts}` }],
      });
      const parsedResponse = responseParsingService.parseNewToolMessages(result);

      expect(parsedResponse).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw).toBeTruthy();
      expect(parsedResponse[0].parsedData.raw.current_rate).toBeTruthy();
      expect(typeof parsedResponse[0].parsedData.raw.current_rate.cent_equivalent).toBe('number');
      expect(typeof parsedResponse[0].parsedData.raw.current_rate.hbar_equivalent).toBe('number');
      expect(typeof parsedResponse[0].parsedData.humanMessage).toBe('string');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Current exchange rate');
    },
  );
});
