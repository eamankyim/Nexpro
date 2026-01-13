# NEXPro - Sabito Integration Implementation Guide

## Overview

This guide outlines the steps required to integrate NEXPro with Sabito for customer synchronization and commission tracking. When a referral converts in Sabito, the customer data is synced to NEXPro. When an invoice is created in NEXPro for a Sabito-linked customer, a project is automatically created in Sabito and commission is calculated.

---

## 1. Database Migrations

### 1.1 Add Columns to `customers` Table

**Migration File:** `Backend/migrations/XXXXXX-add-sabito-customer-fields.js`

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('customers', 'sabito_customer_id', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'referralName'
    });

    await queryInterface.addColumn('customers', 'sabito_source_referral_id', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'sabito_customer_id'
    });

    await queryInterface.addColumn('customers', 'sabito_source_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'standalone',
      after: 'sabito_source_referral_id'
    });

    await queryInterface.addColumn('customers', 'sabito_business_id', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'sabito_source_type'
    });

    // Add indexes for faster lookups
    await queryInterface.addIndex('customers', ['sabito_customer_id'], {
      name: 'idx_customers_sabito_customer_id'
    });

    await queryInterface.addIndex('customers', ['sabito_source_referral_id'], {
      name: 'idx_customers_sabito_referral_id'
    });

    await queryInterface.addIndex('customers', ['sabito_business_id'], {
      name: 'idx_customers_sabito_business_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('customers', 'idx_customers_sabito_business_id');
    await queryInterface.removeIndex('customers', 'idx_customers_sabito_referral_id');
    await queryInterface.removeIndex('customers', 'idx_customers_sabito_customer_id');
    
    await queryInterface.removeColumn('customers', 'sabito_business_id');
    await queryInterface.removeColumn('customers', 'sabito_source_type');
    await queryInterface.removeColumn('customers', 'sabito_source_referral_id');
    await queryInterface.removeColumn('customers', 'sabito_customer_id');
  }
};
```

### 1.2 Add Columns to `invoices` Table

**Migration File:** `Backend/migrations/XXXXXX-add-sabito-invoice-fields.js`

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('invoices', 'sabito_project_id', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'paidDate'
    });

    await queryInterface.addColumn('invoices', 'sabito_synced_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'sabito_project_id'
    });

    await queryInterface.addColumn('invoices', 'sabito_sync_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'pending',
      after: 'sabito_synced_at'
    });

    await queryInterface.addColumn('invoices', 'sabito_sync_error', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'sabito_sync_status'
    });

    // Add indexes
    await queryInterface.addIndex('invoices', ['sabito_project_id'], {
      name: 'idx_invoices_sabito_project_id'
    });

    await queryInterface.addIndex('invoices', ['sabito_sync_status'], {
      name: 'idx_invoices_sabito_sync_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('invoices', 'idx_invoices_sabito_sync_status');
    await queryInterface.removeIndex('invoices', 'idx_invoices_sabito_project_id');
    
    await queryInterface.removeColumn('invoices', 'sabito_sync_error');
    await queryInterface.removeColumn('invoices', 'sabito_sync_status');
    await queryInterface.removeColumn('invoices', 'sabito_synced_at');
    await queryInterface.removeColumn('invoices', 'sabito_project_id');
  }
};
```

**Run Migrations:**
```bash
npx sequelize-cli db:migrate
```

---

## 2. Update Models

### 2.1 Update Customer Model

**File:** `Backend/models/Customer.js`

Add these fields to the model definition:

```javascript
sabito_customer_id: {
  type: DataTypes.STRING,
  allowNull: true,
  field: 'sabito_customer_id'
},
sabito_source_referral_id: {
  type: DataTypes.STRING,
  allowNull: true,
  field: 'sabito_source_referral_id'
},
sabito_source_type: {
  type: DataTypes.STRING(50),
  allowNull: true,
  defaultValue: 'standalone',
  field: 'sabito_source_type'
  // Values: 'referral', 'direct', 'standalone'
},
sabito_business_id: {
  type: DataTypes.STRING,
  allowNull: true,
  field: 'sabito_business_id'
}
```

