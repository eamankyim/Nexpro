# Sabito Periodic Customer Sync Guide

## Overview

NEXPro now periodically syncs customers from Sabito to ensure all converted referrals are up-to-date in the system. This runs automatically in the background and can also be triggered manually.

## How It Works

1. **Periodic Sync**: Runs automatically on a schedule (default: every 6 hours)
2. **Incremental Updates**: Only fetches customers updated since the last sync
3. **Full Sync**: Can be triggered manually to sync all customers
4. **Tenant Mapping**: Uses the Sabito business ID → NEXPro tenant ID mapping

## Configuration

Add these environment variables to your `.env` file:

```env
# Enable/disable periodic sync (default: true)
SABITO_SYNC_ENABLED=true

# Sync interval (cron expression, default: every 6 hours)
SABITO_SYNC_INTERVAL=0 */6 * * *

# Run sync on server startup (default: true)
SABITO_SYNC_ON_STARTUP=true
```

### Cron Expression Examples

- Every hour: `0 * * * *`
- Every 6 hours: `0 */6 * * *` (default)
- Every 12 hours: `0 */12 * * *`
- Daily at midnight: `0 0 * * *`
- Every 30 minutes: `*/30 * * * *`

## API Endpoints

### 1. Trigger Manual Sync (All Tenants)

```bash
POST /api/sabito/sync
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "fullSync": false  // false = incremental, true = sync all customers
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync completed",
  "data": [
    {
      "success": true,
      "businessId": "...",
      "customersProcessed": 10,
      "created": 5,
      "updated": 3,
      "skipped": 2,
      "errors": 0,
      "errorDetails": []
    }
  ]
}
```

### 2. Sync Specific Tenant Mapping

```bash
POST /api/sabito/sync/:mappingId
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
Content-Type: application/json

{
  "fullSync": false
}
```

### 3. Get Sync Status

```bash
GET /api/sabito/sync/status
Authorization: Bearer <token>
X-Tenant-ID: <tenant-id>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "<mapping-id>",
      "sabitoBusinessId": "...",
      "businessName": "iCreations Global",
      "tenantName": "My Tenant",
      "lastSyncAt": "2025-12-14T12:00:00Z",
      "lastSyncResult": {
        "customersProcessed": 10,
        "created": 5,
        "updated": 3,
        "skipped": 2,
        "errors": 0,
        "syncedAt": "2025-12-14T12:00:00Z"
      },
      "lastUpdated": "2025-12-14T12:00:00Z"
    }
  ]
}
```

## How Sync Works

### Incremental Sync (Default)

1. Fetches customers from Sabito API with `updatedAfter` parameter
2. Only processes customers updated since last sync
3. Updates `lastSyncedAt` timestamp in mapping metadata
4. More efficient for regular periodic syncs

### Full Sync

1. Fetches all customers from Sabito (no date filter)
2. Processes all customers (creates new, updates existing)
3. Useful for initial setup or fixing sync issues

## Sync Process

For each tenant mapping:

1. **Fetch Customers**: Calls Sabito API with business ID
2. **Match Existing**: Checks for existing customers by:
   - Email + Tenant ID
   - Sabito Customer ID
3. **Create/Update**:
   - Creates new customer if not found
   - Updates existing customer with latest data
4. **Track Results**: Stores sync statistics in mapping metadata

## Customer Data Mapping

| Sabito Field | NEXPro Field | Notes |
|-------------|--------------|-------|
| `id` | `sabitoCustomerId` | Sabito's customer ID |
| `email` | `email` | Primary identifier |
| `name` | `name` | Customer name |
| `phone` | `phone` | Phone number |
| `address` | `address` | Street address |
| `city` | `city` | City |
| `state` | `state` | State/Province |
| `country` | `country` | Country (default: USA) |
| `sourceReferralId` | `sabitoSourceReferralId` | Referral source ID |
| `sourceType` | `sabitoSourceType` | Referral type |
| N/A | `howDidYouHear` | Set to "Sabito Referral" |
| N/A | `sabitoBusinessId` | From mapping |

## Logging

The sync service logs all activities:

```
[Sabito Sync] Starting sync for all tenants...
[Sabito Sync] Found 1 tenant mappings to sync
[Sabito Sync] Starting sync for business: iCreations Global (eb8c70e2-...)
[Sabito Sync] Found 10 customers to sync
[Sabito Sync] Sync completed for iCreations Global: { processed: 10, created: 5, updated: 3, skipped: 2, errors: 0 }
[Sabito Sync] All tenants sync completed: { totalTenants: 1, totalCreated: 5, totalUpdated: 3, totalErrors: 0 }
```

## Troubleshooting

### Sync Not Running

1. Check `SABITO_SYNC_ENABLED` is not set to `false`
2. Check server logs for scheduler startup message
3. Verify node-cron is installed: `npm list node-cron`

### No Customers Synced

1. Verify tenant mapping exists: `GET /api/sabito/mappings`
2. Check Sabito API is accessible and API key is correct
3. Check sync status: `GET /api/sabito/sync/status`
4. Review error logs in console

### Customers Not Updating

1. Check if customers exist in Sabito
2. Verify `lastSyncedAt` timestamp is updating
3. Try full sync: `POST /api/sabito/sync` with `{ "fullSync": true }`

### API Errors

1. Verify `SABITO_API_URL` is correct
2. Check `SABITO_API_KEY` is valid
3. Ensure Sabito API endpoint `/api/customers` exists and accepts:
   - `businessId` parameter
   - `updatedAfter` parameter (optional)
   - `X-API-Key` header

## Sabito API Requirements

The sync service expects Sabito's API to have:

**Endpoint:** `GET /api/customers`

**Query Parameters:**
- `businessId` (required): Sabito business ID
- `updatedAfter` (optional): ISO 8601 timestamp
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Headers:**
- `X-API-Key`: API key for authentication

**Response Format:**
```json
{
  "data": [
    {
      "id": "customer-id",
      "email": "customer@example.com",
      "name": "Customer Name",
      "phone": "+1234567890",
      "address": "123 Main St",
      "city": "City",
      "state": "State",
      "country": "USA",
      "sourceReferralId": "referral-id",
      "sourceType": "referral"
    }
  ]
}
```

## Best Practices

1. **Start with Full Sync**: Run a full sync initially to populate all customers
2. **Use Incremental for Regular Sync**: Default incremental sync is more efficient
3. **Monitor Sync Status**: Check sync status regularly to ensure it's working
4. **Review Errors**: Check error details in sync results for any issues
5. **Adjust Frequency**: Tune `SABITO_SYNC_INTERVAL` based on your needs

---

**Last Updated**: 2025-12-14




