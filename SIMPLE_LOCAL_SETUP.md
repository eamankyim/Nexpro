# 🎯 Simple Local Setup for Free Plan

## You Don't Have Render Shell? Perfect!

Run everything on **your computer** instead!

---

## What You Need

1. Your Render database URL (from Render dashboard)
2. Your computer
3. 5 minutes

---

## The Setup

### 1️⃣ Get Your Database URL from Render

```
Render Dashboard → Your PostgreSQL Database → Settings → Internal Database URL
```

Copy that URL!

---

### 2️⃣ Update .env File

The `.env` file is already created for you in `Backend` folder!

Just open it and update:

```env
DATABASE_URL=postgresql://[PASTE YOUR RENDER DATABASE URL HERE]
```

Save it!

---

### 3️⃣ Run Commands

Open PowerShell in your Backend folder, then:

```bash
npm run migrate
```

Wait for: ✅ Success!

Then:

```bash
npm run seed-admin
```

Wait for: ✅ Admin created!

---

### 4️⃣ Login

- Email: `admin@printingpress.com`
- Password: `admin123`

---

## Quick Test

After running commands, test your backend:

Go to: https://nexpro.onrender.com/health

Should return: `{"success":true,"message":"Server is running"}`

Then try login on your frontend!

---

## That's It! 🎉

No Shell needed! All done locally!

---

**Questions?** Read `SETUP_WITHOUT_SHELL.md` for more details!

