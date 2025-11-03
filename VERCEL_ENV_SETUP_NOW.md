# ⚡ FIX VERCEL ENVIRONMENT VARIABLE RIGHT NOW

## Your Error
```
POST http://localhost:5000/api/auth/login net::ERR_CONNECTION_REFUSED
```

## The Fix (3 Steps)

### Step 1️⃣: Get Backend URL
Go to Render dashboard → Your backend service → Copy the URL

Example: `https://nexpro-backend.onrender.com`

---

### Step 2️⃣: Add to Vercel

1. Go to: https://vercel.com/dashboard
2. Click your **project name**
3. Click **"Settings"** tab (top menu)
4. Click **"Environment Variables"** (left sidebar)
5. Click **"Add New"** button
6. Fill in:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://your-backend-url.onrender.com`
   - **Environment:** Select all (Production, Preview, Development)
7. Click **"Save"**

---

### Step 3️⃣: Redeploy

1. Stay on Vercel dashboard
2. Click **"Deployments"** tab (top menu)
3. Find the latest deployment
4. Click **•••** (three dots) on the right
5. Click **"Redeploy"**
6. Wait 1-2 minutes
7. Done! ✅

---

## Verify It Works

1. Refresh your Vercel site
2. Try to login
3. Should connect to backend! 🎉

---

## Visual Guide

```
Vercel Dashboard
├── Your Project
│   ├── Settings (tab)
│   │   ├── Environment Variables (left sidebar)
│   │   │   ├── Add New (button)
│   │   │   │   ├── Key: VITE_API_URL
│   │   │   │   ├── Value: https://...
│   │   │   │   ├── Save (button)
│   │
│   ├── Deployments (tab)
│   │   ├── Latest deployment
│   │   │   ├── ••• (menu)
│   │   │   │   ├── Redeploy
```

---

## Common Mistakes

❌ **Wrong Key:**
- `API_URL` 
- `REACT_APP_API_URL`
- `BACKEND_URL`

✅ **Correct Key:**
- `VITE_API_URL`

---

❌ **Wrong Value:**
- `localhost:5000`
- `http://localhost:5000`
- Just the domain without https

✅ **Correct Value:**
- `https://nexpro-backend.onrender.com`

---

❌ **Forgot to Redeploy**
Environment variables only apply after redeploy!

✅ **Always Redeploy** after changing env vars

---

## Quick Checklist

- [ ] Found backend URL in Render
- [ ] Added `VITE_API_URL` to Vercel
- [ ] Set correct value with https://
- [ ] Selected all environments
- [ ] Saved the variable
- [ ] Redeployed frontend
- [ ] Tested login

---

**That's it! 3 steps, 2 minutes!** ⚡

