import { useQuery } from '@tanstack/react-query';
import { settingsService } from '@/services/settings';
import { isScanningEnabled, mergeScanningConfig } from '@/utils/posScanningConfig';
import { QUERY_STALE } from '@/utils/queryInvalidation';

/**
 * Whether barcode/camera scanning is enabled for the workspace (opt-in).
 */
export function useScanningEnabled() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'pos-config'],
    queryFn: () => settingsService.getPOSConfig(),
    staleTime: QUERY_STALE.LIST,
  });

  const posConfig = data ?? null;
  const scanning = mergeScanningConfig(posConfig?.scanning as Record<string, unknown> | undefined);

  return {
    scanningEnabled: isScanningEnabled(posConfig),
    allowManualBarcodeEntry: scanning.allowManualBarcodeEntry,
    isLoading,
  };
}
