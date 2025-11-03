# Using Render PostgreSQL Database

## Step 1: Create Render PostgreSQL Database

### Before Creating Backend Service

1. In Render dashboard, click **"New +"**
2. Select **"PostgreSQL"**
3. Fill in:

**Settings:**
- **Name**: `nexpro-postgres` (or any name)
- **Database**: `nexpro` (or any name)
- **User**: `nexpro_user` (or any name)
- **Region**: `Oregon (US West)` (same as backend!)

**Instance Type:**
- **Free**: $0/month (for development/testing)
- **Standard**: $7/month (for production)

### Step 2: Get Connection String

After creating database:

1. Click on your database service
2. Look for **"Connections"** or **"Connection String"**
3. Copy the **"Internal Database URL"**

It looks like:
```
postgres://nexpro_user:password@dpg-xxxxxxxx-a.oregon-postgres.render.com/nexpro
```

**Note this URL!** You'll need it in a second.

---

## Step 3: Create Backend Service

Now create the backend web service as before, but use the Render database URL:

### Environment Variables

When creating backend web service, use:

```
DATABASE_URL=postgres://nexpro_user:password@dpg-xxxxx.oregon-postgres.render.com/nexpro
```

Use the **INTERNAL** URL (better performance, no SSL needed).

---

## Complete Backend Setup

### Root Directory
```
Backend
```

### Build & Start
```
Build Command: npm install
Start Command: npm start
```

### All Environment Variables

1. `PORT=5000`
2. `NODE_ENV=production`
3. `DATABASE_URL=postgres://nexpro_user:password@dpg-xxxxx.oregon-postgres.render.com/nexpro`
4. `JWT_SECRET=(generate with openssl rand -base64 32)`
5. `JWT_EXPIRE=7d`
6. `DEFAULT_PAGE_SIZE=10`
7. `MAX_PAGE_SIZE=100`

**Note:** CORS_ORIGIN and FRONTEND_URL come after frontend deploys!

---

## Benefits of Render DB

✅ **Same Dashboard** - Manage everything in one place  
✅ **Private Network** - Fast connections between services  
✅ **Automatic Backups** - On paid plans  
✅ **Simpler Setup** - Everything in Render  
✅ **Great Performance** - Optimized for Render services  

---

## Free vs Paid Database

### Free Tier
- ✅ 90 days of data retention
- ✅ 1 GB storage
- ✅ Basic features
- ⚠️ Limited connections

### Paid Tier ($7/month)
- ✅ 7 days point-in-time recovery
- ✅ Automatic backups
- ✅ More connections
- ✅ Better performance
- ✅ Production ready

**Recommendation:** Start with Free, upgrade when needed!

---

## After Database Setup

1. **Create Backend** with Render DB connection string
2. **Deploy**
3. **Run Migrations** via Shell
4. **Deploy Frontend**
5. **Configure CORS**
6. **Test!**

---

## Quick Checklist

- [ ] Create PostgreSQL service on Render
- [ ] Copy internal connection string
- [ ] Create backend web service
- [ ] Use Render DB connection string
- [ ] Add all environment variables
- [ ] Deploy backend
- [ ] Test database connection
- [ ] Ready to deploy frontend!

---

**Ready to create the database!** 🗄️

Go to: Render Dashboard → New + → PostgreSQL

