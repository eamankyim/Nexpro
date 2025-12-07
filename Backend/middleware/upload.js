const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { validateStorageLimit } = require('../utils/storageLimitHelper');

const baseUploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', 'uploads');

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createUploader = (subDirResolver) => {
  // Check if we're in a serverless environment (Vercel, etc.)
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  // In serverless environments, use memory storage
  // Files will need to be uploaded to cloud storage (S3, Cloudinary, etc.)
  if (isServerless) {
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10) * 1024 * 1024
      }
    });
  }

  // In regular Node.js environments, use disk storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const subPath =
        typeof subDirResolver === 'function'
          ? subDirResolver(req, file)
          : subDirResolver || '';
      const uploadPath = path.join(baseUploadDir, subPath);
      ensureDirExists(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, `${timestamp}-${sanitizedOriginal}`);
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '20', 10) * 1024 * 1024
    }
  });
};

const upload = createUploader((req) => path.join('jobs', req.params.id || 'general'));

/**
 * Middleware to check storage limits before upload
 * Use this BEFORE multer middleware
 */
const checkStorageLimit = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];

    // Skip for platform admins
    if (req.user?.isPlatformAdmin) {
      return next();
    }

    if (!tenantId) {
      return next(); // Let it proceed, will fail at tenant check
    }

    // Get file size from headers (if available)
    const contentLength = parseInt(req.headers['content-length'], 10);
    
    if (!contentLength || isNaN(contentLength)) {
      // Can't check without file size, proceed and check after upload
      return next();
    }

    // Validate storage limit
    const validation = await validateStorageLimit(tenantId, contentLength, false);
    
    if (!validation.valid) {
      return res.status(413).json({
        success: false,
        message: validation.error.message,
        code: 'STORAGE_LIMIT_EXCEEDED',
        details: validation.error.details,
        upgradeRequired: true
      });
    }

    // Attach storage info to request
    req.storageUsage = validation.usage;
    next();
  } catch (error) {
    console.error('Storage limit check failed:', error);
    next(error);
  }
};

module.exports = {
  upload,
  baseUploadDir,
  ensureDirExists,
  createUploader,
  checkStorageLimit
};





