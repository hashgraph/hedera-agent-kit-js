/**
 * Vitest Setup File for UsdToHbarService
 *
 * This file runs once per test worker before any tests execute.
 * Unlike globalSetup, setupFiles run in the same context as tests,
 * allowing the initialized service state to be shared.
 *
 * This ensures the HBAR rate is available for all tests.
 */

import { beforeAll } from 'vitest';
import { UsdToHbarService } from '../usd-to-hbar-service';

// Initialize the service before any tests run
beforeAll(async () => {
  if (!UsdToHbarService.getIsInitialized()) {
    console.log('\nInitializing HBAR Price Service...');
    try {
      await UsdToHbarService.initialize();
      console.log(`✅ HBAR Rate: $${UsdToHbarService.getExchangeRate()?.toFixed(6)}/HBAR\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to initialize HBAR Service: ${message}`);
      throw error; // Fail fast if service can't be initialized
    }
  }
});
