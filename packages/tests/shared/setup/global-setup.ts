import { UsdToHbarService } from '../usd-to-hbar-service';

export default async function globalSetup(): Promise<void> {
  try {
    await UsdToHbarService.initialize();
    process.env.HBAR_EXCHANGE_RATE = String(UsdToHbarService.getExchangeRate());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to initialize HBAR Service: ${message}`);
  }
}
