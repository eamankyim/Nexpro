# Database Setup Summary 📊

## Answer to Your Question

**"How do we get the admin credentials and roles in the db?"**

### Simple Answer:
Run these two commands in Render's Shell or locally:

```bash
# 1. Create all tables
npm run migrate

# 2. Create admin user
npm run seed-admin
```

That's it! You'll have:
- ✅ All database tables
- ✅ Admin user: `admin@printingpress.com` / `admin123`

---

## What We Created

### 1. `Backend/utils/seedAdmin.js` (NEW)
A **production-safe** admin seeder that:
- ✅ Only creates admin if it doesn't exist
- ✅ Safe to run multiple times
- ✅ Won't delete existing data
- ✅ Sets up proper credentials

### 2. Updated `Backend/migrations/migrate.js`
Now includes:
- ✅ User field migrations
- ✅ Invite tokens table creation

### 3. New Script in `package.json`
```json
"seed-admin": "node utils/seedAdmin.js"
```

---

## How to Use

### For Render (Production)

**Via Shell:**
1. Go to backend service → Shell tab
2. Run:
   ```bash
   npm run migrate
   npm run seed-admin
   ```

**Via Local:**
1. Set `DATABASE_URL` in `.env`
2. Run:
   ```bash
   cd Backend
   npm run migrate
   npm run seed-admin
   ```

### For Development
Use full seeder with test data:
```bash
npm run seed  # Creates admin + test data
```

---

## Admin Credentials

After running `npm run seed-admin`:

```
Email: admin@printingpress.com
Password: admin123
Role: admin
Status: Active
```

**⚠️ Change password after first login!**

---

## What Gets Created

### Tables (via migrate)
- users
- customers
- vendors
- jobs
- job_items
- payments
- expenses
- invoices
- pricing_templates
- vendor_price_lists
- invite_tokens

### Admin User (via seed-admin)
- Admin account
- All permissions
- Can invite other users
- Can manage everything

---

## Commands Reference

| Command | Purpose | Production Safe? |
|---------|---------|------------------|
| `npm run migrate` | Create/update tables | ✅ Yes |
| `npm run seed-admin` | Create admin user | ✅ Yes |
| `npm run seed` | Full test data | ❌ No (deletes data) |
| `npm run reset` | Clear all data except admin | ⚠️ Use carefully |

---

## Next Steps

1. ✅ Run migrations
2. ✅ Create admin
3. ✅ Login to frontend
4. ✅ Invite more users

**Full guide:** See `SETUP_RENDER_DATABASE.md`

---

**That's it! Simple and safe!** 🎉

