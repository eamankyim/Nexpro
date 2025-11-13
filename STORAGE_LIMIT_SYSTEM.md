# 💾 Storage Limit Management System

## Overview

Your NEXpro platform now enforces **storage/file upload limits** based on subscription plans! Tenants are automatically restricted based on their plan tier.

---

## 📊 Default Storage Limits

| Plan | Base Storage | Additional Storage Price | Unlimited? |
|------|-------------|-------------------------|------------|
| **Trial** | 1 GB | Not available | ❌ |
| **Launch** | 10 GB | GHS 15 per 100GB | ❌ |
| **Scale** | 50 GB | GHS 12 per 100GB | ❌ |
| **Enterprise** | ∞ | Custom pricing | ✅ |

---

## 🎯 What's Tracked

### Files Counted Toward Storage:

✅ **Job attachments** (`uploads/jobs/{tenantId}/`)  
✅ **Employee documents** (`uploads/employees/{tenantId}/`)  
✅ **Organization logos** (`uploads/settings/{tenantId}/`)  
✅ **Invoice attachments** (if applicable)  
✅ **Any tenant-specific uploads**  

### Not Counted:
❌ Platform-level assets  
❌ Shared resources  
❌ Temporary files  

---

## 🔧 Admin: Configure Storage Limits

### Step 1: Navigate to Plan Editor
1. Go to `/admin/settings`
2. Click **"💳 Subscription Plans"** tab
3. Click **"Edit"** on any plan

### Step 2: Set Storage Limits

Find the **"Storage Limits"** section:

```
┌──────────────────────────┬────────────────────────────┐
│ Storage Limit (MB)       │ Price Per 100GB            │
│ [10240             ]     │ GHS [15.00           ]     │
│ 1024 MB = 1 GB          │ Cost to add beyond base    │
└──────────────────────────┴────────────────────────────┘
```

**Examples:**
- **Trial**: `1024` MB (1 GB), no expansion
- **Launch**: `10240` MB (10 GB), `15.00` per 100GB
- **Scale**: `51200` MB (50 GB), `12.00` per 100GB
- **Enterprise**: Leave empty (unlimited)

**Quick Reference:**
- 1 GB = 1,024 MB
- 10 GB = 10,240 MB
- 50 GB = 51,200 MB
- 100 GB = 102,400 MB

### Step 3: Save
Changes apply immediately to all tenants on that plan!

---

## 👨‍💼 User Experience

### Storage Usage Card (Users Page):

#### Within Limits (3.2 GB / 10 GB):

```
┌────────────────────────────────────────────────────────┐
│ ☁️ Storage Usage              [Launch Plan]           │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Used            Total Limit      Available            │
│  3.20 GB            10 GB          6.80 GB             │
│                                                        │
│  Storage Usage                  3.20 GB of 10 GB (32%) │
│  ████████░░░░░░░░░░░░░░                               │
│                                                        │
│  ℹ️ Need more storage? Add 100GB for GHS 15           │
└────────────────────────────────────────────────────────┘
```

#### Near Limit (8.7 GB / 10 GB):

```
┌────────────────────────────────────────────────────────┐
│ ☁️ Storage Usage              [Launch Plan]           │
├────────────────────────────────────────────────────────┤
│  Used            Total Limit      Available            │
│  8.70 GB            10 GB          1.30 GB             │
│                                                        │
│  Storage Usage                  8.70 GB of 10 GB (87%) │
│  ████████████████████░░░                              │
│                                                        │
│  ⚠️ Storage Running Low                               │
│  Only 1.30 GB remaining (13% available).              │
│  Consider upgrading soon.                              │
└────────────────────────────────────────────────────────┘
```

#### At Limit (9.9 GB / 10 GB):

