# ⚡ Run Setup Locally RIGHT NOW

## Free Plan = Run on Your Computer!

### Step 1: Get Database URL

Render Dashboard → PostgreSQL → Settings → Internal Database URL  
COPY IT!

---

### Step 2: Create .env File

1. Navigate to: `C:\Development\NexPro\Backend`
2. Create file: `.env`
3. Paste:
```env
DATABASE_URL=postgresql://[paste your URL here]
```
4. Save!

---

### Step 3: Open Terminal

PowerShell or Command Prompt:

```bash
cd C:\Development\NexPro\Backend
npm run migrate
npm run seed-admin
```

---

### Step 4: Done! 🎉

Login:
- Email: `admin@printingpress.com`
- Password: `admin123`

---

**That's it!** ✅

**Details:** `SETUP_WITHOUT_SHELL.md`