### 2.2 Update Invoice Model

**File:** `Backend/models/Invoice.js`

Add these fields to the model definition:

```javascript
sabito_project_id: {
  type: DataTypes.STRING,
  allowNull: true,
  field: 'sabito_project_id'
},
sabito_synced_at: {
  type: DataTypes.DATE,
  allowNull: true,
  field: 'sabito_synced_at'
},
sabito_sync_status: {
  type: DataTypes.STRING(50),
  allowNull: true,
  defaultValue: 'pending',
  field: 'sabito_sync_status'
  // Values: 'pending', 'synced', 'failed', 'skipped'
},
sabito_sync_error: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'sabito_sync_error'
}
```

---

## 3. Create Webhook Authentication Middleware

**File:** `Backend/middleware/webhookAuth.js` (new file)

```javascript
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
```

---

## 4. Create Webhook Controller

**File:** `Backend/controllers/webhookController.js` (new file)

```javascript
const { Customer } = require('../models');
const { verifySabitoWebhook } = require('../middleware/webhookAuth');

/**
 * Handle customer webhook from Sabito
 * POST /api/webhooks/sabito/customer
 */
exports.handleSabitoCustomerWebhook = async (req, res) => {
  try {
    // 1. Verify webhook signature
    const isValid = verifySabitoWebhook(req);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature or API key'
      });
    }

    const { event, data } = req.body;

    // Validate event type
    if (event !== 'customer.created') {
      return res.status(400).json({
        success: false,
        message: `Unsupported event type: ${event}`
      });
    }

    // Extract data
    const {
      sabitoCustomerId,
      sourceReferralId,
      sourceType,
      businessId,
      customer: customerData
    } = data;

    // Validate required fields
    if (!sabitoCustomerId || !customerData || !customerData.email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sabitoCustomerId, customer.email'
      });
    }

    // 2. Get tenantId from header (required for multi-tenant)
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required in x-tenant-id header'
      });
    }

    // 3. Check if customer already exists (by email + tenantId)
    const existingCustomer = await Customer.findOne({
      where: {
        email: customerData.email,
        tenantId: tenantId
      }
    });

    if (existingCustomer) {
      // Update existing customer with Sabito IDs
      await existingCustomer.update({
        sabito_customer_id: sabitoCustomerId,
        sabito_source_referral_id: sourceReferralId || null,
        sabito_source_type: sourceType || 'referral',
        sabito_business_id: businessId || null,
        howDidYouHear: existingCustomer.howDidYouHear || 'Sabito Referral',
        referralName: sourceReferralId ? 'From Sabito' : existingCustomer.referralName
      });

      return res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: {
          customerId: existingCustomer.id,
          sabitoCustomerId: sabitoCustomerId
        }
      });
    }

    // 4. Create new customer
    const newCustomer = await Customer.create({
      tenantId: tenantId,
      name: customerData.name || 'Unknown',
      email: customerData.email,
      phone: customerData.phone || null,
      address: customerData.address || null,
      city: customerData.city || null,
      state: customerData.state || null,
      country: customerData.country || 'USA',
      sabito_customer_id: sabitoCustomerId,
      sabito_source_referral_id: sourceReferralId || null,
      sabito_source_type: sourceType || 'referral',
      sabito_business_id: businessId || null,
      howDidYouHear: 'Sabito Referral',
      referralName: sourceReferralId ? 'From Sabito' : null
    });

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        customerId: newCustomer.id,
        sabitoCustomerId: sabitoCustomerId
      }
    });

  } catch (error) {
    console.error('Sabito webhook error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
```

---

## 5. Create Sabito Webhook Service

**File:** `Backend/services/sabitoWebhookService.js` (new file)

