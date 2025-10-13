import { Context } from '@/shared';
import { Plugin } from '@/shared/plugin';
import transferHbarTool, {
  TRANSFER_HBAR_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import transferHbarWithAllowanceTool, {
  TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar-with-allowance';
import approveHbarAllowanceTool, {
  APPROVE_HBAR_ALLOWANCE_TOOL,
} from '@/plugins/core-account-plugin/tools/account/approve-hbar-allowance';
import createAccountTool, {
  CREATE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/create-account';
import deleteAccountTool, {
  DELETE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/delete-account';
import updateAccountTool, {
  UPDATE_ACCOUNT_TOOL,
} from '@/plugins/core-account-plugin/tools/account/update-account';
import signScheduleTransactionTool, {
  SIGN_SCHEDULE_TRANSACTION_TOOL,
} from '@/plugins/core-account-plugin/tools/account/sign-schedule-transaction';
import scheduleDeleteTool, {
  SCHEDULE_DELETE_TOOL,
} from '@/plugins/core-account-plugin/tools/account/schedule-delete';
import deleteHbarAllowanceTool, {
  DELETE_HBAR_ALLOWANCE_TOOL,
} from '@/plugins/core-account-plugin/tools/account/delete-hbar-allowance';
import approveTokenAllowanceTool, {
  APPROVE_TOKEN_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/approve-token-allowance';
import deleteTokenAllowanceTool, {
  DELETE_TOKEN_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/delete-token-allowance';

export const coreAccountPlugin: Plugin = {
  name: 'core-account-plugin',
  version: '1.0.0',
  description: 'A plugin for the Hedera Account Service',
  tools: (context: Context) => {
    return [
      transferHbarTool(context),
      approveHbarAllowanceTool(context),
      deleteHbarAllowanceTool(context),
      deleteAccountTool(context),
      updateAccountTool(context),
      createAccountTool(context),
      signScheduleTransactionTool(context),
      scheduleDeleteTool(context),
      approveTokenAllowanceTool(context),
      transferHbarWithAllowanceTool(context),
      deleteTokenAllowanceTool(context),
    ];
  },
};

export const coreAccountPluginToolNames = {
  TRANSFER_HBAR_TOOL,
  APPROVE_HBAR_ALLOWANCE_TOOL,
  DELETE_HBAR_ALLOWANCE_TOOL,
  CREATE_ACCOUNT_TOOL,
  DELETE_ACCOUNT_TOOL,
  UPDATE_ACCOUNT_TOOL,
  SIGN_SCHEDULE_TRANSACTION_TOOL,
  SCHEDULE_DELETE_TOOL,
  APPROVE_TOKEN_ALLOWANCE_TOOL,
  DELETE_TOKEN_ALLOWANCE_TOOL,
  TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
} as const;

export default { coreAccountPlugin, coreAccountPluginToolNames };
