# 🚀 GET STARTED - 5 Minute Setup

## ✅ What You Have

A complete **Printing Press Management System** with:
- ✅ Backend API (Node.js + Express + PostgreSQL)
- ✅ Frontend UI (React + Ant Design)
- ✅ Full authentication & authorization
- ✅ Complete CRUD operations
- ✅ Dashboard with analytics
- ✅ Sample data included

## 📋 Prerequisites Check

Before starting, ensure you have:
- [ ] Node.js installed (v14+) - Check: `node --version`
- [ ] PostgreSQL installed (v12+) - Check: `psql --version`
- [ ] npm installed - Check: `npm --version`

## 🎯 Quick Setup (5 Minutes)

### Step 1: Backend (2 minutes)

Open PowerShell/Terminal:

```powershell
# Navigate to backend
cd Backend

# Install packages
npm install

# Create .env file
copy env.example .env

# Edit .env file - Update these lines:
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/printing_press_db
# JWT_SECRET=your_secret_key_here

# Create database
psql -U postgres -c "CREATE DATABASE printing_press_db;"

# Seed sample data
npm run seed

# Start backend
npm run dev
```

✅ **Backend running at:** http://localhost:5000

### Step 2: Frontend (2 minutes)

Open **NEW** PowerShell/Terminal:

```powershell
# Navigate to frontend
cd Frontend

# Install packages
npm install

# Create .env file
copy env.example .env
# (env file is already configured correctly)

# Start frontend
npm run dev
```

✅ **Frontend running at:** http://localhost:3000

### Step 3: Login (1 minute)

1. Open browser: **http://localhost:3000**
2. Login with:
   - Email: `admin@printingpress.com`
   - Password: `admin123`

🎉 **You're in!**

## 🎨 What You Can Do Now

### Explore the Dashboard
- View statistics
- See recent jobs
- Check revenue/expenses

### Manage Customers
- View customer list
- Add new customers
- Edit customer details
- Search and filter

### Manage Vendors
- View vendor list
- Add new vendors
- Track vendor relationships

### View Jobs
- See all print jobs
- Filter by status
- Check job details

### Check Your Profile
- View user information
- See your role

## 🔑 Test Accounts

| Email | Password | Role | Access |
|-------|----------|------|--------|
| admin@printingpress.com | admin123 | Admin | Full access |
| manager@printingpress.com | manager123 | Manager | Create/Edit |
| staff@printingpress.com | staff123 | Staff | View/Edit jobs |

## 📁 Project Overview

```
NexPro/
│
├── Backend/              ← Node.js API
│   └── Run: npm run dev (Port 5000)
│
└── Frontend/            ← React App
    └── Run: npm run dev (Port 3000)
```

## 🌐 Important URLs

- **App**: http://localhost:3000
- **API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/health

## 🛠️ Development Commands

### Backend Terminal
```bash
cd Backend
npm run dev      # Start development server
npm run seed     # Reset sample data
```

### Frontend Terminal
```bash
cd Frontend
npm run dev      # Start development server
npm run build    # Build for production
```

## ❓ Troubleshooting

### ❌ Database Error
```bash
# Make sure PostgreSQL is running
# Then create database:
psql -U postgres -c "CREATE DATABASE printing_press_db;"
```

### ❌ Login Not Working
```bash
# Re-seed the database:
cd Backend
npm run seed
```

### ❌ Port Already in Use
Backend:
- Edit `Backend/.env` and change `PORT=5000` to `PORT=5001`

Frontend:
- Edit `Frontend/vite.config.js` and change port to 3001

### ❌ CORS Error
- Make sure both servers are running
- Check `Backend/.env` has `CORS_ORIGIN=http://localhost:3000`

## 📚 Next Steps

### 1. Explore the Code
- **Backend Models**: `Backend/models/`
- **Frontend Pages**: `Frontend/src/pages/`
- **API Services**: `Frontend/src/services/`

### 2. Customize
- Add new features
- Modify the UI
- Add business logic

### 3. Read Documentation
- `README.md` - Overview
- `SETUP_COMPLETE.md` - Detailed setup
- `QUICK_REFERENCE.md` - Quick commands
- `Backend/API_ENDPOINTS.md` - API docs

## 🎯 Features to Implement

The app is ready to use, but you can extend it:

- [ ] Complete Payment UI
- [ ] Complete Expense UI
- [ ] Pricing Templates UI
- [ ] User Management UI
- [ ] File Uploads
- [ ] Email Notifications
- [ ] Reports/Analytics
- [ ] Invoice Generation

## 🔥 Quick Commands Reference

```bash
# Start everything
cd Backend && npm run dev          # Terminal 1
cd Frontend && npm run dev         # Terminal 2

# Reset sample data
cd Backend && npm run seed

# Test API
curl http://localhost:5000/health

# Build for production
cd Frontend && npm run build
```

## ✨ You're All Set!

Your printing press management system is now running!

**Next**: Open http://localhost:3000 and login with admin credentials.

---

**Need Help?** 
- See `SETUP_COMPLETE.md` for detailed guide
- Check `QUICK_REFERENCE.md` for quick tips
- Review API docs in `Backend/API_ENDPOINTS.md`

**Happy Coding! 🚀**


