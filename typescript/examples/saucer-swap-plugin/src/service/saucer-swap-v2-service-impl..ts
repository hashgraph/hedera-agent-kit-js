import { ethers } from "ethers";
import { SaucerSwapV2Service } from "./saucer-swap-v2-service.interface";
import { saucerSwapConfig } from "@/config";
import { IHederaMirrornodeService } from "hedera-agent-kit";
import QuoterV2Abi from '../abi/QuoterV2.json' assert { type: 'json' }
import ERC20Abi from '../abi/ERC20.json' assert { type: 'json' }
import SwapRouterAbi from '../abi/SwapRouter.json' assert { type: 'json' }
import { SaucerSwapV2QueryService } from "./saucer-swap-v2-query-service.interface";
import { Transaction, LedgerId, ContractId, TokenId } from "@hashgraph/sdk";
import { SaucerSwapV2ConfigService } from "./saucer-swap-v2-config-service";
import { buildEncodedPath } from "@/utils/swap-path";
import { hexToUint8Array } from "./utils";
import { ContractExecuteTransaction, Hbar, HbarUnit, Client } from "@hashgraph/sdk";

export class SaucerSwapV2ServiceImpl implements SaucerSwapV2Service {

    private readonly abiQuoterInterface: ethers.Interface
    private readonly abiERC20Interface: ethers.Interface
    private readonly abiSwapRouterInterface: ethers.Interface
    private readonly swapRouterContractId: ContractId
    private readonly saucerSwapV2QueryService: SaucerSwapV2QueryService;
    private readonly saucerSwapV2ConfigService: SaucerSwapV2ConfigService;
    private readonly mirrornodeService: IHederaMirrornodeService;
    private readonly wrappedHBarEvmAddress: string;
    constructor(ledgerId: LedgerId, saucerSwapV2QueryService: SaucerSwapV2QueryService, saucerSwapV2ConfigService: SaucerSwapV2ConfigService, mirrornodeService: IHederaMirrornodeService) {
        this.saucerSwapV2QueryService = saucerSwapV2QueryService
        this.saucerSwapV2ConfigService = saucerSwapV2ConfigService
        this.abiQuoterInterface = new ethers.Interface(QuoterV2Abi)
        this.abiERC20Interface = new ethers.Interface(ERC20Abi)
        this.abiSwapRouterInterface = new ethers.Interface(SwapRouterAbi)
        this.swapRouterContractId = saucerSwapV2ConfigService.getSwapRouterContractId()
        this.mirrornodeService = mirrornodeService
        this.wrappedHBarEvmAddress = saucerSwapV2ConfigService.getWrappedHBarEvmAddress()
    }

    async exactInput(inputToken: string, outputToken: string, amountIn: number, recipientAddress: string): Promise<Transaction> {
        const poolFeesInHexFormat = this.saucerSwapV2ConfigService.getPoolFeesInHexFormat(inputToken, outputToken);
        const routeDataWithFee = buildEncodedPath(inputToken, poolFeesInHexFormat, outputToken);
        //ExactInputParams
        const params = {
            path: routeDataWithFee, //'0x...'
            recipient: recipientAddress, //'0x...' - user's recipient address
            deadline: 60, //Unix seconds
            amountIn: amountIn, //in Tinybar
            amountOutMinimum: 0//in token's smallest unit
        };
        
        //encode each function individually
        const swapEncoded = this.abiSwapRouterInterface.encodeFunctionData('exactInput', [params]);
        const refundHBAREncoded = this.abiSwapRouterInterface.encodeFunctionData('refundETH');
        
        //multi-call parameter: bytes[]
        const multiCallParam = [swapEncoded, refundHBAREncoded];
        
        //get encoded data for the multicall involving both functions
        const encodedData = this.abiSwapRouterInterface.encodeFunctionData('multicall', [multiCallParam]);  
        
        //get encoded data as Uint8Array
        const encodedDataAsUint8Array = hexToUint8Array(encodedData);   


        const transaction = await new ContractExecuteTransaction()
        .setContractId(this.swapRouterContractId)
        .setGas(15000000)
        .setFunctionParameters(encodedDataAsUint8Array)
        
        if(inputToken === this.wrappedHBarEvmAddress) {
            transaction.setPayableAmount(Hbar.from(amountIn, HbarUnit.Tinybar))
        }

        return transaction;
    }

}
