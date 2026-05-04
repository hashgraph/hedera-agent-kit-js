import { getProfile } from '../profile';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const profile = getProfile();
  await profile.balance.init();
  // Returned function runs after all tests finish — closes the profile's internal
  // operator client so its gRPC sockets don't keep the Node event loop alive.
  return async () => {
    await profile.dispose();
  };
}
