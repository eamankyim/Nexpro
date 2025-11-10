const path = require('path');
const fs = require('fs');
const multer = require('multer');

const baseUploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', 'uploads');

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const createUploader = (subDirResolver) => {
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

module.exports = {
  upload,
  baseUploadDir,
  ensureDirExists,
  createUploader
};




