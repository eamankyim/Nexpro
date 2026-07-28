import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { OnlineStoreWelcome } from '@/components/store/OnlineStoreWelcome';
import { useAuth } from '@/context/AuthContext';
import { setupStepHref } from '@/utils/storeSetupFlow';

/**
 * Dedicated Online Store welcome (deep link / stack entry).
 * Create Store → confirm store name.
 */
export default function StoreSetupWelcomeScreen() {
  const router = useRouter();
  const { hasFeature } = useAuth();

  const onCreateStore = useCallback(() => {
    router.push(setupStepHref('confirm-name') as never);
  }, [router]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  return (
    <OnlineStoreWelcome
      chrome="standalone"
      onCreateStore={onCreateStore}
    />
  );
}
