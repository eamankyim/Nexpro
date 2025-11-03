# Quick Deploy to Vercel

## Pre-Flight Checklist ✅

### 1. Backend Environment Variables
Make sure you have these ready:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `CORS_ORIGIN` - Will be `https://your-app.vercel.app` (update after frontend deploy)
- `FRONTEND_URL` - Same as CORS_ORIGIN
- `NODE_ENV` - Set to `production`

### 2. Frontend Environment Variables
- `VITE_API_URL` - Your backend URL (e.g., `https://nexpro-api.railway.app`)

## Deployment Steps

### Step 1: Deploy Backend to Vercel ⚡

**Since you're using Neon database, you can deploy BOTH frontend and backend to Vercel!**

**Via Dashboard:**
```
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Click on "Backend" project settings OR create separate project
4. Configure:
   - Framework Preset: Other
   - Root Directory: Backend
5. Add ALL environment variables (see below)
6. Deploy!
```

**Via CLI:**
```bash
cd Backend
npm i -g vercel
vercel login
vercel
# Add all environment variables when prompted
vercel --prod
```

**Required Environment Variables:**
```env
DATABASE_URL=your_neon_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

**Alternative: Railway or Render**
If you prefer traditional hosting:
- **Railway**: https://railway.app
- **Render**: https://render.com

### Step 2: Deploy Frontend to Vercel

**Via Dashboard:**
```
1. Go to https://vercel.com/new
2. Import your GitHub repo (same repo or create new)
3. Configure:
   - Framework Preset: Vite
   - Root Directory: Frontend
   - Build Command: npm run build
   - Output Directory: dist
4. Add Environment Variable:
   Name: VITE_API_URL
   Value: https://your-backend-project.vercel.app
5. Click Deploy
```

**Via CLI:**
```bash
cd Frontend
vercel
# Enter VITE_API_URL when prompted
vercel --prod
```

### Step 3: Update Backend CORS

After frontend deploys, get your Vercel URL and update backend:
```env
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Redeploy backend.

### Step 4: Run Migrations

**For Vercel Backend:**
Since Vercel is serverless, you need to run migrations locally or via a script:
```bash
# Make sure DATABASE_URL is set in your local .env
cd Backend
npm run migrate
```

**For Railway/Render:**
SSH into your backend or use hosting console:
```bash
cd Backend
npm run migrate
```

### Step 5: Test!

1. Visit your Vercel URL
2. Login with admin credentials
3. Verify all features work
4. Check browser console for errors

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't connect to API | Check VITE_API_URL and CORS_ORIGIN |
| 401 errors | Verify JWT_SECRET is set |
| Database errors | Run migrations and check DATABASE_URL |
| Build fails | Check build logs, verify Node version |

## Production URLs Summary

After deployment, you should have:

- **Frontend**: `https://nexpro-frontend.vercel.app` (or your custom domain)
- **Backend**: `https://nexpro-backend.vercel.app` (or your hosting platform)
- **Database**: Neon PostgreSQL (cloud-hosted)

## Next Steps

1. Change admin password from default
2. Configure custom domain
3. Set up monitoring
4. Enable automated backups
5. Review security settings

## Support

See `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions.

---

**You're all set! 🎉**

