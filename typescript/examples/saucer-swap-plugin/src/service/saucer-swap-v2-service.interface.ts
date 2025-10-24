import { Transaction } from "@hashgraph/sdk"

export interface SaucerSwapV2Service {
    exactInput(inputToken: string, outputToken: string, amountIn: number, recipientAddress: string): Promise<Transaction>

}