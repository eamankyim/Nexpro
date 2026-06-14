const axios = require('axios');
const { User } = require('../models');
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

  const targets = await getPushTargetsForUsers({ userIds, tenantId, category: type });
  if (targets.length === 0) {
    return { sent: 0, attempted: 0, invalidTokens: 0 };
  }

  const invalidTokensByUserId = new Map();
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
          const tokens = invalidTokensByUserId.get(target.userId) || new Set();
          tokens.add(target.token);
          invalidTokensByUserId.set(target.userId, tokens);
        }
      });
    } catch (error) {
      console.error(`${logPrefix} Expo push request failed`, {
        attempted: targetChunk.length,
        error: error.message
      });
    }
  }

  await removeInvalidUserPushTokens(invalidTokensByUserId);

  return {
    sent,
    attempted: targets.length,
    invalidTokens: Array.from(invalidTokensByUserId.values()).reduce(
      (total, tokens) => total + tokens.size,
      0
    )
  };
}

module.exports = {
  dispatchExpoPushToUsers,
  getPushTargetsForUsers,
  isExpoPushToken
};
