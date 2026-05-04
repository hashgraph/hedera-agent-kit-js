/**
 * Vitest worker setup. Initializes the active TestProfile's balance subsystem
 * so tests can call `profile.balance.fund(tier)` / `usdToHbar(usd)` synchronously.
 * The profile reads the cached rate set by the session-level globalSetup.
 */

import { beforeAll } from 'vitest';
import { getProfile } from '../profile';

beforeAll(async () => {
  await getProfile().balance.init();
});
