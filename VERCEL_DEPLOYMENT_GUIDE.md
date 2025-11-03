# Vercel Deployment Guide

## Overview
This guide will help you deploy the NexPro Printing Press Management System frontend to Vercel.

## Prerequisites
1. A Vercel account (sign up at https://vercel.com)
2. Backend API deployed and accessible (e.g., Railway, Render, Heroku, or your own server)
3. PostgreSQL database (we recommend Neon)
4. Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Deploy Backend First

**Important**: The backend must be deployed BEFORE the frontend.

### Option A: Deploy to Railway (Recommended)
1. Sign up at https://railway.app
2. Create a new project
3. Add PostgreSQL database service
4. Add Node.js service and connect to your GitHub repo
5. Set root directory to `Backend`
6. Add environment variables (see below)
7. Deploy!

### Option B: Deploy to Render
1. Sign up at https://render.com
2. Create a new Web Service
3. Connect your GitHub repo
4. Set root directory to `Backend`
5. Add environment variables
6. Deploy!

### Backend Environment Variables
Add these in your backend hosting platform:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_secure_jwt_secret
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-vercel-frontend.vercel.app
FRONTEND_URL=https://your-vercel-frontend.vercel.app
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

**Important**: Generate a strong JWT_SECRET:
```bash
openssl rand -base64 32
```

## Step 2: Deploy Frontend to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Prepare Your Repository**
   ```bash
   cd Frontend
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your Git repository
   - Configure project:
     - **Framework Preset**: Vite
     - **Root Directory**: `Frontend` (important!)
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

3. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   VITE_API_URL=https://your-backend-api.railway.app
   ```
   (Replace with your actual backend URL)

4. **Deploy!**
   Click "Deploy" and wait for build to complete

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   cd Frontend
   vercel
   ```

4. **Add Environment Variables**
   ```bash
   vercel env add VITE_API_URL
   # Enter: https://your-backend-api.railway.app
   ```

5. **Redeploy with env vars**
   ```bash
   vercel --prod
   ```

## Step 3: Update Backend CORS

After deploying the frontend, update your backend CORS_ORIGIN to include the new Vercel URL:

```env
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
```

Redeploy the backend after changing these variables.

## Step 4: Configure Custom Domain (Optional)

1. Go to your Vercel project settings
2. Click "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions
5. Update `FRONTEND_URL` in backend environment variables

## Step 5: Run Database Migrations

After backend is deployed, run migrations:

```bash
# Via SSH (if supported by your hosting platform)
cd Backend
npm run migrate

# Or use your hosting platform's console/terminal
```

## Post-Deployment Checklist

- [ ] Backend is accessible and responding
- [ ] Frontend can connect to backend API
- [ ] Database migrations are complete
- [ ] Admin user can log in (credentials from seed or reset script)
- [ ] SSL certificates are valid (HTTPS)
- [ ] CORS is configured correctly
- [ ] Environment variables are set correctly
- [ ] Build logs show no errors

## Troubleshooting

### Frontend can't connect to backend
- Verify `VITE_API_URL` is set correctly in Vercel
- Check backend CORS settings include Vercel domain
- Ensure backend is accessible (test in browser)

### 401 Unauthorized errors
- Check JWT_SECRET is set in backend
- Verify token is being stored in localStorage
- Check backend logs for authentication errors

### Database connection errors
- Verify DATABASE_URL is set correctly
- Check database is accessible from your hosting platform
- Ensure database migrations have been run

### Build fails on Vercel
- Check build logs in Vercel dashboard
- Verify Node.js version is compatible
- Ensure all dependencies are in package.json
- Check for TypeScript errors if applicable

## Environment Variables Reference

### Frontend (Vercel)
| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Backend API URL | `https://nexpro-api.railway.app` |

### Backend (Railway/Render/etc)
| Variable | Value | Example |
|----------|-------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://...` |
| `JWT_SECRET` | JWT signing key | `your-secret-key` |
| `JWT_EXPIRE` | Token expiration | `7d` |
| `CORS_ORIGIN` | Allowed origins | `https://nexpro.vercel.app` |
| `FRONTEND_URL` | Frontend URL | `https://nexpro.vercel.app` |
| `DEFAULT_PAGE_SIZE` | Pagination default | `10` |
| `MAX_PAGE_SIZE` | Pagination max | `100` |

## Monitoring

### Vercel Analytics
Enable Vercel Analytics for your project to monitor performance and usage.

### Backend Logs
Check logs regularly:
- Railway: Project → Deployments → View Logs
- Render: Dashboard → Logs tab

## Security Notes

1. **Never commit `.env` files** to Git
2. **Use strong JWT secrets** (generate with openssl)
3. **Enable HTTPS** everywhere
4. **Keep dependencies updated** regularly
5. **Monitor logs** for suspicious activity
6. **Use environment-specific configurations**

## Support

If you encounter issues:
1. Check build/deployment logs
2. Verify all environment variables are set
3. Test API endpoints with Postman/curl
4. Review browser console for frontend errors
5. Check database connection status

## Next Steps

After successful deployment:
1. Update admin password from default
2. Create production user accounts via invite links
3. Set up automated backups for database
4. Configure monitoring and alerts
5. Set up CI/CD for automated deployments

---

**Happy Deploying! 🚀**

