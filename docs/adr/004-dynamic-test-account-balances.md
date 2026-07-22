# **ADR 0004: Dynamic USD-to-HBAR Test Account Funding**

**Date:** 2025-12-12 (amended 2026-05-04 - funding now exposed via TestProfile)  
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

### **2.1 USD-to-HBAR Conversion via TestProfile**

**Decision:** ✅ **Expose USD-denominated funding through `TestProfile.balance`**

**Implementation:** `packages/tests/shared/profile/`

The active `TestProfile` (selected from `HEDERA_NETWORK`) owns the conversion strategy:

- **Testnet**: fetches the live HBAR/USD rate from the Hedera Mirror Node at session start, caches it.
- **Solo**: uses a fixed `$0.12/HBAR` constant matching Solo's genesis exchange-rate file. No mirror call.

Both profiles expose the same interface:
- `profile.balance.fund(tier)` - HBAR amount for a named tier (the common path)
- `profile.balance.usdToHbar(usd)` - arbitrary USD → HBAR conversion (escape hatch)

**Usage Pattern:**

```typescript
import { getProfile } from '@hashgraph/hedera-agent-kit-tests';

const profile = getProfile();

// Tier-based funding (preferred)
const executor = await profile.accounts.acquire({ tier: 'STANDARD' });

// Or arbitrary USD when a specific dollar amount matters
const account = await operatorWrapper.createAccount({
  key: executor.privateKey.publicKey,
  initialBalance: profile.balance.usdToHbar(0.10),  // $0.10 worth of HBAR
});
```

The previous `UsdToHbarService` and free-floating `BALANCE_TIERS` constant have been removed; tests no longer construct the conversion themselves.

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

### **2.3 Balance Tiers for Test Accounts**

**Decision:** ✅ **Four standardized USD funding tiers, applied via the active TestProfile**

**Implementation:** `packages/tests/shared/profile/{solo,testnet}-profile.ts`

To ensure consistent and predictable test account funding across the test suite, four balance tiers are defined. Each profile multiplies the USD value by a profile-specific factor before converting to HBAR:

| Tier       | Testnet USD | Solo USD (×10) | Use Case                                                       |
|------------|-------------|-----------------|----------------------------------------------------------------|
| `MINIMAL`  | $0.50       | $5              | Basic operations (single transfer, simple query)               |
| `STANDARD` | $5.00       | $50             | Most common test scenarios (token operations, multiple transfers) |
| `ELEVATED` | $10.00      | $100            | Complex operations (NFT minting, multiple token operations)    |
| `MAXIMUM`  | $20.00      | $200            | Heavy operations (contract deployments, extensive token operations) |

The Solo multiplier is intentional: Solo's operator has 1M HBAR and there is no real cost, so we fund sub-accounts more generously to give tests headroom across many local runs without redeploying Solo.

**Usage Pattern:**

```typescript
import { getProfile } from '@hashgraph/hedera-agent-kit-tests';

const profile = getProfile();

// Tier names are passed as string literals; the profile internally maps to USD,
// converts to HBAR via the cached rate, and creates the account.
const minimal  = await profile.accounts.acquire({ tier: 'MINIMAL' });
const standard = await profile.accounts.acquire({ tier: 'STANDARD' });   // default if omitted
const elevated = await profile.accounts.acquire({ tier: 'ELEVATED' });
const maximum  = await profile.accounts.acquire({ tier: 'MAXIMUM' });
```

The tier abstraction subsumes the previous two-step pattern of importing `BALANCE_TIERS` constants and feeding them through `UsdToHbarService.usdToHbar(...)`. Tests express intent (`'STANDARD'`) rather than mechanism (USD → HBAR conversion).

**Tier Selection Guidelines:**

- **MINIMAL ($0.50)**: Use for tests that perform only 1-2 simple operations (e.g., balance query, single HBAR transfer)
- **STANDARD ($5.00)**: Default tier for most tests; covers token creation, minting, and moderate operation counts
- **ELEVATED ($10.00)**: Use for tests with multiple token operations, NFT series minting, or complex workflows
- **MAXIMUM ($20.00)**: Reserve for contract deployments, EVM operations, or tests with many sequential transactions

---

## **3. Implementation Details**

### **3.1 Profile Initialization**

The active profile's `balance.init()` is called once per test session via Vitest's `globalSetup` hook, then again per worker via a `setupFiles` hook (idempotent):

**File:** `packages/tests/shared/setup/global-setup.ts`

```typescript
import { getProfile } from '../profile';

export default async function globalSetup(): Promise<void> {
  await getProfile().balance.init();
}
```

The profile resolves itself lazily from `HEDERA_NETWORK` and persists for the session. After `init()`, all `balance.fund()` and `balance.usdToHbar()` calls are synchronous.

### **3.2 Exchange Rate Source**

The testnet profile fetches the exchange rate from the Hedera Mirror Node at session start:

```typescript
const mirrornode = new HederaMirrornodeServiceDefaultImpl(LedgerId.TESTNET);
const resp = await mirrornode.getExchangeRate();
const r = resp.current_rate;
return r.cent_equivalent / r.hbar_equivalent / 100;  // USD per HBAR
```

The Solo profile uses a fixed `$0.12/HBAR` constant matching Solo's genesis exchange-rate file - no mirror call, no live rate dependency on the local network.

### **3.3 Conversion Method**

Each profile holds a private `exchangeRate: number | null` set during `init()`. The conversion method asserts initialization, divides, and rounds to 8 decimal places:

```typescript
const usdToHbar = (usd: number): number => {
  if (exchangeRate === null) {
    throw new Error('Profile balance not initialized - call profile.balance.init() first');
  }
  const hbar = usd / exchangeRate;
  return Math.round(hbar * 1e8) / 1e8;  // round to tinybars
};
```

### **3.4 Test File Pattern**

Tests acquire identities through the profile rather than constructing them by hand:

**Before:**

```typescript
const operatorClient = getOperatorClientForTests();
const operatorWrapper = new HederaOperationsWrapper(operatorClient);
const executorKey = PrivateKey.generateED25519();
const executorAccountId = await operatorWrapper
  .createAccount({
    key: executorKey.publicKey,
    initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
  })
  .then(resp => resp.accountId!);
const executorClient = getCustomClient(executorAccountId, executorKey);
const executorWrapper = new HederaOperationsWrapper(executorClient);
```

**After:**

```typescript
import { getProfile, type TestAccount } from '@hashgraph/hedera-agent-kit-tests';

const profile = getProfile();
const executor = await profile.accounts.acquire({ tier: 'STANDARD' });
const { client: executorClient, wrapper: executorWrapper } = profile.client.connectAs(executor);
```

Cleanup mirrors acquisition:

```typescript
afterAll(async () => {
  await profile.accounts.release(executor);
  executorClient.close();
});
```

On Solo `release()` is a no-op (the network is destroyed at session end); on testnet it deletes the account and returns HBAR to the operator, falling back to a manual transfer when the account holds tokens.

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

- `typescript/test/utils/OPERATION_FEES.md` - Hedera operation USD costs
- `packages/tests/shared/profile/index.ts` - TestProfile type
- `packages/tests/shared/profile/solo-profile.ts` - Solo adapter (fixed rate, ×10 tier multiplier)
- `packages/tests/shared/profile/testnet-profile.ts` - Testnet adapter (live rate)
- `packages/tests/shared/setup/global-setup.ts` - Vitest globalSetup that initializes the active profile
- [Hedera Pricing](https://hedera.com/fees) - Official Hedera fee schedule
