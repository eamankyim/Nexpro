# Deploy NexPro Now! 🚀

## Quick Start

The Vercel CLI is now installed and ready!

## Option 1: Deploy via Dashboard (Easiest)

### Backend
1. Go to: https://vercel.com/new
2. Import GitHub repository
3. Configure:
   - **Root Directory**: `Backend`
   - **Framework Preset**: Other
4. Add environment variables
5. Deploy!

### Frontend
1. Go to: https://vercel.com/new
2. Import same GitHub repository
3. Configure:
   - **Root Directory**: `Frontend`
   - **Framework Preset**: Vite
4. Add `VITE_API_URL`
5. Deploy!

## Option 2: Deploy via CLI

### Login first:
```bash
vercel login
```

### Deploy Backend:
```bash
cd Backend
vercel
# Follow prompts to add environment variables
vercel --prod
```

### Deploy Frontend:
```bash
cd Frontend
vercel
# Follow prompts to add VITE_API_URL
vercel --prod
```

## Environment Variables Needed

### Backend
```env
DATABASE_URL=your_neon_postgres_connection
JWT_SECRET=generate_with_openssl_rand_base64_32
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### Frontend
```env
VITE_API_URL=https://your-backend.vercel.app
```

## After Deployment

1. Run migrations:
   ```bash
   cd Backend
   npm run migrate
   ```

2. Test the app

3. Change admin password

4. Start using! 🎉

---

**Need help? Check `QUICK_DEPLOY.md` or `VERCEL_DEPLOYMENT_GUIDE.md`**

