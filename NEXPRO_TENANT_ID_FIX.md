# NEXPro Tenant ID Mapping Fix

## Problem

Sabito sends webhooks with a `businessId` (their internal business identifier), but NEXPro requires a `tenantId` (NEXPro's tenant identifier). Currently, Sabito is sending the `businessId` as the `X-Tenant-ID` header, which causes a foreign key constraint error because that ID doesn't exist in the NEXPro `tenants` table.

## Current Flow

```
Sabito Webhook → NEXPro API
Headers:
  X-Tenant-ID: <sabito-business-id>  ❌ This doesn't exist in NEXPro tenants table
  X-API-Key: <api-key>
Body:
  {
    "event": "customer.created",
    "data": {
      "businessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",  ← Sabito's business ID
      "businessName": "iCreations Global",
      "customer": { ... }
    }
  }
```

## Solution: Tenant ID Mapping

We need to create a mapping between Sabito `businessId` and NEXPro `tenantId`. There are two approaches:

---

## Approach 1: Database Mapping Table (Recommended)

Create a mapping table to store the relationship between Sabito business IDs and NEXPro tenant IDs.

### Step 1: Create Migration

Create a new migration file: `Backend/migrations/create-sabito-tenant-mapping.js`

```javascript
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const createSabitoTenantMapping = async () => {
  console.log('🔗 Creating Sabito tenant mapping table...');

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sabito_tenant_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sabito_business_id VARCHAR(255) NOT NULL UNIQUE,
        nexpro_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        business_name VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT sabito_business_id_unique UNIQUE (sabito_business_id)
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sabito_tenant_mappings_sabito_business_id_idx 
      ON sabito_tenant_mappings(sabito_business_id);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sabito_tenant_mappings_nexpro_tenant_id_idx 
      ON sabito_tenant_mappings(nexpro_tenant_id);
    `);

    console.log('✅ Sabito tenant mapping table created successfully');
  } catch (error) {
    console.error('❌ Error creating mapping table:', error);
    throw error;
  }
};

createSabitoTenantMapping()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

### Step 2: Create Sequelize Model

Create `Backend/models/SabitoTenantMapping.js`:

```javascript
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SabitoTenantMapping = sequelize.define('SabitoTenantMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sabitoBusinessId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'sabito_business_id'
  },
  nexproTenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'nexpro_tenant_id',
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'business_name'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'sabito_tenant_mappings',
  timestamps: true
});

module.exports = SabitoTenantMapping;
```

### Step 3: Register Model

Add to `Backend/models/index.js`:

```javascript
const SabitoTenantMapping = require('./SabitoTenantMapping');

// ... existing code ...

module.exports = {
  // ... existing exports ...
  SabitoTenantMapping
};
```

### Step 4: Update Webhook Controller

Update `Backend/controllers/webhookController.js`:

