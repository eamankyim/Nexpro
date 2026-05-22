const fs = require('fs');

/**
 * Convert multer file to data URL for DB storage (matches organization logo pattern).
 * @param {Express.Multer.File} file
 * @returns {Promise<string>}
 */
const fileToDataUrl = async (file) => {
  const mimeType = file.mimetype || 'image/png';
  if (file.buffer) {
    return `data:${mimeType};base64,${file.buffer.toString('base64')}`;
  }
  if (file.path && fs.existsSync(file.path)) {
    const fileBuffer = fs.readFileSync(file.path);
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    return dataUrl;
  }
  const err = new Error('Unable to process uploaded file');
  err.statusCode = 400;
  throw err;
};

module.exports = { fileToDataUrl };