```
┌────────────────────────────────────────────────────────┐
│ ☁️ Storage Usage              [Launch Plan]           │
├────────────────────────────────────────────────────────┤
│  Used            Total Limit      Available            │
│  9.90 GB            10 GB          0.10 GB             │
│                                                        │
│  Storage Usage                  9.90 GB of 10 GB (99%) │
│  ████████████████████████                             │
│                                                        │
│  ❌ Storage Limit Reached                              │
│  You've used 9.90 GB of your 10 GB limit.             │
│  Add more storage for GHS 15 per 100GB or upgrade.    │
│                                                        │
│  [Upgrade Plan]                                        │
└────────────────────────────────────────────────────────┘
```

### When Trying to Upload (at limit):

```
User uploads 50MB file
     ↓
Backend checks storage:
- Current: 9.9 GB
- Limit: 10 GB
- File: 0.05 GB
- After upload: 9.95 GB ✓ Allowed

User uploads 200MB file
     ↓
Backend checks storage:
- Current: 9.9 GB
- Limit: 10 GB
- File: 0.2 GB
- After upload: 10.1 GB ✗ Blocked
     ↓
❌ Error (413 Payload Too Large):
"Storage limit exceeded. Your Launch plan allows 10GB. 
You're currently using 9.90GB. This 200MB upload would 
exceed your limit. Add more storage for GHS 15 per 100GB 
or upgrade your plan."
```

---

## 🔐 Backend Enforcement

### Automatic Checks on Upload:

```javascript
// Upload route example
router.post('/jobs/:id/attachments',
  protect,
  tenantContext,
  checkStorageLimit,  // ← Storage check middleware
  upload.array('files', 10),
  uploadJobAttachments
);
```

### Middleware Flow:

```
User uploads file
     ↓
1. Check Content-Length header
     ↓
2. Get tenant's current storage usage
     ↓
3. Get tenant's plan storage limit
     ↓
4. Calculate: current + fileSize > limit?
     ↓
   Yes → 413 Error (too large)
   No → Proceed with upload
```

### Error Response:

```json
{
  "success": false,
  "message": "Storage limit exceeded. Your Launch plan allows 10240MB (10.0GB). You're currently using 9500MB (9.28GB). This 800MB upload would exceed your limit. Add more storage for GHS 15 per 100GB or upgrade your plan.",
  "code": "STORAGE_LIMIT_EXCEEDED",
  "details": {
    "allowed": false,
    "currentMB": 9500,
    "limitMB": 10240,
    "remainingMB": 740,
    "afterUploadMB": 10300,
    "fileSizeMB": 800,
    "planName": "Launch",
    "price100GB": 15
  },
  "upgradeRequired": true
}
```

---

## 📱 Frontend Integration

### Get Storage Usage:

```javascript
import inviteService from '../services/inviteService';

const response = await inviteService.getStorageUsage();
console.log(response.data);
/*
{
  currentMB: 5120,
  currentGB: "5.00",
  limitMB: 10240,
  limitGB: "10.0",
  remainingMB: 5120,
  remainingGB: "5.00",
  percentageUsed: 50,
  isUnlimited: false,
  isNearLimit: false,
  isAtLimit: false,
  canUploadMore: true,
  planName: "Launch",
  price100GB: 15
}
*/
```

### Display Storage Card:

```jsx
import StorageUsageCard from '../components/StorageUsageCard';

function MyPage() {
  return (
    <div>
      <StorageUsageCard 
        style={{ marginBottom: 24 }}
        showUpgradeButton={true}
      />
      {/* Rest of your page */}
    </div>
  );
}
```

### Check Before Upload:

```jsx
import { useState } from 'react';
import { message, Upload } from 'antd';
import inviteService from '../services/inviteService';

function FileUploader() {
  const handleBeforeUpload = async (file) => {
    // Check storage before upload
    try {
      const response = await inviteService.getStorageUsage();
      const usage = response.data;
      
      if (usage.isAtLimit) {
        message.error('Storage limit reached! Please upgrade your plan.');
        return false;
      }
      
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > usage.remainingMB) {
        message.warning(
          `File is ${fileSizeMB.toFixed(2)}MB but you only have ${usage.remainingGB}GB remaining.`
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Storage check failed:', error);
      return true; // Allow upload on error
    }
  };

  return (
    <Upload beforeUpload={handleBeforeUpload}>
      <Button>Upload File</Button>
    </Upload>
  );
}
```

