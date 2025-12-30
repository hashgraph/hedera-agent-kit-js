import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { Client, Key, PrivateKey, AccountId } from '@hashgraph/sdk';
import { ReactAgent } from 'langchain';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
} from '../utils';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { ResponseParserService } from '@/langchain';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

describe('Get Account Query E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agent: ReactAgent;
  let responseParsingService: ResponseParserService;
  let client: Client;
  let hederaOps: HederaOperationsWrapper;
  let createdAccountId: string | undefined;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agent = testSetup.agent;
    responseParsingService = testSetup.responseParser;
    client = testSetup.client;
    hederaOps = new HederaOperationsWrapper(client);
  });

  afterAll(async () => {
    if (testSetup) testSetup.cleanup();
  });

  afterEach(async () => {
    if (createdAccountId) {
      await returnHbarsAndDeleteAccount(
        hederaOps,
        AccountId.fromString(createdAccountId),
        client.operatorAccountId!,
      );
      createdAccountId = undefined;
    }
  });

  it(
    'should return account info for a newly created account',
    itWithRetry(async () => {
      const privateKey = PrivateKey.generateED25519();
      const accountId = await hederaOps
        .createAccount({
          key: privateKey.publicKey as Key,
          initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.MINIMAL),
        })
        .then(resp => resp.accountId!);
      createdAccountId = accountId.toString();

      // Give the mirror node a chance to sync
      await wait(MIRROR_NODE_WAITING_TIME);

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Get account info for ${accountId.toString()}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Details for ${accountId.toString()}`,
      );
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Balance:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Public Key:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('EVM address:');

      // Verify state directly
      const info = await hederaOps.getAccountInfo(accountId.toString());
      expect(info.accountId.toString()).toBe(accountId.toString());
      expect(info.balance).toBeDefined();
      expect(info.key?.toString()).toBe(privateKey.publicKey.toStringDer());
    }),
  );

  it(
    'should return account info for the operator account',
    itWithRetry(async () => {
      const operatorId = client.operatorAccountId!.toString();

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Query details for account ${operatorId}`,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(`Details for ${operatorId}`);
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Balance:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('Public Key:');
      expect(parsedResponse[0].parsedData.humanMessage).toContain('EVM address:');

      const info = await hederaOps.getAccountInfo(operatorId);
      expect(info.accountId.toString()).toBe(operatorId);
    }),
  );

  it(
    'should fail gracefully for non-existent account',
    itWithRetry(async () => {
      const fakeAccountId = '0.0.999999999';

      const queryResult = await agent.invoke({
        messages: [
          {
            role: 'user',
            content: `Get account info for ${fakeAccountId} `,
          },
        ],
      });

      const parsedResponse = responseParsingService.parseNewToolMessages(queryResult);

      expect(parsedResponse[0].parsedData.humanMessage).toContain(
        `Failed to fetch account ${fakeAccountId}`,
      );
    }),
  );
});
