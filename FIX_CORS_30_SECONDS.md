# ⚡ Fix CORS in 30 Seconds

## Your Error
Backend allows `localhost:3000`, but frontend is on Vercel!

## Fix Now:

1. Go to: https://dashboard.render.com
2. Click your backend service
3. Click **"Settings"**
4. Find **"Environment Variables"**
5. Update these:

```
CORS_ORIGIN = https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
FRONTEND_URL = https://nexpro-frontend-ihb5th9gf-eric-amankyims-projects.vercel.app
```

6. Click **"Save"**
7. Wait for auto-redeploy (2 minutes)
8. Done! ✅

---

**That's it!** 🎯

