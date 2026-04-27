import hre from "hardhat";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const JSON_RPC_URL = process.env.HEDERA_JSON_RPC_RELAY_URL || "http://127.0.0.1:37546";
const MIRROR_NODE_REST_URL = process.env.HEDERA_MIRROR_NODE_REST_URL || "http://127.0.0.1:38081/api/v1";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getContractIdFromMirrorNode = async (evmAddress: string): Promise<string> => {
    const url = `${MIRROR_NODE_REST_URL}/contracts/${evmAddress.toLowerCase()}`;

    for (let attempt = 1; attempt <= 24; attempt += 1) {
        const response = await fetch(url);

        if (response.ok) {
            const data = (await response.json()) as { contract_id?: string };
            if (data.contract_id) {
                return data.contract_id;
            }
        }

        await wait(5000);
    }

    throw new Error(`Contract ${evmAddress} was not available from mirror node ${MIRROR_NODE_REST_URL}`);
};

async function main() {
    if (!process.env.HEDERA_ECDSA_PRIVATE_KEY) {
        throw new Error("HEDERA_ECDSA_PRIVATE_KEY is required for Solo factory deployment");
    }

    const provider = new JsonRpcProvider(JSON_RPC_URL, 298, { staticNetwork: true });
    const signer = new Wallet(process.env.HEDERA_ECDSA_PRIVATE_KEY, provider);
    const erc20FactoryArtifact = await hre.artifacts.readArtifact("BaseERC20Factory");
    const erc721FactoryArtifact = await hre.artifacts.readArtifact("BaseERC721Factory");

    const BaseERC20Factory = new ContractFactory(erc20FactoryArtifact.abi, erc20FactoryArtifact.bytecode, signer);
    const erc20Factory = await BaseERC20Factory.deploy();
    await erc20Factory.waitForDeployment();

    const BaseERC721Factory = new ContractFactory(erc721FactoryArtifact.abi, erc721FactoryArtifact.bytecode, signer);
    const erc721Factory = await BaseERC721Factory.deploy();
    await erc721Factory.waitForDeployment();

    const erc20FactoryAddress = await erc20Factory.getAddress();
    const erc721FactoryAddress = await erc721Factory.getAddress();
    const erc20FactoryContractId = await getContractIdFromMirrorNode(erc20FactoryAddress);
    const erc721FactoryContractId = await getContractIdFromMirrorNode(erc721FactoryAddress);

    console.log(`HEDERA_ERC20_FACTORY_ADDRESS=${erc20FactoryContractId}`);
    console.log(`HEDERA_ERC721_FACTORY_ADDRESS=${erc721FactoryContractId}`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