---

## 🎨 Visual Admin Experience

### Plan Table with Storage Column:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Subscription Plans                                  [Create Plan]       │
├──────┬─────────┬────────┬──────────┬─────────┬──────────┬─────────────┤
│Order │ Plan ID │ Name   │ Price    │ Seats   │ Storage  │ Status      │
├──────┼─────────┼────────┼──────────┼─────────┼──────────┼─────────────┤
│ 10   │ trial   │ Trial  │ GHS 0    │ 5 seats │ 1 GB     │ [Active]    │
│ 20   │ launch  │ Launch │ GHS 799  │ 5 seats │ 10 GB    │ [Active]    │
│      │         │        │          │ +25/seat│ +15/100GB│             │
│ 30   │ scale   │ Scale  │ GHS 1,299│ 15 seats│ 50 GB    │ [Active]    │
│      │         │        │          │ +32/seat│ +12/100GB│             │
│ 40   │ enterpr.│ Enterp.│ Custom   │Unlimited│Unlimited │ [Active]    │
└──────┴─────────┴────────┴──────────┴─────────┴──────────┴─────────────┘
```

### Plan Editor with Storage Fields:

```
┌─────────────────────────────────────────────────────────┐
│ Edit Subscription Plan: "Launch"                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ── Pricing ───────────────────────────────────────     │
│ Amount: [799] Display: [GHS 799/mo]                    │
│                                                         │
│ ── Seat Limits ───────────────────────────────────     │
│ Max Seats: [5] Price/Seat: [25.00]                     │
│                                                         │
│ ── Storage Limits ────────────────────────────────     │
│ Limit (MB): [10240  ] Price/100GB: [15.00]             │
│ Leave empty for unlimited  Cost to add beyond base     │
│                                                         │
│ 💡 10240 MB = 10 GB                                     │
│                                                         │
│ ── Feature Access Control ────────────────────────     │
│ [Feature toggles...]                                    │
│                                                         │
│                                   [Cancel] [Save]       │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Usage Scenarios

### Scenario 1: User Uploads Large File

**Current State:**
- Plan: Launch (10 GB limit)
- Used: 8.5 GB
- Remaining: 1.5 GB

**Action: Upload 2 GB file**

**System Response:**
```
❌ Upload Blocked (413 error)

"Storage limit exceeded. Your Launch plan allows 10GB. 
You're currently using 8.50GB. This 2GB upload would exceed 
your limit. Add more storage for GHS 15 per 100GB or upgrade 
your plan."

Options:
1. [Upgrade to Scale] - Get 50 GB total
2. [Add 100GB] - Pay GHS 15/month (coming soon)
3. [Delete old files] - Free up space
```

### Scenario 2: Admin Checks Tenant Storage

**As Platform Admin:**

1. Go to `/admin/tenants`
2. Click on tenant
3. See storage usage: "7.2 GB / 10 GB (72%)"
4. Warning if near limit
5. Can view detailed file breakdown

### Scenario 3: Tenant Upgrades for Storage

**Current:**
- Plan: Launch (10 GB)
- Used: 9.8 GB
- Needs: More storage

**Options:**

**Option A: Upgrade to Scale**
- Cost: GHS 1,299/mo (vs GHS 799/mo)
- Get: 50 GB total storage (+15 seats, +features)
- Best for: Growing teams

**Option B: Add 100GB**
- Cost: GHS 799 + GHS 15 = GHS 814/mo
- Get: 110 GB total storage
- Best for: Storage-heavy, small teams

