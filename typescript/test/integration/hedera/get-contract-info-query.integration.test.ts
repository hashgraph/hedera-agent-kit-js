import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { AccountId, Client, PrivateKey } from '@hashgraph/sdk';
import getContractInfoTool from '@/plugins/core-evm-query-plugin/tools/queries/get-contract-info-query';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { Context } from '@/shared';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { wait } from '../../utils/general-util';
import { COMPILED_ERC20_BYTECODE, MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';

describe('Integration - Hedera Get Contract Info', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let executorAccountId: AccountId;
  let executorWrapper: HederaOperationsWrapper;
  let deployedContractId: string;
  let mirrornodeService: IHederaMirrornodeService;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // create an executor account
    const executorAccountKey = PrivateKey.generateED25519();
    executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 7 })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorAccountKey);
    executorWrapper = new HederaOperationsWrapper(executorClient);
    mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);

    // deploy ERC20 contract
    const deployment = await executorWrapper.deployERC20(COMPILED_ERC20_BYTECODE);
    deployedContractId = deployment.contractId!;

    await wait(MIRROR_NODE_WAITING_TIME); // wait for mirrornode sync
  });

  it('fetches info for a deployed smart contract', async () => {
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService,
    };
    const tool = getContractInfoTool(context);

    const result = await tool.execute(executorClient, context, {
      contractId: deployedContractId,
    });

    expect(result.raw.contractId).toBe(deployedContractId);
    expect(result.raw.contractInfo.contract_id).toBe(deployedContractId);
  });

  it('Handles non-existing smart contract', async () => {
    context = {
      accountId: executorClient.operatorAccountId!.toString(),
      mirrornodeService,
    };
    const tool = getContractInfoTool(context);

    await wait(MIRROR_NODE_WAITING_TIME); // wait for mirrornode sync

    const nonExistingContract = 'non-existing-contract-id';
    const result = await tool.execute(executorClient, context, {
      contractId: nonExistingContract,
    });

    expect(result.raw.contractInfo).toBeUndefined();
    expect(result.raw.error).toContain('Failed to get contract info');
    expect(result.humanMessage).toContain('Failed to get contract info');
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
