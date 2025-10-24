export interface SaucerSwapV2QueryService {
    getSwapQuote(inputToken: String, outputToken: String, amountIn: number): Promise<number>
    getDecimals(tokenEvmAddress: string): Promise<number>
}