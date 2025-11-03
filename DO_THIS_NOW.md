# ⚡ DO THIS RIGHT NOW

## You're on Free Plan - No Shell Access

No problem! Run setup on YOUR computer instead!

---

## 🎯 The 3 Steps:

### Step 1: Get Database URL from Render

1. Go to: https://dashboard.render.com
2. Find your PostgreSQL database
3. Click it → Click "Settings"
4. Find "Internal Database URL"
5. **COPY IT!**

---

### Step 2: Update Your Local .env File

The `.env` file already exists in `Backend` folder (you can't see it in the list because it's hidden for security).

**Edit it manually:**

1. Open VS Code or any text editor
2. Go to: `C:\Development\NexPro\Backend\.env`
3. Find the line: `DATABASE_URL=postgresql://...`
4. Replace the value with the URL you copied from Step 1
5. Save!

---

### Step 3: Run Commands

Open PowerShell in Backend folder:

```bash
cd C:\Development\NexPro\Backend
npm run migrate
npm run seed-admin
```

**Done!** ✅

---

## Login Now:

- Email: `admin@printingpress.com`
- Password: `admin123`

---

## 🎉 That's It!

No Render Shell needed! Everything runs on your computer!

**Questions?** Read `SETUP_WITHOUT_SHELL.md` or `SIMPLE_LOCAL_SETUP.md`

