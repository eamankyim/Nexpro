const crypto = require('crypto');

/**
 * Verify Sabito webhook signature and API key
 * @param {Object} req - Express request object
 * @returns {Boolean} - True if valid, false otherwise
 */
exports.verifySabitoWebhook = (req) => {
  const apiKey = req.headers['x-api-key'];
  const signature = req.headers['x-sabito-signature'];
  
  // Get API key from environment
  // TODO: In production, fetch from tenant settings or database
  const expectedApiKey = process.env.SABITO_API_KEY;
  
  if (!expectedApiKey) {
    console.error('SABITO_API_KEY not configured');
    return false;
  }

  // Verify API key
  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('Invalid API key');
    return false;
  }

  // Verify HMAC signature if provided
  if (signature) {
    try {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', expectedApiKey)
        .update(payload)
        .digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  // If no signature, just verify API key
  return true;
};






