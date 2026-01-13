# Tenant ID Mapping - Quick Start Guide

## Problem Solved

Sabito sends webhooks with `businessId`, but NEXPro needs `tenantId`. We now map Sabito business IDs to NEXPro tenant IDs.

## Implementation Complete ✅

All code has been implemented:
- ✅ Database table: `sabito_tenant_mappings`
- ✅ Sequelize model: `SabitoTenantMapping`
- ✅ Updated webhook handler to use mappings
- ✅ API endpoints to manage mappings
- ✅ Migration file ready to run

---

## Step 1: Run Migration

```bash
cd nexus-pro/Backend
node migrations/create-sabito-tenant-mapping.js
```

This creates the `sabito_tenant_mappings` table.

---

## Step 2: Create a Mapping

### Option A: Via API (Recommended)

1. **Get your NEXPro token and tenant ID:**
   - Log into NEXPro
   - Open browser console (F12)
   - Run: `localStorage.getItem('token')` → copy the token
   - Run: `localStorage.getItem('activeTenantId')` → copy the tenant ID

2. **Get Sabito business ID:**
   - From the webhook logs, the `businessId` is: `eb8c70e2-523c-4408-a1be-9657acf3e34d`
   - Or from Sabito's webhook payload: `data.businessId`

3. **Create the mapping:**
```bash
curl -X POST http://localhost:5000/api/sabito/mappings \
  -H "Authorization: Bearer <your-nexpro-token>" \
  -H "X-Tenant-ID: <your-nexpro-tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "sabitoBusinessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",
    "businessName": "iCreations Global"
  }'
```

### Option B: Direct Database Insert

```sql
INSERT INTO sabito_tenant_mappings (sabito_business_id, nexpro_tenant_id, business_name)
VALUES (
  'eb8c70e2-523c-4408-a1be-9657acf3e34d',  -- Sabito business ID from webhook
  '<your-nexpro-tenant-id>',               -- Your NEXPro tenant ID
  'iCreations Global'
);
```

---

## Step 3: Test Webhook

Once the mapping exists, Sabito's webhook should work:

1. Create a referral in Sabito
2. Sabito sends webhook to NEXPro
3. NEXPro looks up mapping: `businessId` → `tenantId`
4. Customer is created in the correct tenant ✅

---

## How It Works

### Before (Broken):
```
Sabito Webhook:
  X-Tenant-ID: eb8c70e2-523c-4408-a1be-9657acf3e34d  ← Doesn't exist in NEXPro
  Body: { businessId: "eb8c70e2-..." }
  
NEXPro: ❌ Tenant not found error
```

### After (Fixed):
```
Sabito Webhook:
  Body: { businessId: "eb8c70e2-..." }
  
NEXPro:
  1. Extracts businessId from body
  2. Looks up mapping table
  3. Finds: sabito_business_id → nexpro_tenant_id
  4. Creates customer with mapped tenant ID ✅
```

---

## API Endpoints

### Create/Update Mapping
```bash
POST /api/sabito/mappings
Headers:
  Authorization: Bearer <token>
  X-Tenant-ID: <tenant-id>
Body:
{
  "sabitoBusinessId": "...",
  "businessName": "..."
}
```

### List Mappings
```bash
GET /api/sabito/mappings
Headers:
  Authorization: Bearer <token>
  X-Tenant-ID: <tenant-id>
```

### Delete Mapping
```bash
DELETE /api/sabito/mappings/:id
Headers:
  Authorization: Bearer <token>
  X-Tenant-ID: <tenant-id>
```

---

## Verify It's Working

Check the backend logs when Sabito sends a webhook:

```
[Sabito Webhook] Looking up tenant mapping for businessId: eb8c70e2-...
[Sabito Webhook] Tenant mapped successfully: {
  sabitoBusinessId: 'eb8c70e2-...',
  nexproTenantId: '<your-tenant-id>',
  tenantName: 'Your Tenant Name'
}
[Sabito Webhook] Customer created successfully: <customer-id>
```

---

## Troubleshooting

### Error: "No tenant mapping found"
**Fix**: Create a mapping first using `POST /api/sabito/mappings`

### Error: "Tenant not found"
**Fix**: Verify your tenant ID is correct and exists in the `tenants` table

### Error: Migration fails
**Fix**: Ensure PostgreSQL is running and connection is configured correctly

---

## Next Steps

1. ✅ Run migration
2. ✅ Create mapping for your Sabito business
3. ✅ Test webhook from Sabito
4. ✅ Verify customers appear in NEXPro

---

**Last Updated**: 2025-12-14




