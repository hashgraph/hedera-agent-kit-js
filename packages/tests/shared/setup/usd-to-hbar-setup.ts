/**
 * Vitest Setup File for UsdToHbarService
 *
 * Runs once per test worker before any tests execute.
 * Checks process.env for cached rate from globalSetup first,
 * falls back to network fetch if not available.
 */

import { beforeAll } from 'vitest';
import { UsdToHbarService } from '../usd-to-hbar-service';

beforeAll(async () => {
  if (UsdToHbarService.getIsInitialized()) {
    return;
  };

  const cachedRate = process.env.HBAR_EXCHANGE_RATE;
  if (cachedRate) {
    UsdToHbarService.setExchangeRate(Number(cachedRate));
    return;
  }

  try {
    await UsdToHbarService.initialize();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to initialize HBAR Service: ${message}`);
    throw error;
  }
});
