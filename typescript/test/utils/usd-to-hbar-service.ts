/**
 * USD to HBAR Conversion Service
 *
 * This service provides USD to HBAR conversion for testing purposes.
 * Hedera transaction costs are FIXED in USD, meaning when the HBAR price changes,
 * the amount of HBAR required to pay for transactions also changes.
 *
 * By converting fixed USD amounts to HBAR at runtime, tests remain stable
 * regardless of HBAR price fluctuations.
 *
 * @see OPERATION_FEES.md for Hedera operation costs in USD
 */

import { LedgerId } from '@hashgraph/sdk';
import { HederaMirrornodeServiceDefaultImpl } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service-default-impl';

export class UsdToHbarService {
    private static exchangeRate: number | null = null;
    private static isInitialized = false;

    /**
     * Initialize the service by fetching the current HBAR/USD exchange rate.
     * Should be called once at test session start via vitest globalSetup.
     */
    static async initialize(): Promise<void> {
        this.exchangeRate = await this.fetchLiveHbarPrice();
        this.isInitialized = true;
    }

    /**
     * Convert USD amount to HBAR using the cached exchange rate.
     * @param usdAmount - Amount in USD to convert
     * @returns Equivalent amount in HBAR, rounded to 8 decimal places
     * @throws Error if service is not initialized
     */
    static usdToHbar(usdAmount: number): number {
        if (!this.isInitialized || this.exchangeRate === null) {
            throw new Error(
                'UsdToHbarService is not initialized! Ensure globalSetup runs before this call.',
            );
        }

        const hbarAmount = usdAmount / this.exchangeRate;
        return Math.round(hbarAmount * 1e8) / 1e8; // Round to 8 decimal places (tinybars)
    }

    /**
     * Get the current exchange rate (USD per HBAR).
     * @returns The cached exchange rate or null if not initialized
     */
    static getExchangeRate(): number | null {
        return this.exchangeRate;
    }

    /**
     * Check if the service has been initialized.
     */
    static getIsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Fetch the current HBAR price in USD from the Hedera Mirror Node.
     * @returns HBAR price in USD
     */
    private static async fetchLiveHbarPrice(): Promise<number> {
        try {
            const mirrornode = new HederaMirrornodeServiceDefaultImpl(LedgerId.TESTNET);
            const resp = await mirrornode.getExchangeRate();
            const currentRate = resp.current_rate;

            // cent_equivalent / hbar_equivalent gives cents per HBAR
            // Divide by 100 to get USD per HBAR
            return currentRate.cent_equivalent / currentRate.hbar_equivalent / 100;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Couldn't fetch current HBAR price from mirrornode: ${message}`);
        }
    }
}
