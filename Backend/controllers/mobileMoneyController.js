const { Sale, Invoice, Payment, Tenant } = require('../models');
const mobileMoneyService = require('../services/mobileMoneyService');
const { getResolvedMtnConfigForTenant } = require('../services/tenantMomoCollectionService');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { sequelize } = require('../config/database');
const { emitNewSale } = require('../services/websocketService');

async function loadMtnRuntimeForTenant(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) return null;
  return getResolvedMtnConfigForTenant(tenant);
}

/**
 * Initiate mobile money payment for a sale
 * @route POST /api/mobile-money/pay
 */
exports.initiatePayment = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { 
      saleId, 
      invoiceId, 
      phoneNumber, 
      amount, 
      currency = 'GHS',
      provider,
      payerMessage 
    } = req.body;

    // Validate required fields
    if (!phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and amount are required'
      });
    }

    // Generate external reference
    const externalId = saleId || invoiceId || `PAY-${Date.now()}`;
    
    // Detect or use provided provider
    const detectedProvider = provider || mobileMoneyService.detectProvider(phoneNumber);
    
    if (detectedProvider === 'UNKNOWN') {
      return res.status(400).json({
        success: false,
        error: 'Unable to detect mobile money provider. Please specify provider (MTN or AIRTEL).'
      });
    }

    let mtnConfig;
    if (detectedProvider === 'MTN') {
      mtnConfig = await loadMtnRuntimeForTenant(tenantId);
      if (!mtnConfig) {
        return res.status(503).json({
          success: false,
          error: 'MTN MoMo Collection is not configured. Add API credentials in Settings → Payments or set server MTN env vars.'
        });
      }
    }

    const result = await mobileMoneyService.requestPayment({
      phoneNumber,
      amount: parseFloat(amount),
      currency,
      externalId,
      provider: detectedProvider,
      payerMessage: payerMessage || 'Payment for your purchase',
      mtnConfig
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        provider: result.provider
      });
    }

    // Store payment reference in metadata
    if (saleId) {
      await Sale.update(
        { 
          metadata: sequelize.fn('jsonb_set', 
            sequelize.fn('COALESCE', sequelize.col('metadata'), '{}'),
            '{mobileMoneyRef}',
            JSON.stringify({
              referenceId: result.referenceId,
              provider: result.provider,
              status: 'PENDING',
              initiatedAt: new Date().toISOString()
            })
          )
        },
        { where: { id: saleId, tenantId } }
      );
    }

    if (invoiceId) {
      await Invoice.update(
        {
          metadata: sequelize.fn('jsonb_set',
            sequelize.fn('COALESCE', sequelize.col('metadata'), '{}'),
            '{mobileMoneyRef}',
            JSON.stringify({
              referenceId: result.referenceId,
              provider: result.provider,
              status: 'PENDING',
              initiatedAt: new Date().toISOString()
            })
          )
        },
        { where: { id: invoiceId, tenantId } }
      );
    }

    res.json({
      success: true,
      data: {
        referenceId: result.referenceId,
        provider: result.provider,
        status: result.status,
        message: result.message,
        saleId,
        invoiceId
      }
    });
  } catch (error) {
    console.error('Error initiating mobile money payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate payment'
    });
  }
};

/**
 * Check payment status
 * @route GET /api/mobile-money/status/:referenceId
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { referenceId } = req.params;
    const { provider } = req.query;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider query parameter is required (MTN or AIRTEL)'
      });
    }

    const prov = provider.toUpperCase();
    let mtnConfig;
    if (prov === 'MTN') {
      mtnConfig = await loadMtnRuntimeForTenant(req.tenantId);
      if (!mtnConfig) {
        return res.status(503).json({
          success: false,
          error: 'MTN MoMo is not configured for this workspace'
        });
      }
    }

    const result = await mobileMoneyService.checkPaymentStatus(referenceId, prov, mtnConfig);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check payment status'
    });
  }
};

/**
 * Poll and update payment status for a sale
 * @route POST /api/mobile-money/poll/:saleId
 */
