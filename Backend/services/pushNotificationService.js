const axios = require('axios');
const { StorefrontCustomer, User } = require('../models');
const {
  mergeNotificationPreferences,
  isNotificationChannelEnabled,
  normalizeNotificationCategory
} = require('./notificationPreferenceHelper');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;
const MAX_STORED_PUSH_DEVICES = 20;
const logPrefix = '[PushNotifications]';

const isExpoPushToken = (token) =>
  typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);

const getStoredPushDevices = (preferences) => {
  const devices = Array.isArray(preferences?.pushDevices) ? preferences.pushDevices : [];
  return devices.filter((device) => device && typeof device.token === 'string');
};

const shouldUseDeviceForTenant = (device, tenantId) =>
  !tenantId || !device.tenantId || device.tenantId === tenantId;

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const toExpoPriority = (priority) => (priority === 'high' ? 'high' : 'default');

const buildExpoMessage = ({ token, title, message, data = {}, priority = 'normal' }) => ({
  to: token,
  sound: 'default',
  title,
  body: message || '',
  priority: toExpoPriority(priority),
  data
});

async function removeInvalidUserPushTokens(invalidTokensByUserId) {
  const entries = Array.from(invalidTokensByUserId.entries()).filter(([, tokens]) => tokens.size > 0);
  if (entries.length === 0) return;

  await Promise.all(entries.map(async ([userId, invalidTokens]) => {
    const user = await User.scope(null).findByPk(userId, {
      attributes: ['id', 'notificationPreferences']
    });
    if (!user) return;

    const preferences = user.notificationPreferences && typeof user.notificationPreferences === 'object'
      ? { ...user.notificationPreferences }
      : {};
    const nextDevices = getStoredPushDevices(preferences)
      .filter((device) => !invalidTokens.has(device.token))
      .slice(0, MAX_STORED_PUSH_DEVICES);

    if (nextDevices.length !== getStoredPushDevices(preferences).length) {
      await user.update({
        notificationPreferences: {
          ...preferences,
          pushDevices: nextDevices
        }
      });
    }
  }));
}

const getStorefrontCustomerMetadata = (customer) => (
  customer?.metadata && typeof customer.metadata === 'object' && !Array.isArray(customer.metadata)
    ? { ...customer.metadata }
    : {}
);

const getStorefrontNotificationPreferences = (customer) => {
  const metadata = getStorefrontCustomerMetadata(customer);
  return metadata.notificationPreferences && typeof metadata.notificationPreferences === 'object'
    ? metadata.notificationPreferences
    : {};
};

const isStorefrontOrderUpdatesEnabled = (customer) => (
  getStorefrontNotificationPreferences(customer).orderUpdates !== false
);

async function removeInvalidStorefrontCustomerPushTokens(invalidTokensByCustomerId) {
  const entries = Array.from(invalidTokensByCustomerId.entries()).filter(([, tokens]) => tokens.size > 0);
  if (entries.length === 0) return;

  await Promise.all(entries.map(async ([customerId, invalidTokens]) => {
    const customer = await StorefrontCustomer.findByPk(customerId, {
      attributes: ['id', 'metadata']
    });
    if (!customer) return;

    const metadata = getStorefrontCustomerMetadata(customer);
    const nextDevices = getStoredPushDevices(metadata)
      .filter((device) => !invalidTokens.has(device.token))
      .slice(0, MAX_STORED_PUSH_DEVICES);

    if (nextDevices.length !== getStoredPushDevices(metadata).length) {
      await customer.update({
        metadata: {
          ...metadata,
          pushDevices: nextDevices
        }
      });
    }
  }));
}

async function getPushTargetsForUsers({ userIds, tenantId, category }) {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (uniqueUserIds.length === 0) return [];

  const users = await User.scope(null).findAll({
    where: { id: uniqueUserIds },
    attributes: ['id', 'notificationPreferences']
  });

  const seenTokens = new Set();
  const targets = [];
  for (const user of users) {
    const preferences = mergeNotificationPreferences(user.notificationPreferences);
    const gatedCategory = normalizeNotificationCategory(category);
    if (
      gatedCategory &&
      !isNotificationChannelEnabled(preferences, gatedCategory, 'push')
    ) {
      continue;
    }

    for (const device of getStoredPushDevices(user.notificationPreferences)) {
      if (!shouldUseDeviceForTenant(device, tenantId) || !isExpoPushToken(device.token)) {
        continue;
      }
      if (seenTokens.has(device.token)) {
        continue;
      }
      seenTokens.add(device.token);
      targets.push({ userId: user.id, token: device.token });
    }
  }

  return targets;
}

