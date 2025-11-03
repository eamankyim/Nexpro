# Post-Deployment Checklist ✅

## Your Deployed URLs

- **Frontend**: https://nexpro-frontend.vercel.app/
- **Backend**: https://nexpro-backend.vercel.app/

## Critical Checks

### 1. Backend is Running ⚡

Test these endpoints in your browser:

- **Health Check**: https://nexpro-backend.vercel.app/health
  - Should return: `{"success": true, "message": "Server is running", "environment": "production"}`

- **Root Endpoint**: https://nexpro-backend.vercel.app/
  - Should return list of available endpoints

- **API Info**: https://nexpro-backend.vercel.app/api
  - Should show API information

### 2. Frontend Configuration ⚙️

Check Vercel Dashboard → Environment Variables for Frontend project:

- `VITE_API_URL` should be: `https://nexpro-backend.vercel.app`

If not set, add it and redeploy.

### 3. Backend Configuration ⚙️

Check Vercel Dashboard → Environment Variables for Backend project:

Required variables:
- ✅ `DATABASE_URL` - Your Neon PostgreSQL connection
- ✅ `JWT_SECRET` - Generated secret
- ✅ `JWT_EXPIRE` - 7d
- ✅ `CORS_ORIGIN` - https://nexpro-frontend.vercel.app
- ✅ `FRONTEND_URL` - https://nexpro-frontend.vercel.app
- ✅ `NODE_ENV` - production
- ✅ `DEFAULT_PAGE_SIZE` - 10
- ✅ `MAX_PAGE_SIZE` - 100

### 4. Database Migrations 🗄️

Run migrations from your local machine:

```bash
cd Backend
# Make sure Backend/.env has DATABASE_URL set
npm run migrate
```

Expected output:
```
✅ Running migrations...
✅ Migrations completed successfully!
```

### 5. Frontend Can Connect to Backend 🔗

Test in browser console on frontend site:

```javascript
fetch('https://nexpro-backend.vercel.app/health')
  .then(r => r.json())
  .then(console.log)
```

Should return success response without CORS errors.

### 6. Admin Login Test 🔐

1. Go to https://nexpro-frontend.vercel.app/login
2. Try to login with:
   - Email: `admin@printingpress.com`
   - Password: `admin123`

If successful, you should see the dashboard.

### 7. Functionality Tests 🧪

Test these key features:

- ✅ Dashboard loads with statistics
- ✅ Can navigate between pages (Jobs, Customers, Invoices, etc.)
- ✅ Can create/edit/delete records
- ✅ Profile page works
- ✅ Invite user feature works
- ✅ All CRUD operations work

### 8. Check Browser Console 🔍

Open browser DevTools (F12) and check:
- No CORS errors
- No 404 errors for API calls
- No authentication errors
- No network errors

### 9. Check Vercel Logs 📊

For both frontend and backend in Vercel Dashboard:
- Go to "Deployments" tab
- Click on latest deployment
- Check "Function Logs" for errors
- Look for any build warnings or errors

### 10. Performance Check ⚡

- Page load time should be reasonable (<3s)
- API responses should be quick (<500ms)
- No excessive cold starts on first request

## Common Issues & Fixes

### Issue: Backend returns 404 or 500

**Solution:**
1. Check Vercel build logs
2. Verify `vercel.json` configuration
3. Ensure `api/index.js` exists
4. Check that `@vercel/node` is in dependencies

### Issue: Database connection fails

**Solution:**
1. Verify `DATABASE_URL` is correct
2. Check Neon database is accessible
3. Ensure SSL is configured (should auto-detect from Neon)
4. Run migrations

### Issue: CORS errors in browser

**Solution:**
1. Update backend `CORS_ORIGIN` to match frontend URL
2. Redeploy backend after changing environment variables
3. Clear browser cache

### Issue: Authentication not working

**Solution:**
1. Verify `JWT_SECRET` is set in backend
2. Check token is stored in localStorage
3. Verify API interceptor is working

### Issue: Frontend can't reach backend

**Solution:**
1. Check `VITE_API_URL` in frontend environment variables
2. Verify backend URL is correct
3. Redeploy frontend after setting env vars

## Success Criteria ✅

All checks should pass:
- [ ] Backend health check returns 200
- [ ] Frontend loads without errors
- [ ] No CORS errors in console
- [ ] Can login with admin account
- [ ] Dashboard displays correctly
- [ ] Can create/edit/delete records
- [ ] Database queries work
- [ ] All features functional
- [ ] Performance is acceptable
- [ ] No critical errors in logs

## Next Steps After Verification

Once everything works:

1. **Change Admin Password**: Don't use default password
2. **Configure Custom Domain**: Use your own domain if desired
3. **Set Up Monitoring**: Enable Vercel Analytics
4. **Create Production Users**: Use invite system to add real users
5. **Backup Strategy**: Set up Neon database backups
6. **Documentation**: Update any internal docs with production URLs

## Need Help?

If something isn't working:
1. Check Vercel function logs
2. Check browser console
3. Verify all environment variables
4. Test each component individually
5. Review deployment logs

## Deployment Complete! 🎉

If all checks pass, congratulations! Your NexPro application is live and ready to use!

---

**Live URLs:**
- Frontend: https://nexpro-frontend.vercel.app/
- Backend: https://nexpro-backend.vercel.app/

