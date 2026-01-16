import { IHederaMirrornodeService } from './hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { Plugin } from './plugin';
import { Policy } from './policy';

export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  RETURN_BYTES = 'returnBytes',
}

// Context are settings that are applied to all requests made by the integration.
export type Context = {
  // Account is a Connected Account ID. If set, the integration will
  // make requests for this Account.
  accountId?: string;
  // Account Public Key is either passed in configuration or fetched based on the passed accountId
  accountPublicKey?: string;

  // defines if the agent executes the transactions or returns the raw transaction bytes
  mode?: AgentMode;

  // Mirrornode config
  mirrornodeService?: IHederaMirrornodeService;

  // Custom policies to enforce
  policies?: Policy[];
};

export type Configuration = {
  //if empty, all tools will be used.
  tools?: string[];
  //external plugins to load
  plugins?: Plugin[];
  context?: Context;
};