```javascript
const axios = require('axios');

class SabitoWebhookService {
  constructor() {
    this.baseUrl = process.env.SABITO_API_URL || 'https://api.sabito.com';
    this.apiKey = process.env.SABITO_API_KEY;
  }

  /**
   * Send invoice webhook to Sabito
   * @param {Object} invoice - Invoice instance
   * @param {Object} customer - Customer instance (with Sabito fields)
   * @param {String} tenantId - Tenant ID
   * @returns {Promise<Object>} - Response from Sabito
   */
  async sendInvoiceWebhook(invoice, customer, tenantId) {
    // Only send if customer has Sabito ID
    if (!customer.sabito_customer_id) {
      return {
        skipped: true,
        reason: 'Customer not linked to Sabito'
      };
    }

    if (!this.apiKey) {
      console.warn('SABITO_API_KEY not configured, skipping webhook');
      return {
        skipped: true,
        reason: 'Sabito API key not configured'
      };
    }

    try {
      const payload = {
        event: 'invoice.created',
        app: 'nexpro',
        businessId: customer.sabito_business_id,
        timestamp: new Date().toISOString(),
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerId: customer.sabito_customer_id,
          customerEmail: customer.email,
          customerName: customer.name,
          customerPhone: customer.phone,
          amount: parseFloat(invoice.totalAmount),
          currency: 'GHS', // TODO: Get from tenant settings
          status: invoice.status,
          paidAt: invoice.paidDate ? invoice.paidDate.toISOString() : null,
          createdAt: invoice.createdAt.toISOString(),
          items: invoice.items || []
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/api/integrations/webhooks/invoice-created`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            'x-tenant-id': tenantId
          },
          timeout: 10000 // 10 second timeout
        }
      );

      return {
        success: true,
        projectId: response.data.projectId,
        commission: response.data.commission
      };

    } catch (error) {
      console.error('Sabito webhook error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send invoice paid webhook to Sabito
   * @param {Object} invoice - Invoice instance
   * @param {Object} customer - Customer instance
   * @param {String} tenantId - Tenant ID
   * @returns {Promise<Object>}
   */
  async sendInvoicePaidWebhook(invoice, customer, tenantId) {
    if (!customer.sabito_customer_id) {
      return { skipped: true };
    }

    if (!this.apiKey) {
      return { skipped: true, reason: 'API key not configured' };
    }

    try {
      const payload = {
        event: 'invoice.updated',
        app: 'nexpro',
        businessId: customer.sabito_business_id,
        timestamp: new Date().toISOString(),
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerId: customer.sabito_customer_id,
          status: 'paid',
          paidAt: invoice.paidDate.toISOString(),
          amount: parseFloat(invoice.totalAmount)
        }
      };

      await axios.post(
        `${this.baseUrl}/api/integrations/webhooks/invoice-created`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            'x-tenant-id': tenantId
          },
          timeout: 10000
        }
      );

      return { success: true };

    } catch (error) {
      console.error('Sabito paid webhook error:', error);
      throw error;
    }
  }
}

module.exports = new SabitoWebhookService();
```

---

## 6. Update Invoice Controller

**File:** `Backend/controllers/invoiceController.js`

### 6.1 Update `createInvoice` function

Add webhook sending after invoice creation:

```javascript
const sabitoWebhookService = require('../services/sabitoWebhookService');
const { Customer } = require('../models');

