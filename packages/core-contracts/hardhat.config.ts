import { HardhatUserConfig } from "hardhat/config";
import { config as dotenvConfig } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Load the repo-root .env.test.local so `pnpm deploy:solo` works locally with the same
// env file the tests use. In CI the env vars come from the workflow and this is a no-op
// (dotenv silently skips missing paths).
const here = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(here, "../../.env.test.local") });

const accounts = (privateKey: string | undefined): string[] => (privateKey ? [privateKey] : []);

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    // add hedera mainnet, testnet, previewnet, and Solo networks
    networks: {
        hederaMainnet: {
            type: "http",
            url: "https://mainnet.hashio.io/api",
            accounts: accounts(process.env.HEDERA_PRIVATE_KEY),
        },
        hederaTestnet: {
            type: "http",
            url: "https://testnet.hashio.io/api",
            accounts: accounts(process.env.HEDERA_PRIVATE_KEY),
        },
        hederaPreviewnet: {
            type: "http",
            url: "https://previewnet.hashio.io/api",
            accounts: accounts(process.env.HEDERA_PRIVATE_KEY),
        },
        hederaSolo: {
            type: "http",
            url: process.env.HEDERA_JSON_RPC_RELAY_URL || "http://127.0.0.1:37546",
            accounts: accounts(process.env.HEDERA_ECDSA_PRIVATE_KEY),
        },
    },
};

export default config;
