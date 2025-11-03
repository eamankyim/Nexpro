# 🔧 FIX: Vercel Pointing to Localhost

## Problem
Frontend on Vercel is trying to connect to `http://localhost:5000` instead of your Render backend.

## Solution

### Step 1: Get Your Backend URL
1. Go to https://dashboard.render.com
2. Click your backend service
3. Copy the service URL (e.g., `https://nexpro-backend.onrender.com`)

### Step 2: Update Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Click your **frontend project**
3. Click **Settings** tab
4. Click **Environment Variables** in left sidebar
5. Look for `VITE_API_URL`

**If it exists:**
- Click **Edit** (pencil icon)
- Change value to: `https://your-backend-url.onrender.com`
- Click **Save**

**If it doesn't exist:**
- Click **"Add New"**
- Variable Name: `VITE_API_URL`
- Value: `https://your-backend-url.onrender.com`
- Click **"Save"**

### Step 3: Redeploy

1. Go to **Deployments** tab in Vercel
2. Find latest deployment
3. Click **•••** (three dots)
4. Click **"Redeploy"**
5. Wait for rebuild (~1-2 minutes)

### Step 4: Test

1. Refresh your Vercel frontend
2. Try to login
3. Should work now! ✅

---

## Common Mistakes ❌

### Wrong Variable Name
**❌ Wrong:**
```
API_URL
REACT_APP_API_URL
BACKEND_URL
```

**✅ Correct:**
```
VITE_API_URL
```

### Wrong Format
**❌ Wrong:**
```
localhost:5000
http://localhost:5000
your-backend.onrender.com
```

**✅ Correct:**
```
https://nexpro-backend.onrender.com
```

### Forgot to Redeploy
After changing env vars, you MUST redeploy!

---

## Quick Check

Your frontend code should read:
```javascript
VITE_API_URL
```

Make sure your Vite config uses this correctly:
```javascript
VITE_API_URL=https://your-backend.onrender.com
```

---

## Still Not Working?

1. Check Vercel logs during deployment
2. Verify backend is running (visit backend URL)
3. Check browser console for exact error
4. Verify CORS settings on backend

---

**That's it!** 🚀

