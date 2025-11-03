# Deploy NexPro to Render - Complete Guide 🚀

## Architecture on Render

✅ **Frontend**: Render Static Site  
✅ **Backend**: Render Web Service  
✅ **Database**: Render PostgreSQL (or Neon)  

All on Render = Simple deployment!

## Prerequisites

1. Render account: https://render.com
2. GitHub repository connected
3. Neon database (or use Render's PostgreSQL)

## Deployment Overview

We'll deploy in this order:
1. **Backend** (Web Service)
2. **Frontend** (Static Site)
3. **Database** (PostgreSQL - optional, can use Neon)

---

## Part 1: Deploy Backend

### Step 1: Create Web Service

1. Go to https://render.com/dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo

### Step 2: Configure Backend

**Basic Settings:**
- **Name**: `nexpro-backend`
- **Region**: Choose closest to you
- **Branch**: `master` (or `main`)
- **Root Directory**: `Backend`

**Build & Deploy:**
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 3: Add Environment Variables

Click **"Advanced"** → Add each variable:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=(will add after database setup)
JWT_SECRET=(generate below)
JWT_EXPIRE=7d
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

### Step 4: Deploy Backend

Click **"Create Web Service"**

Wait 3-5 minutes. Your backend will be at:
```
https://nexpro-backend.onrender.com
```

**Note the URL!** We'll need it for frontend.

---

## Part 2: Setup Database

### Option A: Use Neon (Recommended - Already Have It!)

Keep your existing Neon database. Just add the connection string:

```env
DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/database
```

**Where to add:** Backend service → Environment → `DATABASE_URL`

### Option B: Use Render PostgreSQL (Alternative)

1. Render dashboard → **"New +"** → **"PostgreSQL"**
2. Configure:
   - Name: `nexpro-db`
   - Database: `nexpro`
   - User: `nexpro_user`
   - Region: Same as backend
3. Get connection string from dashboard
4. Add to backend as `DATABASE_URL`

---

## Part 3: Deploy Frontend

### Step 1: Create Static Site

1. Render dashboard → **"New +"** → **"Static Site"**
2. Connect GitHub repo

### Step 2: Configure Frontend

**Basic Settings:**
- **Name**: `nexpro-frontend`
- **Branch**: `master` (or `main`)
- **Root Directory**: `Frontend`

**Build & Deploy:**
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### Step 3: Add Environment Variables

Click **"Advanced"** → Add:

```env
VITE_API_URL=https://nexpro-backend.onrender.com
```

**Important:** Use your actual backend URL from Part 1!

### Step 4: Deploy Frontend

Click **"Create Static Site"**

Wait 2-3 minutes. Your frontend will be at:
```
https://nexpro-frontend.onrender.com
```

---

## Part 4: Configure CORS

### Update Backend CORS Settings

1. Go to backend service on Render
2. Environment → Add/Update:

```env
CORS_ORIGIN=https://nexpro-frontend.onrender.com
FRONTEND_URL=https://nexpro-frontend.onrender.com
```

3. Manual Deploy → Deploy latest commit

---

## Part 5: Run Migrations

### From Render Shell

1. Backend service → Shell tab
2. Run:
   ```bash
   cd Backend
   npm run migrate
   ```

### Or From Local

```bash
cd Backend
# Ensure .env has correct DATABASE_URL
npm run migrate
```

---

## Part 6: Test Everything! 🎉

### 1. Test Backend

Visit: `https://nexpro-backend.onrender.com/health`

Should see: `{"success":true,"message":"Server is running"}`

### 2. Test Frontend

Visit: `https://nexpro-frontend.onrender.com`

### 3. Test Login

- Email: `admin@printingpress.com`
- Password: `admin123`

### 4. Verify All Features

- ✅ Dashboard loads
- ✅ Navigation works
- ✅ Create/edit/delete records
- ✅ Profile page
- ✅ All CRUD operations

---

## Configuration Summary

### Backend Environment Variables
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=your_database_url
JWT_SECRET=your_generated_secret
JWT_EXPIRE=7d
CORS_ORIGIN=https://nexpro-frontend.onrender.com
FRONTEND_URL=https://nexpro-frontend.onrender.com
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### Frontend Environment Variables
```env
VITE_API_URL=https://nexpro-backend.onrender.com
```

---

## Important Notes

### Free Tier Behavior

**Backend:**
- ⏰ Auto-sleeps after 15 min inactivity
- 🐌 Cold start takes ~30 seconds
- 💡 Paid plan ($7/mo) = always-on

**Frontend:**
- ⚡ Always fast
- ✅ No cold starts
- 🎉 Free tier is great!

**Database:**
- Neon: Free tier available
- Render PG: $7/month, but managed

### Auto-Deploy

Both frontend and backend auto-deploy on every git push!

### Monitoring

- View logs in real-time
- CPU & memory usage
- Request metrics
- Error tracking

---

## Troubleshooting

### Backend Won't Start

**Check:**
1. Build logs for errors
2. All environment variables set
3. `npm start` works locally
4. Database URL is correct

### Database Connection Errors

**Check:**
1. `DATABASE_URL` format is correct
2. Database is accessible
3. SSL enabled (for Neon)
4. Migrations run

### CORS Errors

**Check:**
1. `CORS_ORIGIN` matches frontend URL exactly
2. Protocol included (https://)
3. No trailing slash
4. Backend redeployed after changes

### Frontend Can't Reach Backend

**Check:**
1. `VITE_API_URL` is correct
2. Backend is running (check health endpoint)
3. No typos in URLs
4. Browser console for errors

### 401 Authentication Errors

**Check:**
1. `JWT_SECRET` is set
2. Token stored in localStorage
3. Backend logs for errors

---

## Cost Breakdown

### Free Tier
- Frontend (Static): **Free**
- Backend (Web Service): **Free** (750 hrs/month)
- Database (Neon): **Free**
- **Total: $0/month**

### Production Tier
- Frontend (Static): **Free**
- Backend (Starter): **$7/month** (always-on, better performance)
- Database (Neon Free): **Free**
- **Total: $7/month**

### Premium Tier
- Frontend (Static): **Free**
- Backend (Professional): **$25/month**
- Database (Render PG): **$7/month** (managed)
- **Total: $32/month**

---

## Next Steps After Deployment

### 1. Security
- [ ] Change admin password
- [ ] Rotate JWT secret
- [ ] Review security headers
- [ ] Set up monitoring alerts

### 2. Production Hardening
- [ ] Enable backups
- [ ] Set up staging environment
- [ ] Configure custom domain
- [ ] Add rate limiting
- [ ] Set up error tracking (Sentry)

### 3. Maintenance
- [ ] Schedule regular backups
- [ ] Monitor performance
- [ ] Update dependencies regularly
- [ ] Review logs weekly

### 4. Optional Enhancements
- [ ] Add analytics
- [ ] Set up CI/CD
- [ ] Configure CDN
- [ ] Add caching layer

---

## URL Summary

After deployment, you'll have:

- **Frontend**: https://nexpro-frontend.onrender.com
- **Backend**: https://nexpro-backend.onrender.com
- **Health Check**: https://nexpro-backend.onrender.com/health
- **API Docs**: https://nexpro-backend.onrender.com/

---

## Support

### Documentation
- Render Docs: https://render.com/docs
- Your Project: Check logs in dashboard

### Useful Links
- Render Status: https://status.render.com
- Render Community: https://community.render.com
- Your Logs: Dashboard → Service → Logs

---

## Deployment Checklist

- [ ] Backend deployed successfully
- [ ] Database configured and accessible
- [ ] Frontend deployed successfully
- [ ] Environment variables set
- [ ] CORS configured
- [ ] Migrations run
- [ ] Health check returns 200
- [ ] Frontend loads without errors
- [ ] Login works
- [ ] All features tested
- [ ] No console errors
- [ ] Performance acceptable

---

**🎉 Congratulations! Your NexPro app is live on Render!**

For quick reference, see: `DEPLOY_TO_RENDER_NOW.md`

