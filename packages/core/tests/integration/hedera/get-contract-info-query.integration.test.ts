import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import getContractInfoTool from '@/plugins/core-evm-query-plugin/tools/queries/get-contract-info-query';
import {
  getProfile,
  HederaOperationsWrapper,
  type TestAccount,
} from '@hashgraph/hedera-agent-kit-tests';
import type { Context } from '@/shared/configuration';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import { waitForMirrorTx } from '@hashgraph/hedera-agent-kit-tests';
import { COMPILED_ERC20_BYTECODE } from '@hashgraph/hedera-agent-kit-tests';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';

describe('Integration - Hedera Get Contract Info', () => {
  const profile = getProfile();
  let executor: TestAccount;
  let executorClient: Client;
  let executorWrapper: HederaOperationsWrapper;
  let context: Context;
  let deployedContractId: string;
  let mirrornodeService: IHederaMirrornodeService;

  beforeAll(async () => {
    executor = await profile.accounts.acquire({ tier: 'STANDARD' });
    ({ client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor));
    mirrornodeService = getMirrornodeService(undefined, executorClient.ledgerId!);

    // deploy ERC20 contract
    const deployment = await executorWrapper.deployERC20(COMPILED_ERC20_BYTECODE);
    deployedContractId = deployment.contractId!;

    await waitForMirrorTx(executorWrapper, deployment.transactionId!); // wait for mirrornode sync
  });

  it('fetches info for a deployed smart contract', async () => {
    context = {
      accountId: executor.accountId.toString(),
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
      accountId: executor.accountId.toString(),
      mirrornodeService,
    };
    const tool = getContractInfoTool(context);

    const nonExistingContract = 'non-existing-contract-id';
    const result = await tool.execute(executorClient, context, {
      contractId: nonExistingContract,
    });

    expect(result.raw.contractInfo).toBeUndefined();
    expect(result.raw.error).toContain('Failed to get contract info');
    expect(result.humanMessage).toContain('Failed to get contract info');
  });

  afterAll(async () => {
    await profile.accounts.release(executor);
    executorClient?.close();
  });
});