```javascript
const { Customer, Tenant, SabitoTenantMapping } = require('../models');
const { verifySabitoWebhook } = require('../middleware/webhookAuth');

exports.handleSabitoCustomerWebhook = async (req, res) => {
  try {
    console.log('[Sabito Webhook] Received request:', {
      method: req.method,
      path: req.path,
      headers: {
        'x-api-key': req.headers['x-api-key'] ? 'present' : 'missing',
        'x-tenant-id': req.headers['x-tenant-id'] || 'missing',
        'x-sabito-signature': req.headers['x-sabito-signature'] ? 'present' : 'missing'
      },
      body: req.body
    });

    // 1. Verify webhook signature
    const isValid = verifySabitoWebhook(req);
    if (!isValid) {
      console.error('[Sabito Webhook] Authentication failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature or API key'
      });
    }

    console.log('[Sabito Webhook] Authentication successful');

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
      businessId,  // Sabito's business ID
      businessName,
      customer: customerData
    } = data;

    // Validate required fields
    if (!sabitoCustomerId || !customerData || !customerData.email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sabitoCustomerId, customer.email'
      });
    }

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: businessId'
      });
    }

    // 2. Map Sabito business ID to NEXPro tenant ID
    console.log('[Sabito Webhook] Looking up tenant mapping for businessId:', businessId);
    
    const mapping = await SabitoTenantMapping.findOne({
      where: { sabitoBusinessId: businessId },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    if (!mapping) {
      console.error('[Sabito Webhook] No tenant mapping found for businessId:', businessId);
      return res.status(404).json({
        success: false,
        message: `No tenant mapping found for Sabito business ID: ${businessId}. Please create a mapping first.`,
        businessId: businessId,
        businessName: businessName
      });
    }

    const tenantId = mapping.nexproTenantId;
    const tenant = mapping.tenant;

    if (!tenant) {
      console.error('[Sabito Webhook] Tenant not found for mapped ID:', tenantId);
      return res.status(404).json({
        success: false,
        message: `Tenant not found: ${tenantId}`,
        tenantId: tenantId,
        businessId: businessId
      });
    }

    if (tenant.status !== 'active') {
      console.error('[Sabito Webhook] Tenant is not active:', tenantId, tenant.status);
      return res.status(403).json({
        success: false,
        message: `Tenant is not active: ${tenant.status}`,
        tenantId: tenantId
      });
    }

    console.log('[Sabito Webhook] Tenant mapped successfully:', {
      sabitoBusinessId: businessId,
      nexproTenantId: tenantId,
      tenantName: tenant.name
    });

    // 3. Check if customer already exists (by email + tenantId)
    const existingCustomer = await Customer.findOne({
      where: {
        email: customerData.email,
        tenantId: tenantId
      }
    });

    if (existingCustomer) {
      console.log('[Sabito Webhook] Updating existing customer:', existingCustomer.id);
      await existingCustomer.update({
        sabitoCustomerId: sabitoCustomerId,
        sabitoSourceReferralId: sourceReferralId || null,
        sabitoSourceType: sourceType || 'referral',
        sabitoBusinessId: businessId,
        howDidYouHear: existingCustomer.howDidYouHear || 'Sabito Referral',
        referralName: sourceReferralId ? 'From Sabito' : existingCustomer.referralName
      });

      console.log('[Sabito Webhook] Customer updated successfully:', existingCustomer.id);
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
    console.log('[Sabito Webhook] Creating new customer with data:', {
      tenantId,
      name: customerData.name || 'Unknown',
      email: customerData.email,
      sabitoCustomerId
    });

    const newCustomer = await Customer.create({
      tenantId: tenantId,
      name: customerData.name || 'Unknown',
      email: customerData.email,
      phone: customerData.phone || null,
      address: customerData.address || null,
      city: customerData.city || null,
      state: customerData.state || null,
      country: customerData.country || 'USA',
      sabitoCustomerId: sabitoCustomerId,
      sabitoSourceReferralId: sourceReferralId || null,
      sabitoSourceType: sourceType || 'referral',
      sabitoBusinessId: businessId,
      howDidYouHear: 'Sabito Referral',
      referralName: sourceReferralId ? 'From Sabito' : null,
      isActive: true
    });

    console.log('[Sabito Webhook] Customer created successfully:', newCustomer.id);
    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        customerId: newCustomer.id,
        sabitoCustomerId: sabitoCustomerId
      }
    });

  } catch (error) {
    console.error('[Sabito Webhook] Error processing webhook:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
```

### Step 5: Add Model Relationships

Update `Backend/models/index.js` to include relationships:

```javascript
// Add to relationships section
SabitoTenantMapping.belongsTo(Tenant, { 
  foreignKey: 'nexproTenantId', 
  as: 'tenant' 
});

Tenant.hasMany(SabitoTenantMapping, { 
  foreignKey: 'nexproTenantId', 
  as: 'sabitoMappings' 
});
```

---

## Approach 2: API Endpoint to Create Mapping

Create an endpoint to register/map Sabito business IDs to NEXPro tenant IDs.

### Create Controller

Create `Backend/controllers/sabitoMappingController.js`:

```javascript
const { SabitoTenantMapping, Tenant } = require('../models');
const { protect, tenantContext } = require('../middleware/auth');

/**
 * Create or update Sabito business ID to NEXPro tenant ID mapping
 * POST /api/sabito/mappings
 * Headers: Authorization: Bearer <token>, X-Tenant-ID: <tenant-id>
 */
exports.createMapping = async (req, res, next) => {
  try {
    const { sabitoBusinessId, businessName } = req.body;
    const nexproTenantId = req.tenantId; // From tenant context middleware

    if (!sabitoBusinessId) {
      return res.status(400).json({
        success: false,
        message: 'sabitoBusinessId is required'
      });
    }

    // Verify tenant exists
    const tenant = await Tenant.findByPk(nexproTenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Create or update mapping
    const [mapping, created] = await SabitoTenantMapping.findOrCreate({
      where: { sabitoBusinessId },
      defaults: {
        nexproTenantId,
        businessName: businessName || tenant.name
      }
    });

    if (!created) {
      // Update existing mapping
      await mapping.update({
        nexproTenantId,
        businessName: businessName || tenant.name
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Mapping created successfully' : 'Mapping updated successfully',
      data: mapping
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all mappings for current tenant
 * GET /api/sabito/mappings
 */
exports.getMappings = async (req, res, next) => {
  try {
    const nexproTenantId = req.tenantId;
    
    const mappings = await SabitoTenantMapping.findAll({
      where: { nexproTenantId },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    res.status(200).json({
      success: true,
      data: mappings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a mapping
 * DELETE /api/sabito/mappings/:id
 */
exports.deleteMapping = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nexproTenantId = req.tenantId;

    const mapping = await SabitoTenantMapping.findOne({
      where: { id, nexproTenantId }
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }

    await mapping.destroy();

    res.status(200).json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
```

