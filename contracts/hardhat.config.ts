import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
    solidity: "0.8.28",
    // add hedera mainnet, testnet, previewnet networks
    networks: {
        hederaMainnet: {
            url: "https://mainnet.hashio.io/api",
            accounts: [process.env.PRIVATE_KEY || ""],
        },
        hederaTestnet: {
            url: "https://testnet.hashio.io/api",
            accounts: [process.env.PRIVATE_KEY || ""],
        },
        hederaPreviewnet: {
            url: "https://previewnet.hashio.io/api",
            accounts: [process.env.PRIVATE_KEY || ""],
        },
    },
};

export default config;
