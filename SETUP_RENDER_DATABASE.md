# Setup Render Database 🗄️

## Quick Setup Steps

### Step 1: Run Migrations
Create all database tables and structure.

**Via Render Shell:**
1. Go to your backend service in Render
2. Click **Shell** tab
3. Run:
   ```bash
   npm run migrate
   ```

**Or Via Local (with DATABASE_URL set):**
```bash
cd Backend
npm run migrate
```

### Step 2: Create Admin User
Seed the admin user for initial login.

**Via Render Shell:**
```bash
npm run seed-admin
```

**Or Via Local:**
```bash
cd Backend
npm run seed-admin
```

### Step 3: Login! 🎉
Use these credentials:
- **Email:** `admin@printingpress.com`
- **Password:** `admin123`

## What Gets Created

### ✅ `npm run migrate`
- Creates all database tables
- Adds user fields (profilePicture, isFirstLogin, lastLogin)
- Creates invite_tokens table
- Safe for production (doesn't delete existing data)

### ✅ `npm run seed-admin`
- Creates admin user **only if it doesn't exist**
- Safe to run multiple times
- Won't duplicate users

## Optional Commands

### Full Seed Data (Development Only)
**⚠️ WARNING: This deletes ALL data!**
```bash
npm run seed
```

Use this for:
- Local development
- Testing
- Fresh start

**NOT for production!**

### Reset Production Data
Clears all data **except admin users**.

```bash
npm run reset
```

Use this when:
- Starting fresh in production
- Testing invoice generation
- Need clean slate but keep admin access

## Troubleshooting

### "Error: Relation does not exist"
Run migrations first:
```bash
npm run migrate
```

### "Admin already exists"
Good! Your admin is already set up. Just login!

### "Connection refused"
Check your `DATABASE_URL` in Render environment variables.

### "Permission denied"
Make sure DATABASE_URL has correct permissions.

## Production Checklist

- ✅ Database created in Render
- ✅ DATABASE_URL configured
- ✅ `npm run migrate` completed
- ✅ `npm run seed-admin` completed
- ✅ Test login successful
- ✅ Can access dashboard
- ✅ Can see admin user in Users page

## Need More Users?

After logging in as admin:
1. Go to **Users** page
2. Click **"Invite User"**
3. Fill in details
4. Copy the invite link
5. Share with new user
6. They sign up via the link

---

**You're all set!** 🚀

