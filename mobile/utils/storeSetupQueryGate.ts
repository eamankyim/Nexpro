/**
 * Query keys that compete with Online Store setup and should stay quiet
 * while the wizard is focused (tabs remain mounted under the root stack).
 */
export function isStoreSetupBackgroundNoiseQuery(queryKey: readonly unknown[]): boolean {
  const root = String(queryKey[0] ?? '');
  if (
    root === 'orders'
    || root === 'dashboard'
    || root === 'notifications'
    || root === 'customers'
    || root === 'sales'
    || root === 'products'
    || root === 'expenses'
    || root === 'deliveries-queue'
    || root === 'leads'
    || root === 'quotes'
    || root === 'invoices'
    || root === 'jobs'
    || root === 'tasks'
    || root === 'shops'
    || root === 'studio-locations'
  ) {
    return true;
  }
  // Store operational queries — keep setup-status alone for the wizard.
  if (root === 'store' && queryKey[1] !== undefined && queryKey[1] !== 'setup-status') {
    return true;
  }
  return false;
}
