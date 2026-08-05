import { describe, it, expect } from 'vitest';
import {
  SCANNING_CONFIG_DEFAULTS,
  mergeScanningConfig,
  isScanningEnabled,
} from '../../utils/posScanningConfig';

describe('posScanningConfig', () => {
  it('defaults scanning to disabled (opt-in)', () => {
    expect(SCANNING_CONFIG_DEFAULTS.enabled).toBe(false);
    expect(SCANNING_CONFIG_DEFAULTS.allowManualBarcodeEntry).toBe(true);
    expect(SCANNING_CONFIG_DEFAULTS.allowExternalScanner).toBe(true);
  });

  it('mergeScanningConfig fills missing keys from defaults', () => {
    expect(mergeScanningConfig({ enabled: true })).toEqual({
      enabled: true,
      allowManualBarcodeEntry: true,
      allowExternalScanner: true,
    });
  });

  it('isScanningEnabled returns true only when enabled is true', () => {
    expect(isScanningEnabled({ scanning: { enabled: false } })).toBe(false);
    expect(isScanningEnabled({ scanning: { enabled: true } })).toBe(true);
    expect(isScanningEnabled({})).toBe(false);
    expect(isScanningEnabled()).toBe(false);
  });
});