---

## 🛠️ API Reference

### Get Storage Usage:
```
GET /api/invites/storage-usage
Authorization: Bearer {token}
X-Tenant-ID: {tenantId}

Response:
{
  "success": true,
  "data": {
    "currentMB": 5120,
    "currentGB": "5.00",
    "limitMB": 10240,
    "limitGB": "10.0",
    "remainingMB": 5120,
    "remainingGB": "5.00",
    "percentageUsed": 50,
    "isUnlimited": false,
    "isNearLimit": false,
    "isAtLimit": false,
    "canUploadMore": true,
    "planName": "Launch",
    "price100GB": 15
  }
}
```

### Upload with Storage Check:
```javascript
const { checkStorageLimit } = require('../middleware/upload');

router.post('/upload',
  protect,
  tenantContext,
  checkStorageLimit,  // Checks before upload
  upload.single('file'),
  handleUpload
);
```

---

## 📊 Storage Calculation

### How Usage is Calculated:

```javascript
// Recursive directory scan
const getDirectorySize = async (dir) => {
  let total = 0;
  for (const file of files) {
    total += file.size;  // in bytes
  }
  return total;
};

// Calculate for tenant
const directories = [
  `uploads/jobs/${tenantId}`,
  `uploads/employees/${tenantId}`,
  `uploads/settings/${tenantId}`
];

let totalBytes = 0;
for (const dir of directories) {
  totalBytes += await getDirectorySize(dir);
}

const totalMB = Math.ceil(totalBytes / (1024 * 1024));
```

### Performance Optimization:

**Current:** Calculates on-demand (fast for small tenants)  
**Future:** Cache results, update on upload/delete  
**For Large Tenants:** Store usage in database, update asynchronously  

---

## 🔄 Workflows

### File Upload Flow:

```
User selects file (150 MB)
     ↓
Frontend checks available storage
     ↓
POST /api/jobs/123/attachments
Content-Length: 157286400 bytes
     ↓
Backend checkStorageLimit middleware
     ↓
getTenantStorageUsage(tenantId)
- Scans tenant directories
- Calculates: 8.5 GB used
     ↓
getTenantStorageLimit(tenantId)
- Queries plan: 10 GB limit
     ↓
Validation:
- Current: 8.5 GB
- File: 0.15 GB
- After: 8.65 GB
- Limit: 10 GB
- Result: ✓ ALLOWED
     ↓
Upload proceeds
     ↓
File saved to disk
     ↓
Storage usage now: 8.65 GB
```

### Storage Exceeded Flow:

```
User tries to upload 2 GB file
Current usage: 9.5 GB
Limit: 10 GB
     ↓
Middleware calculates:
After upload would be: 11.5 GB
Exceeds limit of: 10 GB
     ↓
Returns 413 (Payload Too Large)
{
  "message": "Storage limit exceeded...",
  "code": "STORAGE_LIMIT_EXCEEDED",
  "upgradeRequired": true
}
     ↓
Frontend shows error alert
with upgrade options
```

---

## ⚠️ Edge Cases Handled

### 1. **Directory Doesn't Exist Yet**
```
New tenant, no uploads folder
→ Returns 0 MB used (no error)
→ Allows first upload
```

### 2. **Unlimited Plan**
```
Enterprise tenant
→ Skips all storage checks
→ No limits enforced
→ Shows "Unlimited" badge
```

### 3. **Downgrade with Excess Storage**
```
Scenario: Tenant using 30 GB downgrades from Scale (50GB) to Launch (10GB)

Handling:
- Existing files remain accessible
- Usage shows: 30 GB / 10 GB (300% - over limit!)
- Cannot upload new files until usage drops
- System shows warning: "Delete 20GB to resume uploads"
- No automatic deletion (user control)
```

### 4. **Failed Upload (Network Error)**
```
Upload starts → Fails midway
→ Partial file may exist on disk
→ Future enhancement: Cleanup job removes partials
→ For now: Manual cleanup or ignore (temporary files)
```

