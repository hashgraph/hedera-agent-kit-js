import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import getContractInfoTool from '@/plugins/core-evm-query-plugin/tools/queries/get-contract-info-query';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { Context } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { wait } from '../../utils/general-util';
import { COMPILED_ERC20_BYTECODE } from '../../utils/constants';

describe('Integration - Hedera Get Contract Info', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let deployedContractId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // create executor account
    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 5 })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // deploy ERC20 contract
    // const deployment = await executorWrapper.deployERC20(COMPILED_ERC20_BYTECODE);
    // deployedContractId = deployment.contractId!;
    deployedContractId = '0.0.6793266'; // TODO: remove this when we have a real contract to test with
  });

  it('fetches info for a deployed smart contract', async () => {
    const mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService,
    };
    const tool = getContractInfoTool(context);

    await wait(4000); // wait for mirrornode sync

    const result = await tool.execute(executorClient, context, {
      contractId: deployedContractId,
    });

    expect((result as any).raw.contractId.toString()).toBe(deployedContractId);
  });

  afterAll(async () => {
    if (executorClient && operatorClient) {
      await executorWrapper.deleteAccount({
        accountId: executorClient.operatorAccountId!,
        transferAccountId: operatorClient.operatorAccountId!,
      });
      executorClient.close();
      operatorClient.close();
    }
  });
});
