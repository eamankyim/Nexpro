const { Setting } = require('../models');
const {
  CHANNELS,
  MESSAGE_EVENTS_CATALOG,
  MESSAGE_EVENT_KEYS,
  getMessageEventDefinition,
  listMessageEventsCatalog,
} = require('../config/messageEventsCatalog');

const SETTING_KEY = 'message_delivery_rules';

const buildDefaultChannelsForEvent = (eventDef) => {
  const channels = {};
  for (const channel of CHANNELS) {
    if (!eventDef.allowedChannels.includes(channel)) {
      channels[channel] = false;
      continue;
    }
    const explicit = eventDef.defaultChannels?.[channel];
    channels[channel] = explicit !== false;
  }
  for (const required of eventDef.requiredChannels || []) {
    if (eventDef.allowedChannels.includes(required)) {
      channels[required] = true;
    }
  }
  return channels;
};

/**
 * Merge stored tenant overrides with catalog defaults; required channels stay on.
 * @param {object|null|undefined} storedValue - Raw settings.value
 * @returns {{ events: Record<string, { channels: Record<string, boolean> }> }}
 */
const mergeDeliveryRules = (storedValue) => {
  const storedEvents =
    storedValue && typeof storedValue === 'object' && storedValue.events && typeof storedValue.events === 'object'
      ? storedValue.events
      : {};

  const events = {};
  for (const eventKey of MESSAGE_EVENT_KEYS) {
    const def = MESSAGE_EVENTS_CATALOG[eventKey];
    const channels = buildDefaultChannelsForEvent(def);
    const tenantChannels = storedEvents[eventKey]?.channels;
    if (tenantChannels && typeof tenantChannels === 'object') {
      for (const channel of def.allowedChannels) {
        if (typeof tenantChannels[channel] === 'boolean') {
          channels[channel] = tenantChannels[channel];
        }
      }
    }
    for (const required of def.requiredChannels || []) {
      channels[required] = true;
    }
    events[eventKey] = { channels };
  }
  return { events };
};

const getStoredDeliveryRules = async (tenantId) => {
  if (!tenantId) return null;
  const row = await Setting.findOne({ where: { tenantId, key: SETTING_KEY } });
  return row?.value ?? null;
};

const getMergedDeliveryRules = async (tenantId) => {
  const stored = await getStoredDeliveryRules(tenantId);
  return mergeDeliveryRules(stored);
};

/**
 * Public API shape for settings UI.
 */
const getDeliveryRulesResponse = async (tenantId) => {
  const merged = await mergeDeliveryRules(await getStoredDeliveryRules(tenantId));
  const catalog = listMessageEventsCatalog();
  const events = {};
  for (const item of catalog) {
    const def = MESSAGE_EVENTS_CATALOG[item.key];
    const channels = merged.events[item.key]?.channels || buildDefaultChannelsForEvent(def);
    const locked = {};
    for (const channel of CHANNELS) {
      locked[channel] = (def.requiredChannels || []).includes(channel);
    }
    events[item.key] = { channels, locked };
  }
  return { catalog, events };
};

/**
 * Apply tenant PUT payload; validates keys and enforces required channels.
 * @param {string} tenantId
 * @param {{ events?: Record<string, { channels?: Record<string, boolean> }> }} payload
 */
const saveDeliveryRules = async (tenantId, payload) => {
  const incoming =
    payload?.events && typeof payload.events === 'object' ? payload.events : {};
  const existing = await getStoredDeliveryRules(tenantId);
  const mergedBase = mergeDeliveryRules(existing);
  const nextStored = { events: {} };

  for (const eventKey of MESSAGE_EVENT_KEYS) {
    const def = MESSAGE_EVENTS_CATALOG[eventKey];
    const channels = { ...mergedBase.events[eventKey].channels };
    const patch = incoming[eventKey]?.channels;
    if (patch && typeof patch === 'object') {
      for (const channel of def.allowedChannels) {
        if (typeof patch[channel] === 'boolean') {
          channels[channel] = patch[channel];
        }
      }
    }
    for (const required of def.requiredChannels || []) {
      channels[required] = true;
    }
    nextStored.events[eventKey] = { channels };
  }

  const [setting] = await Setting.findOrCreate({
    where: { tenantId, key: SETTING_KEY },
    defaults: {
      tenantId,
      key: SETTING_KEY,
      value: nextStored,
      description: 'Per-event message channel routing (email, SMS, WhatsApp)',
    },
  });
  if (setting) {
    setting.value = nextStored;
    setting.description = setting.description || 'Per-event message channel routing (email, SMS, WhatsApp)';
    await setting.save();
  }
  return mergeDeliveryRules(nextStored);
};

const logDeliveryRouting = (tenantId, eventKey, channel, meta = {}) => {
  console.log('[DeliveryRules]', {
    tenantId: tenantId || null,
    eventKey,
    channel,
    ...meta,
  });
};

/**
 * Whether a channel may be used for a system message event.
 * Missing tenant settings use catalog defaults (backward compatible).
 */
const isChannelEnabledForEvent = async (tenantId, eventKey, channel) => {
  const def = getMessageEventDefinition(eventKey);
  if (!def) {
    logDeliveryRouting(tenantId, eventKey, channel, {
      enabled: true,
      reason: 'unknown_event_default_allow',
    });
    return true;
  }
  if (!def.allowedChannels.includes(channel)) {
    logDeliveryRouting(tenantId, eventKey, channel, {
      enabled: false,
      reason: 'channel_not_allowed_for_event',
    });
    return false;
  }
  if (!tenantId) {
    const enabled = buildDefaultChannelsForEvent(def)[channel] === true;
    logDeliveryRouting(tenantId, eventKey, channel, {
      enabled,
      reason: 'no_tenant_use_catalog_default',
    });
    return enabled;
  }
  const merged = await getMergedDeliveryRules(tenantId);
  const enabled = merged.events[eventKey]?.channels?.[channel] === true;
  logDeliveryRouting(tenantId, eventKey, channel, {
    enabled,
    reason: enabled ? 'tenant_rule_enabled' : 'tenant_rule_disabled',
  });
  return enabled;
};

module.exports = {
  SETTING_KEY,
  CHANNELS,
  buildDefaultChannelsForEvent,
  mergeDeliveryRules,
  getStoredDeliveryRules,
  getMergedDeliveryRules,
  getDeliveryRulesResponse,
  saveDeliveryRules,
  isChannelEnabledForEvent,
  logDeliveryRouting,
};
