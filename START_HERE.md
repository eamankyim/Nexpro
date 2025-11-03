# 🎯 START HERE - NexPro Setup Guide

## Your Question Answered: "How do we get the data in the db the admin credentials and roles?"

**Answer:** Run these 2 commands in Render Shell:
```bash
npm run migrate      # Creates all tables
npm run seed-admin   # Creates admin user
```

---

## 📚 Choose Your Path

### 🚀 Quick Setup (2 Minutes)
**Read:** `QUICK_START_NOW.md`  
Shows exactly how to get admin credentials in your database.

### 🏗️ Full Deployment (15 Minutes)
**Read:** `READY_TO_DEPLOY.md`  
Complete step-by-step guide from database to live app.

### 🗄️ Database Setup Only
**Read:** `SETUP_RENDER_DATABASE.md`  
Detailed database setup instructions.

### 🔗 Connect Services
**Read:** `CONNECT_VERCEL_TO_RENDER.md`  
Link your Vercel frontend to Render backend.

### ✅ Everything Ready
**Read:** `YOU_ARE_READY.md`  
Complete overview of what's done and what to do.

---

## 🎯 Recommended Reading Order

### First Time Setup:
1. **`QUICK_START_NOW.md`** - Get admin working (2 min)
2. **`SETUP_RENDER_DATABASE.md`** - Understand the process
3. **`CONNECT_VERCEL_TO_RENDER.md`** - Connect frontend/backend
4. **`YOU_ARE_READY.md`** - Verify everything works

### If Something Breaks:
1. Check `SETUP_RENDER_DATABASE.md` troubleshooting
2. Check Render logs
3. Check Vercel deployment logs

---

## 🗂️ All Documentation

### Core Setup
- ✅ **START_HERE.md** ← You are here
- ✅ **QUICK_START_NOW.md** ← Run 2 commands to get admin
- ✅ **SETUP_RENDER_DATABASE.md** ← Database setup details
- ✅ **DATABASE_SETUP_SUMMARY.md** ← Quick database reference

### Deployment
- ✅ **READY_TO_DEPLOY.md** ← Full deployment guide
- ✅ **CONNECT_VERCEL_TO_RENDER.md** ← Service connection
- ✅ **YOU_ARE_READY.md** ← Complete status overview

### Features & Guides
- ✅ **Backend/API_ENDPOINTS.md** ← API documentation
- ✅ **INVOICE_AUTO_GENERATION_GUIDE.md** ← Auto-invoice feature
- ✅ **PRICING_DISCOUNT_GUIDE.md** ← Pricing system
- ✅ **REALTIME_DISCOUNT_UPDATE.md** ← Discount calculations

### Legacy Documentation
- ⚠️ VERCEL_*.md files (we switched to Render)
- ⚠️ NEON_DATABASE_SETUP.md (using Render DB now)
- ⚠️ Multiple deployment guides (consolidated above)

---

## 🎮 Key Commands

```bash
# Create tables
npm run migrate

# Create admin user
npm run seed-admin

# Full test data (WARNING: deletes everything!)
npm run seed

# Reset production (keeps admin)
npm run reset
```

---

## 🔑 Admin Credentials

After running `npm run seed-admin`:
```
Email: admin@printingpress.com
Password: admin123
```

---

## 📞 Quick Answers

**Q: Frontend on Vercel or Render?**  
A: Vercel (as requested)

**Q: Backend on what?**  
A: Render

**Q: Database on what?**  
A: Render PostgreSQL

**Q: How to get admin user?**  
A: `npm run seed-admin` in Render Shell

**Q: Where are environment variables?**  
A: Render (backend) & Vercel (frontend) dashboards

**Q: How to invite users?**  
A: Login as admin → Users page → Invite User

---

## ⚡ One-Minute Summary

1. Create PostgreSQL on Render
2. Add `DATABASE_URL` to backend env vars
3. Run `npm run migrate` in Render Shell
4. Run `npm run seed-admin` in Render Shell
5. Login as admin
6. Add `VITE_API_URL` to Vercel
7. Set `CORS_ORIGIN` in Render to your Vercel URL
8. Done! 🎉

---

## 🎯 Your Next Step

**Open:** `QUICK_START_NOW.md`  
**Follow:** The 4 simple steps  
**Done:** You have admin access!

---

## 🖥️ Can't Find Render Shell?

**Read:** `ACCESS_RENDER_SHELL.md` or `HOW_TO_ACCESS_SHELL_STEP_BY_STEP.md`  
Step-by-step guide to open Render Shell and run commands.

---

**Ready? Let's go!** 🚀

