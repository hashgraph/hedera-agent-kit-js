# **ADR 0004: Dynamic USD-to-HBAR Test Account Funding**

**Date:** 2025-12-12  
**Status:** Accepted  
**Context:** TypeScript test suite for Hedera Agent Kit requires reliable test account funding that remains stable across HBAR price fluctuations.

---

## **1. Context and Problem**

### **The Problem**

Hedera network transaction fees are **fixed in USD**, not HBAR. When the price of HBAR fluctuates, the number of HBARs required to pay for the same transaction changes:

- **HBAR price increase**: Tests fail because hardcoded HBAR amounts are insufficient
- **HBAR price decrease**: Tests waste funds by over-allocating HBAR

Previously, test accounts were funded with hardcoded HBAR values (e.g., `initialBalance: 5`, `initialBalance: 50`), which led to:

1. **Test instability**: Tests failed during price volatility
2. **Manual maintenance**: Developers had to update funding amounts when prices changed
3. **Inconsistent coverage**: No systematic approach to calculating required amounts

### **Goal**

Implement a **dynamic funding system** that:

1. Converts USD amounts to HBAR at runtime using live exchange rates
2. Ensures tests have sufficient funds regardless of HBAR price
3. Provides predictable, documented funding amounts based on actual operation costs

---

## **2. Decision**

### **2.1 USD-to-HBAR Conversion Service**

**Decision:** ✅ **Implement `UsdToHbarService` for dynamic conversion**

**Implementation:** `typescript/test/utils/usd-to-hbar-service.ts`

The service:

- Fetches the current HBAR/USD exchange rate from the Hedera Mirror Node at test session start
- Provides a static `usdToHbar(usdAmount)` method for runtime conversion
- Caches the rate in a static property to avoid repeated API calls during test execution

**Usage Pattern:**

```typescript
import { UsdToHbarService } from '../utils/usd-to-hbar-service';

// Test account funding
const executorAccountId = await operatorWrapper
  .createAccount({
    key: executorKey.publicKey,
    initialBalance: UsdToHbarService.usdToHbar(1.00)  // $1.00 worth of HBAR
  })
  .then(resp => resp.accountId!);
```

---

### **2.2 Operation Fees Reference**

**Decision:** ✅ **Document all Hedera operation costs in USD**

**Implementation:** `typescript/test/utils/OPERATION_FEES.md`

A centralized reference document listing USD costs for all Hedera operations used by the Hedera Agent Kit SDK (state for 12.12.2025):

| Service   | Operation            | USD Cost |
|-----------|----------------------|----------|
| Crypto    | CryptoCreate         | $0.05    |
| Crypto    | CryptoTransfer       | $0.0001  |
| Token     | TokenCreate          | $1.00    |
| Token     | TokenMint (NFT)      | $0.02    |
| Consensus | ConsensusCreateTopic | $0.01    |
| Contract  | ContractCreate       | $1.00    |

---

## **3. Implementation Details**

### **3.1 Service Initialization**

The `UsdToHbarService` is initialized once per test session via Vitest's `globalSetup` hook:

**File:** `typescript/test/utils/setup/usd-to-hbar-setup.ts`

```typescript
import { UsdToHbarService } from '../usd-to-hbar-service';

export async function setup() {
  await UsdToHbarService.initialize();
}
```

**Vitest Configuration:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globalSetup: ['./test/utils/setup/usd-to-hbar-setup.ts'],
    // ...
  }
});
```

### **3.2 Exchange Rate Source**

The service fetches the exchange rate from the Hedera Mirror Node:

```typescript
private static async fetchLiveHbarPrice(): Promise<number> {
  const mirrornode = new HederaMirrornodeServiceDefaultImpl(LedgerId.TESTNET);
  const resp = await mirrornode.getExchangeRate();
  const currentRate = resp.current_rate;
  // cent_equivalent / hbar_equivalent gives cents per HBAR
  // Divide by 100 to get USD per HBAR
  return currentRate.cent_equivalent / currentRate.hbar_equivalent / 100;
}
```

### **3.3 Conversion Method**

```typescript
static usdToHbar(usdAmount: number): number {
  if (!this.isInitialized || this.exchangeRate === null) {
    throw new Error('UsdToHbarService is not initialized!');
  }
  const hbarAmount = usdAmount / this.exchangeRate;
  return Math.round(hbarAmount * 1e8) / 1e8; // Round to 8 decimal places (tinybars)
}
```

### **3.4 Test File Updates**

All integration test files were updated to use the service:

**Before:**

```typescript
const executorAccountId = await operatorWrapper
  .createAccount({
    initialBalance: 5,  // hardcoded HBAR
    key: executorKeyPair.publicKey,
  })
  .then(resp => resp.accountId!);
```

**After:**

```typescript
import { UsdToHbarService } from '../../utils/usd-to-hbar-service';

const executorAccountId = await operatorWrapper
  .createAccount({
    initialBalance: UsdToHbarService.usdToHbar(1.00),  // $1.00 worth of HBAR
    key: executorKeyPair.publicKey,
  })
  .then(resp => resp.accountId!);
```

---

## **4. Consequences**

### **Positive**

- ✅ **Test stability**: Tests no longer fail due to HBAR price fluctuations
- ✅ **Self-documenting**: USD amounts clearly indicate operation costs
- ✅ **Maintainability**: Adding new tests follows a clear funding pattern
- ✅ **Cost efficiency**: Funding is right-sized, not over-allocated

### **Negative**

- ⚠️ **Network dependency**: Tests require Mirror Node access at startup
- ⚠️ **Session-scoped rate**: Rate is fixed for the session; long sessions during volatility may have stale rates

### **Mitigations**

- Mirror Node is highly available and rate fetch is resilient
- Test sessions are typically short enough (< 1h) to avoid stale rates

---

## **5. References**

- [OPERATION_FEES.md](file:///typescript/test/utils/OPERATION_FEES.md) — Hedera operation USD costs
- [usd-to-hbar-service.ts](file:///typescript/test/utils/usd-to-hbar-service.ts) — Conversion service implementation
- [usd-to-hbar-setup.ts](file:///typescript/test/utils/setup/usd-to-hbar-setup.ts) — Vitest global setup hook
- [Hedera Pricing](https://hedera.com/fees) — Official Hedera fee schedule
