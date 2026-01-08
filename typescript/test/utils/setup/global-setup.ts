import { UsdToHbarService } from '../usd-to-hbar-service';

export default async function globalSetup(): Promise<void> {
  console.log('\nInitializing HBAR Price Service (Pre-Test)...');
  try {
    await UsdToHbarService.initialize();
    console.log(`✅ HBAR Rate set to: $${UsdToHbarService.getExchangeRate()?.toFixed(6)}/HBAR`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to initialize HBAR Service: ${message}`);
    // Don't throw - let tests run with potential failures if service unavailable
  }
}