// In your createInvoice function, after invoice is successfully created:
exports.createInvoice = async (req, res) => {
  try {
    // ... existing invoice creation code ...
    
    // After invoice is created:
    const invoice = await Invoice.create({...});

    // Send webhook to Sabito (async, don't block response)
    try {
      const customer = await Customer.findByPk(invoice.customerId, {
        attributes: [
          'id', 
          'sabito_customer_id', 
          'sabito_business_id', 
          'email', 
          'name', 
          'phone'
        ]
      });

      sabitoWebhookService.sendInvoiceWebhook(invoice, customer, req.tenantId)
        .then(async (result) => {
          if (result.success) {
            // Update invoice with Sabito project ID
            await invoice.update({
              sabito_project_id: result.projectId,
              sabito_synced_at: new Date(),
              sabito_sync_status: 'synced'
            });
          } else if (result.skipped) {
            await invoice.update({
              sabito_sync_status: 'skipped'
            });
          }
        })
        .catch(async (error) => {
          console.error('Failed to send Sabito webhook:', error);
          await invoice.update({
            sabito_sync_status: 'failed',
            sabito_sync_error: error.message
          });
        });
    } catch (error) {
      // Don't fail invoice creation if webhook fails
      console.error('Error sending Sabito webhook:', error);
    }

    // Return response
    return res.status(201).json({
      success: true,
      data: invoice
    });

  } catch (error) {
    // ... error handling ...
  }
};
```

### 6.2 Update `recordPayment` function

Add webhook when invoice is fully paid:

```javascript
// In your recordPayment function, after payment is recorded:
exports.recordPayment = async (req, res) => {
  try {
    // ... existing payment recording code ...
    
    // After payment is recorded and invoice status updates:
    if (invoice.status === 'paid') {
      try {
        const customer = await Customer.findByPk(invoice.customerId, {
          attributes: [
            'id', 
            'sabito_customer_id', 
            'sabito_business_id', 
            'email', 
            'name', 
            'phone'
          ]
        });

        // Send paid webhook (async)
        sabitoWebhookService.sendInvoicePaidWebhook(invoice, customer, req.tenantId)
          .then(async (result) => {
            if (result.success) {
              await invoice.update({
                sabito_synced_at: new Date()
              });
            }
          })
          .catch((error) => {
            console.error('Failed to send Sabito paid webhook:', error);
          });
      } catch (error) {
        console.error('Error sending Sabito paid webhook:', error);
      }
    }

    // Return response
    return res.status(200).json({
      success: true,
      data: invoice
    });

  } catch (error) {
    // ... error handling ...
  }
};
```

### 6.3 Update Auto-Generated Invoice Logic

**File:** `Backend/controllers/jobController.js` (or wherever invoices are auto-generated)

When a job status changes to `'completed'` and invoice is auto-generated, add the same webhook logic as above.

---

## 7. Create Webhook Routes

**File:** `Backend/routes/webhookRoutes.js` (new file)

```javascript
const express = require('express');
const router = express.Router();
const { handleSabitoCustomerWebhook } = require('../controllers/webhookController');

// Sabito webhook endpoint (no auth middleware - uses API key authentication)
router.post('/sabito/customer', handleSabitoCustomerWebhook);

module.exports = router;
```

**Update:** `Backend/server.js`

Add webhook routes (before auth middleware, as webhooks use API key auth):

```javascript
// Add webhook routes (before auth middleware)
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// ... rest of routes with auth middleware ...
```

---

## 8. Environment Variables

**File:** `Backend/.env`

Add these environment variables:

```env
# Sabito Integration
SABITO_API_URL=https://api.sabito.com
SABITO_API_KEY=<provided_during_app_installation>
```

**Note:** The `SABITO_API_KEY` will be provided by Sabito when the app is installed for a tenant.

---

## 9. Install Dependencies

If not already installed, add axios for HTTP requests:

```bash
npm install axios
```

---

## 10. Testing Checklist

### 10.1 Test Customer Webhook (Receive from Sabito)

1. **Setup:**
   - Set `SABITO_API_KEY` in environment
   - Start server

2. **Test Request:**
```bash
curl -X POST http://localhost:5000/api/webhooks/sabito/customer \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_sabito_api_key" \
  -H "x-tenant-id: your_tenant_id" \
  -d '{
    "event": "customer.created",
    "data": {
      "sabitoCustomerId": "cust-123",
      "sourceReferralId": "ref-456",
      "sourceType": "referral",
      "businessId": "biz-789",
      "customer": {
        "email": "test@example.com",
        "name": "Test Customer",
        "phone": "+1234567890",
        "address": "123 Test St"
      }
    }
  }'
