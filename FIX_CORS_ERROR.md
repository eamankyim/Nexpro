# 🔧 FIX: CORS Error on Render

## The Problem

```
'Access-Control-Allow-Origin' header has a value 'http://localhost:3000'
that is not equal to the supplied origin.
```

Your backend is still using `localhost:3000` instead of your Vercel URL!

---

## The Fix (2 Minutes)

### Step 1: Get Your Vercel URL

Your frontend is at:
```
https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```

Or check your Vercel dashboard for the exact URL.

---

### Step 2: Update Render Environment Variables

1. Go to: https://dashboard.render.com
2. Click your **backend service** (nexpro.onrender.com)
3. Click **"Settings"** tab
4. Scroll down to **"Environment Variables"**
5. Find `CORS_ORIGIN`

**If it exists:**
- Click **Edit** (pencil icon)
- Change value to: `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`
- Click **"Save"**

**If it doesn't exist:**
- Click **"Add Environment Variable"**
- Key: `CORS_ORIGIN`
- Value: `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`
- Click **"Save"**

---

### Step 3: Update FRONTEND_URL Too

While you're there, also add/update:

**Key:** `FRONTEND_URL`  
**Value:** `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`

Click **"Save"**

---

### Step 4: Redeploy Backend

1. Go to **"Manual Deploy"** tab in Render
2. Click **"Deploy latest commit"**
3. Wait 2-3 minutes for redeploy

OR

Your backend should auto-redeploy when you save environment variables!

---

### Step 5: Test

1. Refresh your Vercel frontend
2. Try to login
3. Should work! ✅

---

## Visual Guide

```
Render Dashboard
├── nexpro.onrender.com (backend service)
│   ├── Settings
│   │   ├── Environment Variables
│   │   │   ├── CORS_ORIGIN
│   │   │   │   └── Value: https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
│   │   │   ├── FRONTEND_URL
│   │   │   │   └── Value: https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
│   │   │   └── [Save Changes]
```

---

## Common Mistakes

### Wrong Value Type
❌ `http://nexpro-frontend.vercel.app` (no https)  
❌ `localhost:3000`  
❌ `http://localhost:3000`  
✅ `https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app`

### Forgot to Redeploy
❌ Changing env vars but not redeploying  
✅ Auto-redeploys on save, or manually redeploy

### Typo in URL
❌ Missing `https://`  
❌ Extra spaces  
❌ Wrong domain

---

## Complete Environment Variables Checklist

Make sure these are set in Render:

```
DATABASE_URL = [your PostgreSQL connection string]
JWT_SECRET = [your secret key]
PORT = 5000
CORS_ORIGIN = https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
FRONTEND_URL = https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
NODE_ENV = production
```

---

## Still Not Working?

1. **Check logs:** Render dashboard → Logs tab
2. **Verify URL:** Copy exact Vercel URL (check for typos)
3. **Wait longer:** Redeploy can take 3-5 minutes
4. **Clear cache:** Hard refresh frontend (Ctrl+Shift+R)

---

## Test Your Backend CORS

After redeploy, test this:

Go to: `https://nexpro.onrender.com/health`

Should return JSON, not an error.

---

**That should fix it!** ✅

