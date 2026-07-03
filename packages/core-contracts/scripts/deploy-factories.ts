import hre from "hardhat";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const JSON_RPC_URL = process.env.HEDERA_JSON_RPC_RELAY_URL || "http://127.0.0.1:37546";
const MIRROR_NODE_REST_URL = process.env.HEDERA_MIRROR_NODE_REST_URL || "http://127.0.0.1:38081/api/v1";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryableError = { code?: string; info?: { responseStatus?: string }; shortMessage?: string };

const isTransientRpcError = (err: unknown): boolean => {
    const e = err as RetryableError;
    if (e?.code === "SERVER_ERROR" || e?.code === "NETWORK_ERROR" || e?.code === "TIMEOUT") return true;
    const status = e?.info?.responseStatus ?? "";
    return /^5\d\d/.test(status) || /\b(502|503|504)\b/.test(e?.shortMessage ?? "");
};

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5, baseDelayMs = 3000): Promise<T> {
    let lastErr: unknown;
    for (let i = 1; i <= attempts; i += 1) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isTransientRpcError(err) || i === attempts) throw err;
            const delay = baseDelayMs * i;
            console.warn(`[${label}] transient RPC error (attempt ${i}/${attempts}), retrying in ${delay}ms:`, (err as RetryableError)?.shortMessage ?? err);
            await wait(delay);
        }
    }
    throw lastErr;
}

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

const ECDSA_HEX_PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function assertEcdsaHexPrivateKey(value: string | undefined): asserts value is string {
    if (!value) {
        throw new Error("HEDERA_PRIVATE_KEY is required for factory deployment");
    }
    if (!ECDSA_HEX_PRIVATE_KEY_PATTERN.test(value)) {
        throw new Error(
            "HEDERA_PRIVATE_KEY must be a hex encoded ECDSA secp256k1 key (0x + 64 hex chars).",
        );
    }
}

async function main() {
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    assertEcdsaHexPrivateKey(privateKey);

    const provider = new JsonRpcProvider(JSON_RPC_URL, 298, { staticNetwork: true });
    const signer = new Wallet(privateKey, provider);
    const erc20FactoryArtifact = await hre.artifacts.readArtifact("BaseERC20Factory");
    const erc721FactoryArtifact = await hre.artifacts.readArtifact("BaseERC721Factory");

    const BaseERC20Factory = new ContractFactory(erc20FactoryArtifact.abi, erc20FactoryArtifact.bytecode, signer);
    const erc20Factory = await withRetry("BaseERC20Factory.deploy", async () => {
        const c = await BaseERC20Factory.deploy();
        await c.waitForDeployment();
        return c;
    });

    const BaseERC721Factory = new ContractFactory(erc721FactoryArtifact.abi, erc721FactoryArtifact.bytecode, signer);
    const erc721Factory = await withRetry("BaseERC721Factory.deploy", async () => {
        const c = await BaseERC721Factory.deploy();
        await c.waitForDeployment();
        return c;
    });

    const erc20FactoryAddress = await erc20Factory.getAddress();
    const erc721FactoryAddress = await erc721Factory.getAddress();
    const erc20FactoryContractId = await getContractIdFromMirrorNode(erc20FactoryAddress);
    const erc721FactoryContractId = await getContractIdFromMirrorNode(erc721FactoryAddress);

    console.log(`ERC20 factory contract id:  ${erc20FactoryContractId}`);
    console.log(`ERC721 factory contract id: ${erc721FactoryContractId}`);
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
