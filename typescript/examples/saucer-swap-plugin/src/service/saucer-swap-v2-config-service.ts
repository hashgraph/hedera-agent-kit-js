// write a config service to get the config from the config file
import { SaucerSwapConfig, saucerSwapConfig } from "../config";
import { ContractId, LedgerId, TokenId } from "@hashgraph/sdk";

export class SaucerSwapV2ConfigService {
    private readonly saucerSwapConfig: SaucerSwapConfig;
    private readonly ledgerId: LedgerId;

    constructor(ledgerId: LedgerId) {
        this.saucerSwapConfig = saucerSwapConfig;
        this.ledgerId = ledgerId;
    }

    //get router address
    getRouterAddress() {
        return this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.router ?? '';
    }

    getSwapRouterContractId() {
        return ContractId.fromEvmAddress(0, 0, this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.router ?? '');
    }

    getWrappedHBARTokenId() {
        return TokenId.fromEvmAddress(0, 0, this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.wrappedHBAR ?? '');
    }

    getWrappedHBarEvmAddress() {
        return this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.wrappedHBAR ?? '';
    }

    // get pool fees, A & B can be swapped
    getPoolFeesInHexFormat(tokenA: string, tokenB: string) {
        const pool = this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.pools?.find(pool => (pool.tokenA === tokenA && pool.tokenB === tokenB) || (pool.tokenA === tokenB && pool.tokenB === tokenA));
        if (!pool) {
            throw new Error(`Pool not found for tokens ${tokenA} and ${tokenB}`);
        }
        // the 3000 in hex is 0x0BB8, so we need to multiply the feeTierBps by 10000 to get the hex format
        // so 3000 * 10000 = 30000000, in hex is 0x0BB8
        // so the feeTierBps is 3000, in hex is 0x0BB8
        // so the feeTierBps is 3000, in hex is 0x0BB8

        //curently when the pool.feeTierBps is 3000, the hex format is returned 0x1c9c380, it should be 0x0BB8 
        // Currently when the pool.feeTierBps is 3000, multiplying by 10000 gives 30000000 (0x1c9c380), but for Uniswap-style contracts the correct hex is just the fee in BPS (e.g., 3000 decimal = 0x0BB8 hex).
        // So we simply return the feeTierBps in hex, padded to always be 4 hex digits, with 0x prefix.
        return `0x${pool.feeTierBps.toString(16).padStart(6, '0')}`.toLowerCase();
    }

    //get quoter address
    getQuoterAddress() {
        return this.saucerSwapConfig.networks[this.ledgerId.toString() as keyof typeof this.saucerSwapConfig.networks]?.quoter ?? '';
    }
}