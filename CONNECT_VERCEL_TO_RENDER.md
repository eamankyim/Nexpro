# Connect Vercel Frontend to Render Backend ✅

## Your Setup

✅ **Frontend**: Vercel (https://nexpro-frontend.vercel.app)  
✅ **Backend**: Render (you just deployed it!)

## Step 1: Find Your Backend URL

Your backend should be at something like:
```
https://nexpro-backend.onrender.com
```

Or check Render dashboard for exact URL.

## Step 2: Update Vercel Frontend

### Go to Vercel Dashboard

1. https://vercel.com/dashboard
2. Click on `nexpro-frontend` project
3. Go to **Settings** → **Environment Variables**

### Add/Update Variable

**Variable Name:**
```
VITE_API_URL
```

**Value:**
```
https://your-backend-url.onrender.com
```

Replace with your actual Render backend URL!

### Save & Redeploy

1. Click **"Save"**
2. Go to **Deployments** tab
3. Click **"Redeploy"** on latest deployment
4. Wait for rebuild

## Step 3: Update Render Backend CORS

### In Render Dashboard

1. Go to your `nexpro-backend` service
2. Settings → **Environment Variables**
3. Add/Update these:

**Variable 1:**
```
CORS_ORIGIN
Value: https://nexpro-frontend.vercel.app
```

**Variable 2:**
```
FRONTEND_URL
Value: https://nexpro-frontend.vercel.app
```

### Manual Deploy

1. Go to **Manual Deploy** tab
2. Click **"Deploy latest commit"**
3. Wait for redeploy

## Step 4: Run Database Migrations

### Via Render Shell

1. Go to backend service → **Shell** tab
2. Run:
   ```bash
   cd Backend
   npm run migrate
   ```

### Or Via Local

```bash
cd Backend
# Make sure .env has correct DATABASE_URL
npm run migrate
```

## Step 5: Test Everything! 🎉

### 1. Test Backend
Visit: `https://your-backend.onrender.com/health`

Should see: `{"success":true,"message":"Server is running"}`

### 2. Test Frontend
Visit: https://nexpro-frontend.vercel.app

### 3. Test Login
- Email: `admin@printingpress.com`
- Password: `admin123`

### 4. Verify Features
- ✅ Dashboard loads
- ✅ Navigation works
- ✅ API calls succeed
- ✅ No CORS errors

## Troubleshooting

### CORS Errors

**Check:**
- `CORS_ORIGIN` in Render matches frontend URL exactly
- Backend redeployed after adding CORS variables
- No trailing slashes
- Includes `https://`

### Can't Reach Backend

**Check:**
- `VITE_API_URL` in Vercel is correct
- Backend is running (check health endpoint)
- No typos in URL
- Browser console for errors

### Database Errors

**Check:**
- `DATABASE_URL` is correct
- Migrations have been run
- Database is accessible

## Summary

1. ✅ Backend deployed to Render
2. ⏳ Update Vercel `VITE_API_URL` → Backend Render URL
3. ⏳ Update Render `CORS_ORIGIN` → Frontend Vercel URL
4. ⏳ Update Render `FRONTEND_URL` → Frontend Vercel URL
5. ⏳ Run migrations
6. ⏳ Test!

---

**Almost there! Connect them together!** 🚀