```

3. **Expected Result:**
   - Customer created/updated in database
   - `sabito_customer_id` stored
   - Returns success response

### 10.2 Test Invoice Webhook (Send to Sabito)

1. **Setup:**
   - Create a customer with `sabito_customer_id`
   - Set `SABITO_API_URL` and `SABITO_API_KEY`

2. **Test:**
   - Create an invoice for the Sabito-linked customer
   - Check console logs for webhook attempt
   - Check `sabito_sync_status` on invoice

3. **Expected Result:**
   - Webhook sent to Sabito
   - `sabito_project_id` stored on invoice
   - `sabito_sync_status` = 'synced'

### 10.3 Test Invoice Paid Webhook

1. **Setup:**
   - Invoice with `sabito_project_id` exists
   - Customer has `sabito_customer_id`

2. **Test:**
   - Record payment on invoice (mark as paid)
   - Check webhook sent

3. **Expected Result:**
   - Webhook sent to Sabito with paid status

---

## 11. Error Handling

### 11.1 Webhook Failures

- **Don't block invoice creation** if webhook fails
- Log errors to console
- Store error in `sabito_sync_error` field
- Set `sabito_sync_status` = 'failed'

### 11.2 Retry Mechanism (Optional)

Consider implementing a retry queue for failed webhooks:

```javascript
// Store failed webhooks in database table
// Retry with exponential backoff
// Max retries: 5
```

---

## 12. Production Considerations

1. **API Key Management:**
   - Store API keys per tenant (not global)
   - Use secure storage (encrypted)
   - Rotate keys periodically

2. **Webhook Security:**
   - Always verify API key
   - Verify HMAC signature if provided
   - Rate limit webhook endpoints

3. **Monitoring:**
   - Log all webhook attempts
   - Monitor success/failure rates
   - Alert on persistent failures

4. **Performance:**
   - Send webhooks asynchronously (don't block responses)
   - Use queue system for high volume
   - Implement timeout handling

---

## 13. Support & Troubleshooting

### Common Issues

1. **Webhook not received:**
   - Check `SABITO_API_KEY` is set
   - Verify API key matches Sabito's records
   - Check network connectivity

2. **Customer not syncing:**
   - Verify `x-tenant-id` header is sent
   - Check customer email format
   - Verify webhook endpoint is accessible

3. **Invoice not syncing:**
   - Check customer has `sabito_customer_id`
   - Verify `SABITO_API_URL` is correct
   - Check `sabito_sync_error` field for details

---

## 14. Summary

**What NEXPro Needs to Do:**

1. ✅ Add 8 database columns (4 to customers, 4 to invoices)
2. ✅ Create webhook receiver endpoint (`POST /api/webhooks/sabito/customer`)
3. ✅ Create webhook sender service (`sabitoWebhookService.js`)
4. ✅ Update invoice controller to send webhooks
5. ✅ Add environment variables
6. ✅ Test integration

**Files Created/Modified:**

- `Backend/migrations/XXXXXX-add-sabito-customer-fields.js` (new)
- `Backend/migrations/XXXXXX-add-sabito-invoice-fields.js` (new)
- `Backend/models/Customer.js` (modified)
- `Backend/models/Invoice.js` (modified)
- `Backend/middleware/webhookAuth.js` (new)
- `Backend/controllers/webhookController.js` (new)
- `Backend/services/sabitoWebhookService.js` (new)
- `Backend/routes/webhookRoutes.js` (new)
- `Backend/controllers/invoiceController.js` (modified)
- `Backend/server.js` (modified)
- `Backend/.env` (modified)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-20  
**For:** NEXPro Development Team