### 5. **Large File Upload**
```
User uploads 5 GB file
Current: 2 GB used
Limit: 10 GB
→ Allowed (7 GB after upload)
→ Progress bar updates
→ Warning shown if approaching limit
```

---

## 💼 Business Scenarios

### Revenue Opportunity 1: Storage Upsell

```
Tenant Profile:
- Plan: Launch (10 GB, GHS 799/mo)
- Usage: 9.5 GB (95%)
- Files: Job photos, employee docs

Upsell Options:
1. Add 100GB → +GHS 15/mo = GHS 814/mo
2. Upgrade to Scale → 50 GB + features = GHS 1,299/mo

If tenant adds 200GB of storage:
Additional MRR = 2 × 15 = GHS 30
```

### Revenue Opportunity 2: Prevent Downgrades

```
Tenant wants to downgrade:
- Current: Scale (50 GB)
- Usage: 35 GB
- Wants: Launch (10 GB)

System blocks:
"You're using 35 GB but Launch plan only allows 10 GB. 
Delete 25 GB of files or stay on Scale plan."

Result: Retained GHS 500/mo
```

### Revenue Opportunity 3: Pro-active Outreach

```
Platform Admin monitors tenants:
- 15 tenants at >80% storage usage
- Average: 8.5 GB / 10 GB
- Contact for upgrade before they hit limit
- Convert 10 tenants → +GHS 5,000 MRR
```

---

## 🎨 UI Components

### StorageUsageCard Props:

```jsx
<StorageUsageCard 
  style={{ marginBottom: 24 }}      // Custom styling
  showUpgradeButton={true}           // Show/hide upgrade CTA
/>
```

**Auto Features:**
- ✅ Fetches usage automatically
- ✅ Shows progress bar
- ✅ Color-coded (green → yellow → red)
- ✅ Warning alerts
- ✅ Displays expansion pricing
- ✅ Responsive design

---

## 🔧 Configuration Options

### Per-Plan Customization:

**Conservative (Trial):**
```
Storage: 1 GB
Expansion: None
Message: "Upgrade to Launch for 10GB storage"
```

**Standard (Launch):**
```
Storage: 10 GB
Expansion: GHS 15 per 100GB
Message: "Add storage or upgrade to Scale"
```

**Generous (Scale):**
```
Storage: 50 GB
Expansion: GHS 12 per 100GB (discount!)
Message: "Volume discount on additional storage"
```

**Unlimited (Enterprise):**
```
Storage: Unlimited
Expansion: N/A
Message: "Unlimited storage included"
```

---

## 📈 Analytics & Monitoring

### Metrics to Track:

1. **Storage by Tenant:**
   - Average usage per plan
   - Tenants approaching limits
   - Total platform storage

2. **Upload Patterns:**
   - Files uploaded per day
   - Average file sizes
   - Upload failures due to limits

3. **Upgrade Triggers:**
   - Storage limit → Upgrade conversions
   - Success rate of storage upsells

### Platform Dashboard (Future):

```
┌────────────────────────────────────────────────┐
│ Storage Analytics                              │
├────────────────────────────────────────────────┤
│ Total Platform Storage:     2.3 TB             │
│ Average per Tenant:        15.7 GB             │
│                                                │
│ By Plan:                                       │
│ • Trial:    0.8 GB avg (80% of limit)          │
│ • Launch:   7.2 GB avg (72% of limit)          │
│ • Scale:   28.5 GB avg (57% of limit)          │
│ • Enterprise: 147 GB avg (unlimited)           │
│                                                │
│ Tenants Near Limit: 12                         │
│ Upsell Opportunity: GHS 1,200 MRR              │
└────────────────────────────────────────────────┘
```

---

## 🎯 Summary

### What You Can Now Do:

