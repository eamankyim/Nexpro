/**
 * Scan Log Routes
 * 
 * Optional endpoint for logging scanner events from frontend
 * Helps debug camera access issues
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

/**
 * @route   POST /api/scan-logs
 * @desc    Log scanner events for debugging
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
  try {
    const {
      event,
      timestamp,
      userAgent,
      url,
      error,
      errorName,
      errorMessage,
      errorString,
      cameraConfig,
      success,
      isPermissionError,
      isDeviceError,
      isInUseError,
      isConstraintError,
      hasMediaDevices,
      isSecureContext,
      protocol,
      hostname
    } = req.body;

    // Log to console with structured format
    console.log('[SCAN LOG] ========================================');
    console.log('[SCAN LOG] Event:', event);
    console.log('[SCAN LOG] Timestamp:', timestamp || new Date().toISOString());
    console.log('[SCAN LOG] User:', req.user?.email || req.user?.id);
    console.log('[SCAN LOG] Tenant:', req.tenantId || 'undefined');
    console.log('[SCAN LOG] User Agent:', userAgent);
    console.log('[SCAN LOG] URL:', url);
    console.log('[SCAN LOG] Success:', success);
    
    // Environment context
    console.log('[SCAN LOG] Environment:', {
      hasMediaDevices,
      isSecureContext,
      protocol,
      hostname
    });
    
    if (cameraConfig) {
      console.log('[SCAN LOG] Camera Config:', JSON.stringify(cameraConfig, null, 2));
    }
    
    // Error details
    if (error || errorName || errorMessage) {
      console.log('[SCAN LOG] Error Name:', errorName || 'undefined');
      console.log('[SCAN LOG] Error Message:', errorMessage || 'undefined');
      console.log('[SCAN LOG] Error String:', errorString || 'undefined');
      if (error && typeof error === 'object') {
        console.log('[SCAN LOG] Error Object:', JSON.stringify(error, null, 2));
      }
      console.log('[SCAN LOG] Error Categories:', {
        isPermissionError: isPermissionError || false,
        isDeviceError: isDeviceError || false,
        isInUseError: isInUseError || false,
        isConstraintError: isConstraintError || false
      });
    }
    
    console.log('[SCAN LOG] ========================================');

    res.status(200).json({
      success: true,
      message: 'Scan log recorded'
    });
  } catch (err) {
    console.error('[SCAN LOG] Error logging scan event:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to log scan event'
    });
  }
});

module.exports = router;
