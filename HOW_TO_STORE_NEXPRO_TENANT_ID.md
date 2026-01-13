# How to Store Nexpro Tenant ID in Sabito App Installation Settings

## Problem

Nexpro is rejecting webhooks from Sabito because Sabito's business ID doesn't have a corresponding tenant mapping in Nexpro's database. The webhook fails with:

```
No tenant mapping found for Sabito business ID: eb8c70e2-523c-4408-a1be-9657acf3e34d
```

## Solution

After SSO login, Nexpro needs to:
1. Get the installation ID from Sabito
2. Store the Nexpro tenant ID in Sabito's app installation settings

This allows Sabito to include the correct tenant ID in webhook headers, enabling automatic mapping creation.

---

## Step-by-Step Implementation

### Step 1: After SSO Login, Get Installation ID

After a successful SSO login (in `Backend/controllers/authController.js`), make a request to Sabito to get the installation:

```javascript
// In exports.sabitoSSO, after successful login
const sabitoApiUrl = process.env.SABITO_API_URL || 'http://localhost:4002';
const sabitoApiKey = process.env.SABITO_API_KEY;

// Get installation ID from Sabito
const installationsResponse = await axios.get(`${sabitoApiUrl}/api/apps/installations`, {
  headers: {
    'Authorization': `Bearer ${sabitoToken}`,
    'X-API-Key': sabitoApiKey
  }
});

const installations = installationsResponse.data?.data || installationsResponse.data || [];
const installation = installations[0]; // Get first installation

if (installation && installation.id) {
  const installationId = installation.id;
  const nexproTenantId = memberships[0]?.tenantId; // Get the active tenant ID
  
  // Step 2: Store tenant ID in installation settings
  // ... (see Step 2)
}
```

### Step 2: Store Nexpro Tenant ID in Installation Settings

Update the installation settings to include the Nexpro tenant ID:

```javascript
// Store tenant ID in Sabito installation settings
try {
  const updateResponse = await axios.put(
    `${sabitoApiUrl}/api/apps/installations/${installationId}/settings`,
    {
      settings: {
        nexproTenantId: nexproTenantId,
        // Merge with existing settings (don't overwrite)
        ...(installation.settings || {})
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${sabitoToken}`,
        'X-API-Key': sabitoApiKey,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('[SSO] ✅ Stored Nexpro tenant ID in Sabito installation:', {
    installationId,
    nexproTenantId,
    businessId: sabitoUser.businessId
  });
} catch (settingsError) {
  console.error('[SSO] Error storing tenant ID in Sabito:', settingsError.message);
  // Don't fail SSO if this fails, just log it
}
```

### Step 3: Complete Implementation

Here's the complete code to add to `Backend/controllers/authController.js` in the `sabitoSSO` function:

```javascript
// After getting memberships (around line 476)
const memberships = await UserTenant.findAll({
  where: { userId: user.id, status: 'active' },
  include: [
    {
      model: Tenant,
      as: 'tenant'
    }
  ],
  order: [
    ['isDefault', 'DESC'],
    ['createdAt', 'ASC']
  ]
});

