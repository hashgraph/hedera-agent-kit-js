import { SaucerSwapV2QueryService } from './saucer-swap-v2-query-service.interface'
import { LedgerId } from '@hashgraph/sdk'
import { ethers } from 'ethers'
import QuoterV2Abi from '../abi/QuoterV2.json' assert { type: 'json' }
import ERC20Abi from '../abi/ERC20.json' assert { type: 'json' }
import { IHederaMirrornodeService } from 'hedera-agent-kit'
import { SaucerSwapV2ConfigService } from './saucer-swap-v2-config-service'

export class SaucerSwapV2QueryServiceImpl implements SaucerSwapV2QueryService {

    private readonly abiQuoterInterface: ethers.Interface
    private readonly abiERC20Interface: ethers.Interface
    private readonly quoterEvmAddress: string
    private readonly mirrorNodeService: IHederaMirrornodeService
    private readonly saucerSwapV2ConfigService: SaucerSwapV2ConfigService

    constructor(ledgerId: LedgerId, mirrorNodeService: IHederaMirrornodeService, saucerSwapV2ConfigService: SaucerSwapV2ConfigService) {
        this.mirrorNodeService = mirrorNodeService
        this.saucerSwapV2ConfigService = saucerSwapV2ConfigService
        this.abiQuoterInterface = new ethers.Interface(QuoterV2Abi)
        this.abiERC20Interface = new ethers.Interface(ERC20Abi)
        this.quoterEvmAddress = this.saucerSwapV2ConfigService.getQuoterAddress()
    }

    // get me the quote for swapping 1 0x0000000000000000000000000000000000163b5a to 0.0.731861
    async getSwapQuote(inputToken: string, outputToken: string, amountIn: number): Promise<number> {
        const poolFeesInHexFormat = this.saucerSwapV2ConfigService.getPoolFeesInHexFormat(inputToken, outputToken);
        const encodedData = this.abiQuoterInterface.encodeFunctionData(
            this.abiQuoterInterface.getFunction('quoteExactInputSingle')!,
            [{
                tokenIn: inputToken,
                tokenOut: outputToken,
                amountIn: amountIn,
                fee: poolFeesInHexFormat,
                sqrtPriceLimitX96: 0
            }]
        )

        const url = `${this.mirrorNodeService.getBaseUrl()}/contracts/call`
        const body = {
            data: encodedData,
            from: "0x0000000000000000000000000000000000000032",
            to: this.quoterEvmAddress,
            block: "latest",
            estimate: false,
            gas: 15000000,
            gasPrice: 100000000,
            value: 0,
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!response.ok) {
            throw new Error(`Mirror Node call failed with status ${response.status}`)
        }
        const json: any = await response.json()
        const decoded = this.abiQuoterInterface.decodeFunctionResult('quoteExactInputSingle', json.result) as any
        let amountOutBigInt: bigint
        if (Array.isArray(decoded)) {
            amountOutBigInt = BigInt(decoded[0])
        } else if (typeof decoded.amountOut !== 'undefined') {
            amountOutBigInt = BigInt(decoded.amountOut)
        } else {
            amountOutBigInt = BigInt(decoded[0])
        }

        return Number(amountOutBigInt);
    }

    async getDecimals(tokenEvmAddress: string): Promise<number> {
        const encodedData = this.abiERC20Interface.encodeFunctionData(
            this.abiERC20Interface.getFunction('decimals')!,
            []
        )

        const url = `${this.mirrorNodeService.getBaseUrl()}/contracts/call`
        const body = {
            data: encodedData,
            from: "0x0000000000000000000000000000000000000032",
            to: tokenEvmAddress,
            block: "latest",
            estimate: false,
            gas: 15000000,
            gasPrice: 100000000,
            value: 0,
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
        if (!response.ok) {
            throw new Error(`Mirror Node call failed with status ${response.status}`)
        }
        const json: any = await response.json()
        const decoded = this.abiERC20Interface.decodeFunctionResult('decimals', json.result) as any
        const decimals = decoded[0];
        return decimals
    }
}