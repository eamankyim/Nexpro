# 🎯 READ THIS FIRST

## Your Question

"How do we get admin credentials in the db without Render Shell?"

## Answer

**Run the setup commands on YOUR computer** - it connects to your production database!

---

## Your Exact Next Steps

### 1. Get Database URL

Render Dashboard → PostgreSQL → Settings → **Internal Database URL**  
COPY IT!

### 2. Update .env

Open `Backend/.env`  
Replace `DATABASE_URL=...` with your real URL  
SAVE!

### 3. Run Commands

Open PowerShell in `Backend` folder:

```bash
npm run migrate
npm run seed-admin
```

### 4. Login

- Email: `admin@printingpress.com`
- Password: `admin123`

---

## Also Set These in Render

Go to your backend service → Settings → Environment Variables:

```
CORS_ORIGIN=https://your-vercel-frontend-url.vercel.app
FRONTEND_URL=https://your-vercel-frontend-url.vercel.app
```

Then redeploy!

---

## Guide by Need

**Can't find database?**  
→ `FIX_DATABASE_URL_NOW.md`

**Need detailed setup?**  
→ `CREATE_ADMIN_PRODUCTION.md`

**CORS error?**  
→ `FIX_CORS_ERROR.md`

**Invite links broken?**  
→ `FIX_INVITE_LINKS.md`

**Want full deployment?**  
→ `READY_TO_DEPLOY.md`

---

## Ready?

**Go to:** `FIX_DATABASE_URL_NOW.md`  
**Follow:** The 3 steps  
**Done!** ✅

---

**You got this!** 🚀