// NEW: Get installation and store tenant ID
if (sabitoUser.businessId && memberships.length > 0) {
  const defaultTenant = memberships[0].tenant;
  const nexproTenantId = defaultTenant?.id;
  
  if (nexproTenantId) {
    try {
      // 1. Get installation ID from Sabito
      const installationsResponse = await axios.get(`${sabitoApiUrl}/api/apps/installations`, {
        headers: {
          'Authorization': `Bearer ${sabitoToken}`,
          'X-API-Key': sabitoApiKey
        }
      });
      
      const installations = installationsResponse.data?.data || installationsResponse.data || [];
      const installation = installations[0];
      
      if (installation && installation.id) {
        // 2. Store tenant ID in installation settings
        await axios.put(
          `${sabitoApiUrl}/api/apps/installations/${installation.id}/settings`,
          {
            settings: {
              nexproTenantId: nexproTenantId,
              // Preserve existing settings
              ...(installation.settings || {})
            },
            fromSettings: false, // Not stored in settings yet
            fallbackToBusinessId: true // Fallback to business ID if tenant ID not found
          },
          {
            headers: {
              'Authorization': `Bearer ${sabitoToken}`,
              'X-API-Key': sabitoApiKey,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('[SSO] ✅ Stored Nexpro tenant ID in Sabito installation:', {
          installationId: installation.id,
          nexproTenantId,
          businessId: sabitoUser.businessId
        });
      }
    } catch (settingsError) {
      console.error('[SSO] Error storing tenant ID in Sabito:', settingsError.message);
      // Don't fail SSO if this fails
    }
  }
  
  // Existing auto-create mapping code (keep this too)
  try {
    const { SabitoTenantMapping } = require('../models');
    
    if (defaultTenant) {
      const existingMapping = await SabitoTenantMapping.findOne({
        where: { sabitoBusinessId: sabitoUser.businessId }
      });

      if (!existingMapping) {
        await SabitoTenantMapping.create({
          sabitoBusinessId: sabitoUser.businessId,
          nexproTenantId: defaultTenant.id,
          businessName: sabitoUser.businessName || defaultTenant.name
        });
        console.log('[SSO] Auto-created tenant mapping for business:', sabitoUser.businessId);
      }
    }
  } catch (mappingError) {
    console.error('[SSO] Error auto-creating tenant mapping:', mappingError.message);
  }
}
```

---

## What This Fixes

### Before
- Webhooks fail because Sabito's business ID has no tenant mapping
- Error: `No tenant mapping found for Sabito business ID: eb8c70e2-523c-4408-a1be-9657acf3e34d`
- Manual mapping creation required

### After
- After SSO login, Nexpro tenant ID is stored in Sabito's installation settings
- Sabito includes the tenant ID in webhook headers (`x-tenant-id`)
- Webhook handler auto-creates the mapping if it doesn't exist
- Future webhooks work automatically

---

## Verification

After implementing, check the logs:

1. **SSO Login Logs:**
   ```
   [SSO] ✅ Stored Nexpro tenant ID in Sabito installation: {
     installationId: '...',
     nexproTenantId: '...',
     businessId: 'eb8c70e2-523c-4408-a1be-9657acf3e34d'
   }
   ```

2. **Webhook Logs (should show):**
   ```
   [Sabito Webhook] Looking up tenant mapping for businessId: eb8c70e2-523c-4408-a1be-9657acf3e34d
   [Sabito Webhook] ✅ Auto-created tenant mapping: {
     sabitoBusinessId: 'eb8c70e2-523c-4408-a1be-9657acf3e34d',
     nexproTenantId: '...',
     mappingId: '...'
   }
   ```

---

## API Endpoints Used

### Get Installations
```http
GET /api/apps/installations
Headers:
  Authorization: Bearer <sabito-token>
  X-API-Key: <sabito-api-key>
```

### Update Installation Settings
```http
PUT /api/apps/installations/{installationId}/settings
Headers:
  Authorization: Bearer <sabito-token>
  X-API-Key: <sabito-api-key>
  Content-Type: application/json
Body:
{
  "settings": {
    "nexproTenantId": "<tenant-uuid>",
    ...existingSettings
  },
  "fromSettings": false,
  "fallbackToBusinessId": true
}
```

---

## Notes

- The settings update uses **merging** instead of replacing, so existing settings are preserved
- If storing the tenant ID fails, SSO login still succeeds (non-blocking)
- The `fallbackToBusinessId: true` flag tells Sabito to use the business ID if tenant ID lookup fails
- This is a one-time setup per installation - after the first SSO login, future webhooks will work automatically

---

## Testing

1. Perform SSO login from Sabito to Nexpro
2. Check Nexpro logs for the success message
3. Trigger a webhook from Sabito
4. Verify webhook succeeds and customer is created/updated in Nexpro

---

**Last Updated:** 2024-01-15  
**Status:** Ready for Implementation




