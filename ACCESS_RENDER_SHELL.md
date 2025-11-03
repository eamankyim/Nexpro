# 🖥️ How to Access Render Shell

## Quick Guide

### Step 1: Log into Render Dashboard

1. Go to: https://dashboard.render.com
2. Sign in (or create account if needed)

### Step 2: Find Your Backend Service

1. You'll see a list of your services
2. Look for your backend service name (e.g., "nexpro-backend" or similar)
3. **Click on the service name** (not the URL)

### Step 3: Open Shell Tab

1. You'll see tabs at the top: **"Logs"**, **"Metrics"**, **"Shell"**, **"Settings"**, etc.
2. Click **"Shell"** tab
3. Wait 10-30 seconds for connection

### Step 4: You're In!

You'll see a terminal prompt like:
```bash
$
```

Now you can run commands!

---

## Visual Guide

```
Render Dashboard
├── My Services
│   ├── nexpro-backend (click this!)
│   │   ├── [Tabs at top]
│   │   │   ├── Logs
│   │   │   ├── Metrics
│   │   │   ├── Shell ⭐ (click here!)
│   │   │   ├── Settings
│   │   │   └── ...
│   │   │
│   │   └── [Terminal opens here]
│   │       $ npm run migrate
│   │       $ npm run seed-admin
```

---

## Commands to Run

Once Shell is open:

```bash
# 1. Navigate to Backend directory
cd Backend

# 2. Run migrations (creates tables)
npm run migrate

# 3. Create admin user
npm run seed-admin

# Done! 🎉
```

---

## What You'll See

### After `npm run migrate`:
```
🔄 Starting database migration...

✅ Database migration completed successfully!
📊 All tables have been created/updated.
👤 User model has been enhanced with new fields.
🎫 Invite tokens table ready.
```

### After `npm run seed-admin`:
```
✅ Admin user created successfully!

📧 Login Credentials:
   Email: admin@printingpress.com
   Password: admin123
```

---

## Troubleshooting

### "Shell tab not appearing"
- Make sure your service is deployed and running
- Check you clicked on the correct service
- Try refreshing the page

### "Connection timeout"
- Wait a bit longer (can take 30 seconds)
- Try clicking Shell tab again
- Check your service is running (green status)

### "Commands not found"
- You need to `cd Backend` first
- Check you're in the correct directory

### "npm: command not found"
- Wait for the shell to fully load
- Try again

### "Permission denied"
- Run commands one at a time
- Make sure you're in the `Backend` directory

---

## Alternative: Run Commands Locally

If Render Shell is giving you trouble, you can run commands locally:

### Step 1: Get Database URL from Render

1. Go to your backend service in Render
2. **Settings** → **Environment Variables**
3. Find `DATABASE_URL`
4. Copy the value

### Step 2: Create Local .env

In your `Backend` folder, create `.env` file:
```env
DATABASE_URL=[paste the value from step 1]
```

### Step 3: Run Locally

Open PowerShell or Command Prompt:
```bash
cd C:\Development\NexPro\Backend
npm run migrate
npm run seed-admin
```

---

## Quick Checklist

- [ ] Logged into Render dashboard
- [ ] Found backend service
- [ ] Clicked on service name
- [ ] Opened Shell tab
- [ ] Waited for connection
- [ ] Ran `cd Backend`
- [ ] Ran `npm run migrate`
- [ ] Ran `npm run seed-admin`
- [ ] Got success messages
- [ ] Ready to login!

---

## Still Stuck?

1. **Screenshot your Render dashboard** - I can guide you
2. **Check Render status** - Make sure service is green/running
3. **Try local method** - Use the alternative above

---

**You got this!** 🚀

