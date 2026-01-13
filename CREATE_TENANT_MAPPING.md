# Create Sabito Tenant Mapping

The webhook is working correctly, but you need to create a mapping between the Sabito business ID and your NEXPro tenant ID.

## Quick Fix

### Option 1: Using the Script (Easiest)

1. **Get your NEXPro tenant ID:**
   - Log into NEXPro
   - Open browser console (F12)
   - Run: `localStorage.getItem('activeTenantId')`
   - Copy the tenant ID

2. **Run the mapping script:**
   ```bash
   cd nexus-pro/Backend
   node utils/create-sabito-mapping.js eb8c70e2-523c-4408-a1be-9657acf3e34d <your-tenant-id> "iCreations Global"
   ```

   Replace `<your-tenant-id>` with the tenant ID you got from step 1.

### Option 2: Using the API

1. **Get your NEXPro token and tenant ID:**
   - Log into NEXPro
   - Open browser console (F12)
   - Run: `localStorage.getItem('token')` → copy the token
   - Run: `localStorage.getItem('activeTenantId')` → copy the tenant ID

2. **Create the mapping:**
   ```bash
   curl -X POST http://localhost:5000/api/sabito/mappings \
     -H "Authorization: Bearer <your-token>" \
     -H "X-Tenant-ID: <your-tenant-id>" \
     -H "Content-Type: application/json" \
     -d '{
       "sabitoBusinessId": "eb8c70e2-523c-4408-a1be-9657acf3e34d",
       "businessName": "iCreations Global"
     }'
   ```

### Option 3: Direct Database Insert

```sql
-- First, find your tenant ID
SELECT id, name, slug FROM tenants ORDER BY "createdAt" DESC;

-- Then insert the mapping (replace <your-tenant-id> with actual tenant ID)
INSERT INTO sabito_tenant_mappings (sabito_business_id, nexpro_tenant_id, business_name)
VALUES (
  'eb8c70e2-523c-4408-a1be-9657acf3e34d',
  '<your-tenant-id>',
  'iCreations Global'
);
```

## Verify the Mapping

After creating the mapping, you can verify it:

```bash
# Using API
curl -X GET http://localhost:5000/api/sabito/mappings \
  -H "Authorization: Bearer <your-token>" \
  -H "X-Tenant-ID: <your-tenant-id>"
```

Or check the database:
```sql
SELECT * FROM sabito_tenant_mappings;
```

## After Creating the Mapping

Once the mapping is created:
1. ✅ Webhooks from Sabito will work automatically
2. ✅ Customers will be created in NEXPro
3. ✅ Periodic sync will also work

The next time Sabito sends a webhook, it should successfully create the customer in NEXPro!




