# Sabito Webhook Debugging Guide

## Issue: Sabito referrals not showing in customer table

### Common Causes:

1. **Webhook not being sent from Sabito**
2. **Authentication failure** (API key mismatch)
3. **Missing tenant ID** in webhook header
4. **Customer created but filtered out** in frontend
5. **Database error** during creation

---

## Step 1: Check Backend Logs

When Sabito sends a webhook, you should see logs like:

```
[Sabito Webhook] Received request: { ... }
[Sabito Webhook] Authentication successful
[Sabito Webhook] Processing for tenant: <tenant-id>
[Sabito Webhook] Creating new customer with data: { ... }
[Sabito Webhook] Customer created successfully: <customer-id>
```

**If you don't see these logs:**
- Sabito is not sending the webhook
- Check Sabito's webhook configuration
- Verify the webhook URL: `http://localhost:5000/api/webhooks/sabito/customer`

---

## Step 2: Test Webhook Manually

### Test with curl:

```bash
curl -X POST http://localhost:5000/api/webhooks/sabito/customer \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 96f39d4b9514addf4c8f08fc38a88db869bd382e16337edbfe46197859ba1e73" \
  -H "X-Tenant-ID: <YOUR_TENANT_ID>" \
  -d '{
    "event": "customer.created",
    "data": {
      "sabitoCustomerId": "test-123",
      "sourceReferralId": "ref-456",
      "sourceType": "referral",
      "businessId": "biz-789",
      "customer": {
        "name": "Test Customer",
        "email": "test@example.com",
        "phone": "+1234567890",
        "address": "123 Test St",
        "city": "Test City",
        "state": "Test State",
        "country": "USA"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "customerId": "<uuid>",
    "sabitoCustomerId": "test-123"
  }
}
```

---

## Step 3: Verify Database

Check if customers are actually being created:

```sql
-- Check for Sabito customers
SELECT id, name, email, sabito_customer_id, sabito_source_type, created_at
FROM customers
WHERE sabito_customer_id IS NOT NULL
ORDER BY created_at DESC;

-- Check recent customers
SELECT id, name, email, how_did_you_hear, referral_name, created_at
FROM customers
ORDER BY created_at DESC
LIMIT 10;
```

---

## Step 4: Check Frontend Filtering

The customer list should show all customers. Check:

1. **Search filter** - Make sure search is not filtering out Sabito customers
2. **Pagination** - Check if customer is on a different page
3. **Refresh** - Try refreshing the customer list

---

## Step 5: Verify Webhook Configuration in Sabito

Sabito should send webhooks to:
- **URL**: `http://localhost:5000/api/webhooks/sabito/customer`
- **Method**: POST
- **Headers**:
  - `X-API-Key`: `96f39d4b9514addf4c8f08fc38a88db869bd382e16337edbfe46197859ba1e73`
  - `X-Tenant-ID`: `<tenant-id>` (REQUIRED!)
  - `Content-Type`: `application/json`
- **Body**:
```json
{
  "event": "customer.created",
  "data": {
    "sabitoCustomerId": "...",
    "sourceReferralId": "...",
    "sourceType": "referral",
    "businessId": "...",
    "customer": {
      "name": "...",
      "email": "...",
      "phone": "...",
      "address": "...",
      "city": "...",
      "state": "...",
      "country": "..."
    }
  }
}
```

---

## Step 6: Common Issues & Solutions

### Issue: "Tenant ID required in x-tenant-id header"
**Solution**: Sabito must include `X-Tenant-ID` header with the tenant UUID

### Issue: "Invalid webhook signature or API key"
**Solution**: 
- Check `SABITO_API_KEY` in NEXPro `.env` matches what Sabito is sending
- Verify Sabito is sending `X-API-Key` header

### Issue: "Missing required fields: sabitoCustomerId, customer.email"
**Solution**: Sabito webhook payload is missing required fields

### Issue: Customer created but not visible
**Solution**:
- Check if customer has `isActive: true`
- Verify tenant ID matches current user's tenant
- Check frontend search/filter

### Issue: "Tenant not found" error
**Error**: `insert or update on table "customers" violates foreign key constraint "customers_tenantId_fkey"`

**Root Cause**: The tenant ID sent by Sabito doesn't exist in the NEXPro `tenants` table.

**Solution Options**:

**Option 1: Get the correct tenant ID from NEXPro**
1. Log into NEXPro
2. Open browser console
3. Run: `localStorage.getItem('activeTenantId')`
4. Or check Network tab → any API call → Request Headers → `x-tenant-id`
5. Update Sabito to send the correct tenant ID in the `X-Tenant-ID` header

**Option 2: Find your tenant in the database**
```sql
-- List all tenants
SELECT id, name, slug, status, "createdAt"
FROM tenants
ORDER BY "createdAt" DESC;

-- Find tenant by name (if you know it)
SELECT id, name, slug
FROM tenants
WHERE name ILIKE '%iCreations%';
```

**Option 3: Create tenant if missing (if needed)**
The tenant should already exist in NEXPro. If it doesn't:
1. The user needs to sign up/login to NEXPro first
2. Or create the tenant through the NEXPro admin interface
3. Then get the tenant ID and configure Sabito to use it

**Note**: The `businessId` from Sabito (`eb8c70e2-523c-4408-a1be-9657acf3e34d`) should match a tenant ID in NEXPro. If they don't match, you need to:
- Either update Sabito to send the correct tenant ID
- Or create a mapping between Sabito business IDs and NEXPro tenant IDs

---

## Step 7: Get Your Tenant ID

To get your tenant ID for testing:

1. Log into NEXPro
2. Open browser console
3. Run: `localStorage.getItem('activeTenantId')`
4. Or check Network tab → any API call → Request Headers → `x-tenant-id`

---

## Testing Checklist

- [ ] Backend logs show webhook received
- [ ] Authentication successful
- [ ] Tenant ID present in header
- [ ] Customer created in database
- [ ] Customer visible in frontend customer list
- [ ] Customer has `sabitoCustomerId` field populated
- [ ] Customer has `howDidYouHear: 'Sabito Referral'`

---

**Last Updated**: 2025-12-14


