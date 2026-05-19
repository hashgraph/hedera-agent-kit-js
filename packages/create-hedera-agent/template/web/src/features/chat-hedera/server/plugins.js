import {
  coreAccountPlugin,
  coreAccountQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
  coreEVMPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTokenPlugin,
  coreTokenQueryPlugin,
  coreTransactionQueryPlugin,
} from "@hashgraph/hedera-agent-kit/plugins";

// Edit this list to add/remove tools shipped to the agent. AgentLab's code
// generator overwrites this file; manual users delete the lines they don't want.
export const plugins = [
  coreAccountPlugin, // create / update / delete accounts, transfer HBAR
  coreTokenPlugin, // HTS token mutations: create / mint / associate / transfer
  coreConsensusPlugin, // HCS topic mutations: create topic / submit message
  coreEVMPlugin, // EVM contract deploys and calls
  coreAccountQueryPlugin, // mirror-node queries about accounts and balances
  coreTokenQueryPlugin, // mirror-node queries about token info / balances / NFTs
  coreConsensusQueryPlugin, // mirror-node queries about HCS topics and messages
  coreEVMQueryPlugin, // mirror-node queries about contracts / EVM calls
  coreMiscQueriesPlugin, // network info, exchange rate, fees, time-of-day helpers
  coreTransactionQueryPlugin, // mirror-node lookups by transaction id
];
