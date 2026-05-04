import { getProfile } from '../profile';

export default async function globalSetup(): Promise<void> {
  await getProfile().balance.init();
}
