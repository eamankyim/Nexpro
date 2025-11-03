# ⚡ QUICK START - Get Data in Database NOW

## Your Question: "How do we get the data in the db the admin credentials and roles?"

## Answer: Run 2 Commands! 🎯

### Step 1: Open Render Shell
1. Go to https://dashboard.render.com
2. Click your backend service
3. Click **"Shell"** tab
4. Wait for connection

### Step 2: Run Migrations
```bash
npm run migrate
```

Wait for: ✅ "Database migration completed successfully!"

### Step 3: Create Admin
```bash
npm run seed-admin
```

Wait for: ✅ "Admin user created successfully!"

### Step 4: Login
- Email: `admin@printingpress.com`
- Password: `admin123`

---

## That's It! 🎉

Your database now has:
- ✅ All tables created
- ✅ Admin user with full permissions
- ✅ Ready to use!

---

## Optional: Create More Users

After logging in as admin:
1. Go to **Users** page
2. Click **"Invite User"** button
3. Fill in details
4. Copy the invite link
5. Share with new user
6. They complete signup via the link

---

## Troubleshooting

### "Error: database does not exist"
Create a PostgreSQL database on Render first:
1. Click **"New +"** → **"PostgreSQL"**
2. Wait for it to create
3. Copy Internal Database URL
4. Add to backend env vars as `DATABASE_URL`

### "npm command not found"
Make sure you're in the Backend directory:
```bash
cd Backend
npm run migrate
```

### "Admin already exists"
Good! Just login with the credentials above!

---

**Need more details?** See `SETUP_RENDER_DATABASE.md`