**As Platform Admin:**
✅ Set storage limits per plan (1 GB to unlimited)  
✅ Configure expansion pricing (GHS per 100GB)  
✅ View tenant storage usage  
✅ Identify upsell opportunities  
✅ Monitor platform-wide storage  

**As Tenant:**
✅ See storage usage in real-time  
✅ Get warnings before hitting limit  
✅ Clear upgrade paths when needed  
✅ Know exact costs to add storage  

**System Automation:**
✅ Enforces limits on all uploads  
✅ Blocks uploads that would exceed  
✅ Calculates usage automatically  
✅ Updates displays in real-time  

---

## 💡 Best Practices

### For Platform Admins:

1. **Set Progressive Limits:**
   - Trial: 1 GB (evaluation)
   - Launch: 10 GB (small business)
   - Scale: 50 GB (growing business)
   - Enterprise: Unlimited (large orgs)

2. **Price Storage Strategically:**
   - Match market rates (GHS 10-20 per 100GB)
   - Offer volume discounts on higher plans
   - Make upgrades more attractive than add-ons

3. **Monitor Proactively:**
   - Alert tenants at 80% usage
   - Reach out at 90% with upgrade offer
   - Prevent bad experience (hitting limits)

### For Developers:

1. **Always Use Middleware:**
   ```javascript
   router.post('/upload', checkStorageLimit, upload.single('file'), ...);
   ```

2. **Handle Errors Gracefully:**
   ```jsx
   catch (error) {
     if (error.code === 'STORAGE_LIMIT_EXCEEDED') {
       showUpgradeModal(error.details);
     }
   }
   ```

3. **Show Upload Limits:**
   ```jsx
   <Upload
     maxCount={5}
     beforeUpload={checkStorageAvailable}
   >
     <Button>Upload (Max 5 files)</Button>
   </Upload>
   ```

---

## 🔄 Future Enhancements

### 1. **File Management Dashboard**
- List all uploaded files
- Sort by size, date
- Delete unused files
- Recover storage space

### 2. **Storage Analytics**
- Usage trends over time
- Largest files
- Storage growth rate
- Forecast when limit will be reached

### 3. **Compression & Optimization**
- Auto-compress images
- Convert to efficient formats
- Deduplicate files
- Extend effective storage

### 4. **CDN Integration**
- Offload to cloud storage (S3, Cloudflare R2)
- Reduce server load
- Faster file delivery
- Scalable storage

### 5. **Cleanup Automation**
- Delete files from closed jobs after X days
- Archive old files to cheaper storage
- Automatic space recovery

---

## 🎉 Complete Feature Set

Your platform now has **3-tier resource limits**:

| Resource | Trial | Launch | Scale | Enterprise |
|----------|-------|--------|-------|------------|
| **Team Seats** | 5 | 5 (+GHS 25/seat) | 15 (+GHS 32/seat) | Unlimited |
| **Storage** | 1 GB | 10 GB (+GHS 15/100GB) | 50 GB (+GHS 12/100GB) | Unlimited |
| **Features** | 9 basic | 11 features | 13 features | All features |

**All enforced automatically! 🚀**

---

## 📋 Quick Reference

### Helper Functions:

```javascript
// Backend
const { validateStorageLimit, getStorageUsageSummary } = require('../utils/storageLimitHelper');

await validateStorageLimit(tenantId, fileSizeBytes);
const usage = await getStorageUsageSummary(tenantId);
```

### Frontend:

```jsx
// Hook (coming soon)
const { storageUsed, storageLimit, canUpload } = useStorageAccess();

// Component
<StorageUsageCard showUpgradeButton />
```

### Middleware:

```javascript
const { checkStorageLimit } = require('../middleware/upload');

router.post('/upload', checkStorageLimit, upload.single('file'), ...);
```

---

**Your storage limit system is production-ready! 💾**

Visit `/admin/settings` → "💳 Subscription Plans" to configure limits!

