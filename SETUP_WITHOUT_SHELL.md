# 🔧 Setup Database WITHOUT Render Shell (Free Plan)

## You're on Free Plan? No Problem!

You can run commands locally on your computer instead!

---

## Step 1: Get Your Database URL from Render

1. Go to: https://dashboard.render.com
2. Click your **PostgreSQL database** service
3. Click **"Settings"**
4. Find **"Internal Database URL"**
5. **Copy it!** It looks like:
   ```
   postgresql://user:password@host:5432/database?sslmode=require
   ```

---

## Step 2: Create Local .env File

1. Open your project in VS Code or any editor
2. Go to the `Backend` folder
3. Create a file named `.env` (not `.env.txt` - just `.env`)
4. Add this content:

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Replace the value with the URL you copied in Step 1!

5. Save the file

---

## Step 3: Run Commands Locally

Open PowerShell or Command Prompt, then:

### Navigate to Backend folder:
```bash
cd C:\Development\NexPro\Backend
```

### Run migrations (create tables):
```bash
npm run migrate
```

Wait for: ✅ "Database migration completed successfully!"

### Create admin user:
```bash
npm run seed-admin
```

Wait for: ✅ "Admin user created successfully!"

---

## Step 4: Login!

Now you can login with:
- Email: `admin@printingpress.com`
- Password: `admin123`

---

## Complete Example

```bash
# Navigate to project
cd C:\Development\NexPro\Backend

# Check .env file exists
dir .env

# If you see it, run commands:
npm run migrate
npm run seed-admin

# Done! 🎉
```

---

## Troubleshooting

### "Cannot find .env file"
- Make sure you're in `Backend` folder
- Make sure file is named `.env` not `.env.txt`
- Make sure it's in `Backend` folder, not root folder

### "Error: relation does not exist"
- Run `npm run migrate` first
- Check your DATABASE_URL is correct

### "Connection refused"
- Check your DATABASE_URL from Render
- Make sure database is running in Render
- Copy from "Internal Database URL" not "External Database URL"

### "npm command not found"
- Make sure you installed dependencies: `npm install`
- Make sure you're in Backend folder

---

## Summary

✅ No Shell needed!  
✅ Run locally instead!  
✅ Same result!  

---

**You got this!** 🚀