async function getPushTargetsForStorefrontCustomers({ storefrontCustomerIds }) {
  const uniqueCustomerIds = [...new Set((storefrontCustomerIds || []).filter(Boolean))];
  if (uniqueCustomerIds.length === 0) return [];

  const customers = await StorefrontCustomer.findAll({
    where: { id: uniqueCustomerIds },
    attributes: ['id', 'metadata']
  });

  const seenTokens = new Set();
  const targets = [];
  for (const customer of customers) {
    if (!isStorefrontOrderUpdatesEnabled(customer)) {
      continue;
    }

    const metadata = getStorefrontCustomerMetadata(customer);
    for (const device of getStoredPushDevices(metadata)) {
      if (!isExpoPushToken(device.token)) {
        continue;
      }
      if (seenTokens.has(device.token)) {
        continue;
      }
      seenTokens.add(device.token);
      targets.push({ ownerId: customer.id, token: device.token });
    }
  }

  return targets;
}

async function dispatchExpoPushToTargets({
  targets,
  tenantId,
  title,
  message,
  type = 'info',
  priority = 'normal',
  metadata = {},
  link = null,
  removeInvalidTokens
}) {
  if (!title || !Array.isArray(targets) || targets.length === 0) {
    return { sent: 0, attempted: 0, invalidTokens: 0 };
  }

  const invalidTokensByOwnerId = new Map();
  let sent = 0;

  for (const targetChunk of chunk(targets, EXPO_PUSH_CHUNK_SIZE)) {
    const messages = targetChunk.map((target) => buildExpoMessage({
      token: target.token,
      title,
      message,
      priority,
      data: {
        type,
        tenantId,
        link,
        metadata
      }
    }));

    try {
      const response = await axios.post(EXPO_PUSH_URL, messages, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      const receipts = Array.isArray(response.data?.data) ? response.data.data : [];
      receipts.forEach((receipt, index) => {
        const target = targetChunk[index];
        if (!target) return;
        if (receipt?.status === 'ok') {
          sent += 1;
          return;
        }
        if (receipt?.details?.error === 'DeviceNotRegistered') {
          const tokens = invalidTokensByOwnerId.get(target.ownerId) || new Set();
          tokens.add(target.token);
          invalidTokensByOwnerId.set(target.ownerId, tokens);
        }
      });
    } catch (error) {
      console.error(`${logPrefix} Expo push request failed`, {
        attempted: targetChunk.length,
        error: error.message
      });
    }
  }

  await removeInvalidTokens(invalidTokensByOwnerId);

  return {
    sent,
    attempted: targets.length,
    invalidTokens: Array.from(invalidTokensByOwnerId.values()).reduce(
      (total, tokens) => total + tokens.size,
      0
    )
  };
}

async function dispatchExpoPushToUsers({
  tenantId,
  userIds,
  title,
  message,
  type = 'info',
  priority = 'normal',
  metadata = {},
  link = null
}) {
  if (!title || !Array.isArray(userIds) || userIds.length === 0) {
    return { sent: 0, attempted: 0, invalidTokens: 0 };
  }

  const targets = (await getPushTargetsForUsers({ userIds, tenantId, category: type }))
    .map((target) => ({ ownerId: target.userId, token: target.token }));
  return dispatchExpoPushToTargets({
    targets,
    tenantId,
    title,
    message,
    type,
    priority,
    metadata,
    link,
    removeInvalidTokens: removeInvalidUserPushTokens
  });
}

async function dispatchExpoPushToStorefrontCustomers({
  tenantId,
  storefrontCustomerIds,
  title,
  message,
  type = 'order_update',
  priority = 'normal',
  metadata = {},
  link = null
}) {
  if (!title || !Array.isArray(storefrontCustomerIds) || storefrontCustomerIds.length === 0) {
    return { sent: 0, attempted: 0, invalidTokens: 0 };
  }

  const targets = await getPushTargetsForStorefrontCustomers({ storefrontCustomerIds });
  return dispatchExpoPushToTargets({
    targets,
    tenantId,
    title,
    message,
    type,
    priority,
    metadata,
    link,
    removeInvalidTokens: removeInvalidStorefrontCustomerPushTokens
  });
}

module.exports = {
  dispatchExpoPushToUsers,
  dispatchExpoPushToStorefrontCustomers,
  getPushTargetsForStorefrontCustomers,
  getPushTargetsForUsers,
  isExpoPushToken
};
