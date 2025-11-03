# 🔗 Fix Invite Links to Use Production URL

## The Issue

Invite links are being generated with `localhost:3000` instead of your production URL!

## The Fix

You need to set `FRONTEND_URL` in your **Render backend environment variables** to your Vercel URL.

---

## Step-by-Step

### 1. Go to Render Dashboard

https://dashboard.render.com

### 2. Find Your Backend Service

Click on your backend service (e.g., "nexpro" or similar)

### 3. Go to Settings

Click **"Settings"** tab at the top

### 4. Environment Variables

Scroll to **"Environment Variables"** section

### 5. Update FRONTEND_URL

Find `FRONTEND_URL` or add it:

**Key:** `FRONTEND_URL`

**Value:** `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`

**Important:** This must be your exact Vercel URL! No trailing slash!

### 6. Save

Click **"Save Changes"**

### 7. Backend Will Auto-Redeploy

Wait 2-3 minutes for redeploy

---

## Verify It's Fixed

### Test the Invite Flow

1. Login as admin
2. Go to Users page
3. Click "Invite User"
4. Fill in details
5. Copy the invite link
6. **Check the link** - should start with `https://nexpro-frontend-...` NOT `http://localhost:3000`

---

## All Environment Variables Needed

While you're in Render settings, make sure you have ALL of these:

```env
DATABASE_URL=postgresql://... (from your Render PostgreSQL)
JWT_SECRET=your-random-secret-key-here
PORT=5000
CORS_ORIGIN=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
FRONTEND_URL=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
NODE_ENV=production
```

**Both `CORS_ORIGIN` and `FRONTEND_URL` should be your Vercel URL!**

---

## How It Works

The backend uses the `FRONTEND_URL` environment variable to generate invite links:

```javascript
const inviteLink = `${process.env.FRONTEND_URL}/signup?token=${token}`;
```

So make sure Render has the correct `FRONTEND_URL` set!

---

## Visual Guide

```
Render Dashboard
├── Your Backend Service
│   ├── Settings
│   │   ├── Environment Variables
│   │   │   ├── FRONTEND_URL
│   │   │   │   └── Value: https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
│   │   │   └── [Save Changes]
│   │   └── [Auto-redeploys]
```

---

## Common Mistakes

### Wrong URL
❌ `http://localhost:3000`  
❌ `localhost:3000`  
❌ `https://nexpro-frontend.vercel.app` (wrong subdomain!)

✅ `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`

### Trailing Slash
❌ `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app/`

✅ `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`

### Old Value Cached
❌ Forgot to redeploy after changing  
✅ Backend auto-redeploys when you save

---

## Still Not Working?

1. Check Render logs for errors
2. Verify the exact Vercel URL from your Vercel dashboard
3. Make sure backend redeployed (check status)
4. Test by generating a new invite

---

**That's it! Now invite links will use production URL!** ✅

