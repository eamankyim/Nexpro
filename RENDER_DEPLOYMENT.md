# Deploy to Render Guide 🚀

## Quick Deploy to Render

Render is perfect for your Express + PostgreSQL setup!

## Step 1: Create Render Account

1. Sign up at https://render.com (or login)
2. Connect your GitHub account

## Step 2: Deploy Backend to Render

### Create Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

**Settings:**
- **Name**: `nexpro-backend` (or your preferred name)
- **Region**: Choose closest to you
- **Branch**: `master` (or `main`)
- **Root Directory**: `Backend`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Environment Variables

Add these in the Render dashboard:

```env
PORT=5000
NODE_ENV=production
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
CORS_ORIGIN=https://nexpro-frontend.vercel.app
FRONTEND_URL=https://nexpro-frontend.vercel.app
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### Generate JWT Secret

```bash
openssl rand -base64 32
```

### Deploy!

Click **"Create Web Service"** and wait for deployment.

Your backend URL will be: `https://nexpro-backend.onrender.com` (or your custom name)

## Step 3: Run Database Migrations

After backend deploys, run migrations:

### Option 1: Via Render Shell (Recommended)

1. Go to your service on Render
2. Click **"Shell"** tab
3. Run:
   ```bash
   cd Backend
   npm run migrate
   ```

### Option 2: From Local Machine

```bash
cd Backend
# Make sure .env has DATABASE_URL set to Neon
npm run migrate
```

## Step 4: Update Frontend Configuration

Since frontend is on Vercel, update the environment variable:

1. Go to Vercel dashboard → Frontend project → Settings → Environment Variables
2. Update `VITE_API_URL` to: `https://your-backend-name.onrender.com`

Or if using different name, check your Render dashboard for the exact URL.

## Step 5: Update Backend CORS

After you know your frontend URL:

1. Go to Render dashboard → Your backend → Environment
2. Update:
   - `CORS_ORIGIN`: Your frontend URL
   - `FRONTEND_URL`: Your frontend URL
3. Manual Deploy (trigger redeploy)

## Step 6: Test Everything!

1. Visit your frontend: https://nexpro-frontend.vercel.app
2. Try to login:
   - Email: `admin@printingpress.com`
   - Password: `admin123`
3. Test all features

## Render Features

### Free Tier Includes:
- ✅ 750 hours/month free
- ✅ Automatic SSL
- ✅ Auto-deploy on git push
- ✅ Logs and monitoring
- ✅ Built-in database support
- ✅ Custom domains

### Paid Plan Benefits:
- ⚡ No spin-down (always on)
- ⚡ Faster performance
- ⚡ Team features
- ⚡ Priority support

## Important Notes

### Free Tier Auto Sleep
- Services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds
- Consider paid plan for production (starts at $7/month)

### Health Checks
Render automatically pings your service every few minutes to prevent sleep.

### Deployments
- Auto-deploy on every git push to connected branch
- Can also trigger manual deploys from dashboard
- Build logs visible in real-time

## Environment Variables Summary

### Backend (Render)
- `PORT` - 5000
- `NODE_ENV` - production
- `DATABASE_URL` - Neon PostgreSQL connection
- `JWT_SECRET` - Generated secret
- `JWT_EXPIRE` - 7d
- `CORS_ORIGIN` - Frontend URL
- `FRONTEND_URL` - Frontend URL
- `DEFAULT_PAGE_SIZE` - 10
- `MAX_PAGE_SIZE` - 100

### Frontend (Vercel)
- `VITE_API_URL` - Backend Render URL

## Monitoring

### View Logs
1. Go to Render dashboard
2. Click on your service
3. Click **"Logs"** tab
4. Real-time logs visible

### View Metrics
- CPU usage
- Memory usage
- Request count
- Response times

## Troubleshooting

### Service Won't Start
- Check logs for errors
- Verify environment variables
- Ensure `npm start` works locally

### Can't Connect to Database
- Verify `DATABASE_URL` is correct
- Check Neon database is accessible
- Ensure SSL is configured

### Timeout Issues
- Free tier has 10-second HTTP timeout
- Upgrade to paid for 60-second timeout
- Consider optimizing slow queries

### CORS Errors
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Include protocol (https://)
- No trailing slash

## Production Recommendations

### For Production Use:
1. **Upgrade to Paid Plan** - No spin-down, better performance
2. **Use Custom Domain** - Setup in Render + DNS
3. **Enable Monitoring** - Set up alerts
4. **Regular Backups** - Configure Neon automatic backups
5. **Security Headers** - Already configured via Helmet
6. **Rate Limiting** - Consider adding if needed

### Optional Add-ons:
- **Redis Cache** - For session storage (Render add-on)
- **Log Drains** - Send logs to external service
- **Custom Metrics** - Track business metrics

## Cost Estimate

### Free Tier
- Backend: Free (750 hours/month)
- Frontend: Free on Vercel
- Database: Free on Neon
- **Total: $0/month**

### Paid Tier (Production)
- Backend: $7/month (Starter plan)
- Frontend: Free on Vercel
- Database: Free on Neon
- **Total: $7/month**

## Deployment Complete! 🎉

Once deployed, you'll have:
- ✅ Backend: `https://your-backend.onrender.com`
- ✅ Frontend: `https://nexpro-frontend.vercel.app`
- ✅ Database: Neon PostgreSQL
- ✅ All features working!

## Next Steps

1. Change admin password
2. Create production users via invite system
3. Set up custom domain (optional)
4. Configure monitoring and alerts
5. Review security settings

---

**Need help? Check Render docs: https://render.com/docs**