exports.pollSalePayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const tenantId = req.tenantId;
    const { saleId } = req.params;

    const sale = await Sale.findOne({
      where: { id: saleId, tenantId },
      transaction
    });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Sale not found'
      });
    }

    const mobileMoneyRef = sale.metadata?.mobileMoneyRef;
    
    if (!mobileMoneyRef?.referenceId || !mobileMoneyRef?.provider) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'No mobile money payment found for this sale'
      });
    }

    let mtnConfig;
    if (mobileMoneyRef.provider === 'MTN') {
      mtnConfig = await loadMtnRuntimeForTenant(tenantId);
      if (!mtnConfig) {
        await transaction.rollback();
        return res.status(503).json({
          success: false,
          error: 'MTN MoMo is not configured for this workspace'
        });
      }
    }

    const result = await mobileMoneyService.checkPaymentStatus(
      mobileMoneyRef.referenceId,
      mobileMoneyRef.provider,
      mtnConfig
    );

    // Update sale metadata with latest status
    const updatedMetadata = {
      ...sale.metadata,
      mobileMoneyRef: {
        ...mobileMoneyRef,
        status: result.status,
        lastChecked: new Date().toISOString(),
        financialTransactionId: result.financialTransactionId
      }
    };

    // If payment successful, update sale status
    if (result.status === 'SUCCESSFUL') {
      await sale.update({
        status: 'completed',
        paymentMethod: 'mobile_money',
        amountPaid: sale.total,
        metadata: updatedMetadata
      }, { transaction });

      // Emit real-time update
      try {
        emitNewSale(tenantId, sale);
      } catch (e) {
        console.error('WebSocket emit error:', e);
      }
    } else {
      await sale.update({
        metadata: updatedMetadata
      }, { transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        saleId,
        paymentStatus: result.status,
        saleStatus: result.status === 'SUCCESSFUL' ? 'completed' : sale.status,
        provider: mobileMoneyRef.provider,
        referenceId: mobileMoneyRef.referenceId
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error polling sale payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to poll payment status'
    });
  }
};

/**
 * Validate phone number for mobile money
 * @route GET /api/mobile-money/validate/:phoneNumber
 */
exports.validatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { provider } = req.query;

    const detectedProvider = provider || mobileMoneyService.detectProvider(phoneNumber);

    let mtnConfig;
    if (detectedProvider === 'MTN') {
      mtnConfig = await loadMtnRuntimeForTenant(req.tenantId);
    }

    const result = await mobileMoneyService.validateAccount(phoneNumber, detectedProvider, mtnConfig);

    res.json({
      success: true,
      data: {
        phoneNumber,
        provider: result.provider || detectedProvider,
        valid: result.valid,
        name: result.name
      }
    });
  } catch (error) {
    console.error('Error validating phone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate phone number'
    });
  }
};

/**
 * Detect provider from phone number
 * @route GET /api/mobile-money/detect-provider/:phoneNumber
 */
exports.detectProvider = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const provider = mobileMoneyService.detectProvider(phoneNumber);

    res.json({
      success: true,
      data: {
        phoneNumber,
        provider,
        supported: provider !== 'UNKNOWN'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to detect provider'
    });
  }
};

/**
 * Webhook handler for MTN MoMo callbacks
 * @route POST /api/webhooks/mtn-momo
 */
exports.mtnWebhook = async (req, res) => {
  try {
    console.log('[MTN Webhook] Received:', JSON.stringify(req.body, null, 2));
    
    const { referenceId, status, financialTransactionId, externalId } = req.body;

    // Find the sale or invoice with this reference
    const sale = await Sale.findOne({
      where: sequelize.literal(`metadata->>'mobileMoneyRef'->>'referenceId' = '${referenceId}'`)
    });

    if (sale && status === 'SUCCESSFUL') {
      await sale.update({
        status: 'completed',
        paymentMethod: 'mobile_money',
        amountPaid: sale.total,
        metadata: {
          ...sale.metadata,
          mobileMoneyRef: {
            ...sale.metadata.mobileMoneyRef,
            status: 'SUCCESSFUL',
            financialTransactionId,
            completedAt: new Date().toISOString()
          }
        }
      });

      // Emit real-time update
      try {
        emitNewSale(sale.tenantId, sale);
      } catch (e) {
        console.error('WebSocket emit error:', e);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[MTN Webhook] Error:', error);
    res.status(200).json({ success: true }); // Always return 200 to prevent retries
  }
};

/**
 * Webhook handler for Airtel Money callbacks
 * @route POST /api/webhooks/airtel-money
 */
exports.airtelWebhook = async (req, res) => {
  try {
    console.log('[Airtel Webhook] Received:', JSON.stringify(req.body, null, 2));
    
    const { transaction } = req.body;
    const referenceId = transaction?.id;
    const status = transaction?.status;

    if (referenceId && status === 'TS') { // TS = Transaction Successful
      const sale = await Sale.findOne({
        where: sequelize.literal(`metadata->>'mobileMoneyRef'->>'referenceId' = '${referenceId}'`)
      });

      if (sale) {
        await sale.update({
          status: 'completed',
          paymentMethod: 'mobile_money',
          amountPaid: sale.total,
          metadata: {
            ...sale.metadata,
            mobileMoneyRef: {
              ...sale.metadata.mobileMoneyRef,
              status: 'SUCCESSFUL',
              completedAt: new Date().toISOString()
            }
          }
        });

        try {
          emitNewSale(sale.tenantId, sale);
        } catch (e) {
          console.error('WebSocket emit error:', e);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Airtel Webhook] Error:', error);
    res.status(200).json({ success: true });
  }
};
