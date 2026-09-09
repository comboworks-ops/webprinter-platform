import { IS_TEST_DEPLOYMENT } from '@/lib/testDeployment';

export function landingDemoHref() {
  const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return local || IS_TEST_DEPLOYMENT ? '/shop?tenantId=00000000-0000-0000-0000-000000000000&design=1' : '/shop';
}
