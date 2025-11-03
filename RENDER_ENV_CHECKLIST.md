# ✅ Render Environment Variables Checklist

## Required Variables for Your Backend

Copy these **EXACTLY** to Render environment variables:

### 1. Database
```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```
Get this from Render PostgreSQL service → "Internal Database URL"

---

### 2. JWT Secret
```env
JWT_SECRET=your-super-secret-random-string-here
```
Generate a random string, or use: `openssl rand -base64 32`

---

### 3. Port
```env
PORT=5000
```
Default port for Render.

---

### 4. CORS (Your Frontend URL)
```env
CORS_ORIGIN=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```
**EXACT URL FROM YOUR VERCEL DASHBOARD!**

---

### 5. Frontend URL
```env
FRONTEND_URL=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```
Same as CORS_ORIGIN.

---

### 6. Node Environment
```env
NODE_ENV=production
```
---

## How to Add in Render

1. **Render Dashboard** → Your backend service
2. **Settings** tab
3. **Environment Variables** section
4. Click **"Add Environment Variable"**
5. Paste each key and value above
6. Click **"Save"**
7. Wait for auto-redeploy

---

## Quick Copy-Paste Template

```env
DATABASE_URL=YOUR_DATABASE_URL_HERE
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING
PORT=5000
CORS_ORIGIN=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
FRONTEND_URL=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
NODE_ENV=production
```

---

## Common Mistakes

❌ **Using localhost:**
```
CORS_ORIGIN=http://localhost:3000
```

✅ **Use your Vercel URL:**
```
CORS_ORIGIN=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```

---

❌ **Missing https://**
```
CORS_ORIGIN=nexpro-frontend.vercel.app
```

✅ **Include protocol:**
```
CORS_ORIGIN=https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```

---

❌ **Extra spaces:**
```
CORS_ORIGIN = https://...  (space before/after =)
```

✅ **No spaces:**
```
CORS_ORIGIN=https://...
```

---

## Verify It's Working

After saving all variables:

1. Backend should auto-redeploy
2. Check Render logs for errors
3. Test: `https://nexpro.onrender.com/health`
4. Try login on frontend
5. Should work! ✅

---

**Double-check your Vercel frontend URL is correct!** 🎯

