const { Tenant, SubscriptionPlan } = require('../models');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath) {
  let totalSize = 0;

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else if (item.isFile()) {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
  }

  return totalSize;
}

/**
 * Get current storage usage for a tenant in MB
 */
async function getTenantStorageUsage(tenantId) {
  const uploadsDir = path.join(__dirname, '../uploads');
  
  // Calculate storage for different upload types
  const directories = [
    `jobs/${tenantId}`,
    `employees/${tenantId}`,
    `settings/${tenantId}`,
    // Add other tenant-specific upload directories
  ];

  let totalBytes = 0;

  for (const dir of directories) {
    const dirPath = path.join(uploadsDir, dir);
    try {
      const size = await getDirectorySize(dirPath);
      totalBytes += size;
    } catch (error) {
      // Directory might not exist yet, skip
    }
  }

  // Convert bytes to MB
  const totalMB = Math.ceil(totalBytes / (1024 * 1024));
  
  return {
    bytes: totalBytes,
    megabytes: totalMB,
    gigabytes: (totalBytes / (1024 * 1024 * 1024)).toFixed(2)
  };
}

/**
 * Get storage limit for a tenant based on their plan
 */
async function getTenantStorageLimit(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  
  if (!tenant) {
    throw new Error('Tenant not found');
  }

  // First try to get from database
  const plan = await SubscriptionPlan.findOne({
    where: { planId: tenant.plan, isActive: true }
  });

  if (plan) {
    return {
      limitMB: plan.storageLimitMB,
      price100GB: plan.storagePrice100GB,
      planName: plan.name,
      source: 'database'
    };
  }

  // Fallback to default limits
  const DEFAULT_LIMITS = {
    trial: { limitMB: 1024, price100GB: null },      // 1 GB
    launch: { limitMB: 10240, price100GB: 15 },      // 10 GB
    scale: { limitMB: 51200, price100GB: 12 },       // 50 GB
    enterprise: { limitMB: null, price100GB: null }  // Unlimited
  };

  const limit = DEFAULT_LIMITS[tenant.plan] || DEFAULT_LIMITS.trial;

  return {
    limitMB: limit.limitMB,
    price100GB: limit.price100GB,
    planName: tenant.plan,
    source: 'config'
  };
}

/**
 * Check if tenant can upload more files
 */
async function canUploadFile(tenantId, fileSizeBytes) {
  const [usage, limitInfo] = await Promise.all([
    getTenantStorageUsage(tenantId),
    getTenantStorageLimit(tenantId)
  ]);

  // null limit = unlimited
  if (limitInfo.limitMB === null) {
    return {
      allowed: true,
      unlimited: true,
      currentMB: usage.megabytes,
      limitMB: null,
      afterUploadMB: usage.megabytes + Math.ceil(fileSizeBytes / (1024 * 1024))
    };
  }

  const fileSizeMB = Math.ceil(fileSizeBytes / (1024 * 1024));
  const afterUploadMB = usage.megabytes + fileSizeMB;
  const remainingMB = limitInfo.limitMB - usage.megabytes;
  const allowed = afterUploadMB <= limitInfo.limitMB;

  return {
    allowed,
    unlimited: false,
    currentMB: usage.megabytes,
    limitMB: limitInfo.limitMB,
    remainingMB,
    afterUploadMB,
    fileSizeMB,
    planName: limitInfo.planName,
    price100GB: limitInfo.price100GB
  };
}

/**
 * Get storage usage summary for a tenant
 */
async function getStorageUsageSummary(tenantId) {
  const [usage, limitInfo] = await Promise.all([
    getTenantStorageUsage(tenantId),
    getTenantStorageLimit(tenantId)
  ]);

  const isUnlimited = limitInfo.limitMB === null;
  const currentMB = usage.megabytes;
  const currentGB = parseFloat(usage.gigabytes);
  const limitGB = isUnlimited ? null : (limitInfo.limitMB / 1024).toFixed(1);
  const remainingMB = isUnlimited ? null : limitInfo.limitMB - currentMB;
  const remainingGB = isUnlimited ? null : (remainingMB / 1024).toFixed(2);
  const percentageUsed = isUnlimited ? 0 : Math.round((currentMB / limitInfo.limitMB) * 100);
  const isNearLimit = !isUnlimited && percentageUsed >= 80;
  const isAtLimit = !isUnlimited && percentageUsed >= 95;

  return {
    currentMB,
    currentGB,
    limitMB: limitInfo.limitMB,
    limitGB,
    remainingMB,
    remainingGB,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canUploadMore: isUnlimited || remainingMB > 0,
    planName: limitInfo.planName,
    price100GB: limitInfo.price100GB
  };
}

/**
 * Validate storage limit before upload
 */
async function validateStorageLimit(tenantId, fileSizeBytes, throwError = true) {
  const canUpload = await canUploadFile(tenantId, fileSizeBytes);

  if (!canUpload.allowed) {
    const fileSizeMB = Math.ceil(fileSizeBytes / (1024 * 1024));
    const error = new Error(
      `Storage limit exceeded. Your ${canUpload.planName} plan allows ${canUpload.limitMB}MB (${(canUpload.limitMB / 1024).toFixed(1)}GB). ` +
      `You're currently using ${canUpload.currentMB}MB (${(canUpload.currentMB / 1024).toFixed(2)}GB). ` +
      `This ${fileSizeMB}MB upload would exceed your limit. ` +
      (canUpload.price100GB 
        ? `Add more storage for GHS ${canUpload.price100GB} per 100GB or upgrade your plan.`
        : 'Please upgrade your plan for more storage.')
    );
    error.code = 'STORAGE_LIMIT_EXCEEDED';
    error.statusCode = 413; // Payload Too Large
    error.details = canUpload;
    
    if (throwError) {
      throw error;
    }
    return { valid: false, error };
  }

  return { valid: true, usage: canUpload };
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
  getTenantStorageUsage,
  getTenantStorageLimit,
  canUploadFile,
  getStorageUsageSummary,
  validateStorageLimit,
  formatBytes
};