### Create Routes

Create `Backend/routes/sabitoMappingRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const { protect, tenantContext } = require('../middleware/auth');
const {
  createMapping,
  getMappings,
  deleteMapping
} = require('../controllers/sabitoMappingController');

// All routes require authentication and tenant context
router.use(protect);
router.use(tenantContext);

router.post('/mappings', createMapping);
router.get('/mappings', getMappings);
router.delete('/mappings/:id', deleteMapping);

module.exports = router;
```

### Register Routes

Add to `Backend/server.js`:

```javascript
const sabitoMappingRoutes = require('./routes/sabitoMappingRoutes');

// ... existing routes ...
app.use('/api/sabito', sabitoMappingRoutes);
```

---

## Usage: Creating a Mapping

### Option A: Via API (After login)

```bash
POST /api/sabito/mappings
Headers:
  Authorization: Bearer <nexpro-token>
  X-Tenant-ID: <nexpro-tenant-id>
Body:
{
  "sabitoBusinessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",
  "businessName": "iCreations Global"
}
```

### Option B: Direct Database Insert

```sql
INSERT INTO sabito_tenant_mappings (sabito_business_id, nexpro_tenant_id, business_name)
VALUES (
  'eb8c70e2-523c-4408-a1be-9657acf3e34d',  -- Sabito business ID
  '<your-nexpro-tenant-id>',                -- Your NEXPro tenant ID
  'iCreations Global'
);
```

### Option C: During SSO/Initial Setup

When a user logs in via SSO from Sabito, you can automatically create the mapping if it doesn't exist.

---

## Updated Webhook Flow

After implementation, the flow will be:

```
Sabito Webhook → NEXPro API
Body:
  {
    "event": "customer.created",
    "data": {
      "businessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",  ← Sabito's business ID
      "customer": { ... }
    }
  }

NEXPro:
  1. Receives webhook
  2. Extracts businessId from data.businessId
  3. Looks up mapping: sabito_tenant_mappings WHERE sabito_business_id = businessId
  4. Gets nexpro_tenant_id from mapping
  5. Validates tenant exists and is active
  6. Creates customer with mapped tenant ID ✅
```

---

## Testing

### 1. Run Migration

```bash
cd nexus-pro/Backend
node migrations/create-sabito-tenant-mapping.js
```

### 2. Create a Mapping

```bash
# Get your tenant ID
# Log into NEXPro → Browser Console → localStorage.getItem('activeTenantId')

# Create mapping via API
curl -X POST http://localhost:5000/api/sabito/mappings \
  -H "Authorization: Bearer <your-token>" \
  -H "X-Tenant-ID: <your-tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "sabitoBusinessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",
    "businessName": "iCreations Global"
  }'
```

### 3. Test Webhook

Once the mapping exists, Sabito's webhook should work correctly and create customers in the correct tenant.

---

## Summary

**What Changed:**
- ✅ No longer requires `X-Tenant-ID` header from Sabito
- ✅ Uses `businessId` from webhook body to look up tenant mapping
- ✅ Mapping table stores relationship: `sabito_business_id` → `nexpro_tenant_id`
- ✅ API endpoint to manage mappings
- ✅ Better error messages when mapping doesn't exist

**Benefits:**
- ✅ Decouples Sabito business IDs from NEXPro tenant IDs
- ✅ Multiple Sabito businesses can map to same NEXPro tenant (if needed)
- ✅ One NEXPro tenant can handle multiple Sabito businesses
- ✅ Clear separation of concerns

---

**Last Updated**: 2025-12-14




