# Deploy NexPro to Render - Quick Start 🚀

## Your New Architecture

✅ **Frontend**: Render Static Site  
✅ **Backend**: Render Web Service  
✅ **Database**: Neon PostgreSQL (or Render PG)  

All on Render = One dashboard to rule them all!

## Quick Deployment

### 1️⃣ Deploy Backend First

1. Go to https://render.com → **"New +"** → **"Web Service"**
2. Connect GitHub repo
3. Configure:
   - **Name**: `nexpro-backend`
   - **Root Directory**: `Backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables (see below)
5. Deploy!

Get your backend URL: `https://nexpro-backend.onrender.com`

### 2️⃣ Deploy Frontend

1. Render → **"New +"** → **"Static Site"**
2. Connect same GitHub repo
3. Configure:
   - **Name**: `nexpro-frontend`
   - **Root Directory**: `Frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL=https://nexpro-backend.onrender.com`
5. Deploy!

Get your frontend URL: `https://nexpro-frontend.onrender.com`

### 3️⃣ Configure CORS

1. Backend → Environment
2. Add:
   - `CORS_ORIGIN=https://nexpro-frontend.onrender.com`
   - `FRONTEND_URL=https://nexpro-frontend.onrender.com`
3. Manual Deploy

### 4️⃣ Run Migrations

Backend → Shell → Run: `cd Backend && npm run migrate`

### 5️⃣ Test! 🎉

Visit your frontend and login!

## Environment Variables

### Backend
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=your_neon_url
JWT_SECRET=(generate: openssl rand -base64 32)
JWT_EXPIRE=7d
CORS_ORIGIN=https://nexpro-frontend.onrender.com
FRONTEND_URL=https://nexpro-frontend.onrender.com
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### Frontend
```env
VITE_API_URL=https://nexpro-backend.onrender.com
```

## Login Credentials

- Email: `admin@printingpress.com`
- Password: `admin123`

## Cost

**Free Tier:** $0/month (750 hrs backend)  
**Production:** $7/month (always-on backend)

## Need Help?

See full guide: `DEPLOY_TO_RENDER.md`

---

**Deploy now at: https://render.com** 🚀
