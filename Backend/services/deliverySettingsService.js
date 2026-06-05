const { Setting } = require('../models');

const SETTING_KEY = 'delivery_settings';

const DEFAULT_DELIVERY_SETTINGS = {
  enabled: false,
  requireSelectionAtCheckout: false,
  bands: []
};

const toFiniteNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeBoolean = (value) => value === true;

const normalizeBand = (band, index) => {
  const id = String(band?.id || '').trim() || `band_${index + 1}`;
  const label = String(band?.label || '').trim();
  const minKm = toFiniteNumber(band?.minKm);
  const maxKm = toFiniteNumber(band?.maxKm);
  const fee = toFiniteNumber(band?.fee);

  if (!label) {
    throw new Error('Each delivery band requires a label');
  }
  if (minKm === null || minKm < 0) {
    throw new Error('Each delivery band requires minKm >= 0');
  }
  if (maxKm === null || maxKm <= minKm) {
    throw new Error('Each delivery band requires maxKm greater than minKm');
  }
  if (fee === null || fee <= 0) {
    throw new Error('Each delivery band requires a positive fee');
  }

  return {
    id,
    label,
    minKm: Math.round(minKm * 100) / 100,
    maxKm: Math.round(maxKm * 100) / 100,
    fee: Math.round(fee * 100) / 100
  };
};

const assertNoOverlaps = (bands) => {
  const sorted = [...bands].sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);
  const ids = new Set();
  for (const band of sorted) {
    if (ids.has(band.id)) {
      throw new Error('Delivery band ids must be unique');
    }
    ids.add(band.id);
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].minKm < sorted[i - 1].maxKm) {
      throw new Error('Delivery bands cannot overlap');
    }
  }
};

const normalizeDeliverySettings = (value = {}) => {
  const bands = Array.isArray(value.bands)
    ? value.bands.map(normalizeBand)
    : [];
  assertNoOverlaps(bands);

  return {
    enabled: normalizeBoolean(value.enabled),
    requireSelectionAtCheckout: normalizeBoolean(value.requireSelectionAtCheckout),
    bands
  };
};

const getDeliverySettings = async (tenantId) => {
  const setting = await Setting.findOne({ where: { tenantId, key: SETTING_KEY } });
  if (!setting?.value) return DEFAULT_DELIVERY_SETTINGS;
  return normalizeDeliverySettings({
    ...DEFAULT_DELIVERY_SETTINGS,
    ...setting.value
  });
};

const saveDeliverySettings = async (tenantId, payload) => {
  const normalized = normalizeDeliverySettings(payload || {});
  const [setting] = await Setting.findOrCreate({
    where: { tenantId, key: SETTING_KEY },
    defaults: {
      tenantId,
      key: SETTING_KEY,
      value: normalized,
      description: 'Delivery fee band settings'
    }
  });
  setting.value = normalized;
  setting.description = setting.description || 'Delivery fee band settings';
  await setting.save();
  return normalized;
};

const resolveDeliveryForSale = async (tenantId, delivery = {}) => {
  const required = delivery?.required === true;
  if (!required) {
    return {
      required: false,
      fee: 0,
      bandId: null,
      snapshot: {
        required: false,
        fee: 0,
        bandId: null,
        label: null,
        minKm: null,
        maxKm: null
      }
    };
  }

  const settings = await getDeliverySettings(tenantId);
  if (!settings.enabled) {
    throw new Error('Delivery is not enabled for this workspace');
  }

  const bandId = String(delivery.bandId || '').trim();
  if (!bandId) {
    throw new Error('Delivery band is required');
  }

  const band = settings.bands.find((candidate) => candidate.id === bandId);
  if (!band) {
    throw new Error('Invalid delivery band');
  }

  const requestedFee = toFiniteNumber(delivery.fee);
  const fee = requestedFee === null ? band.fee : Math.round(requestedFee * 100) / 100;
  if (Math.round(fee * 100) !== Math.round(band.fee * 100)) {
    throw new Error('Delivery fee does not match selected band');
  }

  return {
    required: true,
    fee,
    bandId: band.id,
    snapshot: {
      required: true,
      fee,
      bandId: band.id,
      label: band.label,
      minKm: band.minKm,
      maxKm: band.maxKm
    }
  };
};

module.exports = {
  SETTING_KEY,
  DEFAULT_DELIVERY_SETTINGS,
  normalizeDeliverySettings,
  getDeliverySettings,
  saveDeliverySettings,
  resolveDeliveryForSale
};
