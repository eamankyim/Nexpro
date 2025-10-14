# Complete Setup Guide - Printing Press Management System

This guide will help you set up both the backend and frontend of the Printing Press Management System.

## 📋 Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

## 🚀 Complete Setup (Both Backend & Frontend)

### Step 1: Setup Backend

Navigate to Backend folder:
```bash
cd Backend
```

Install dependencies:
```bash
npm install
```

Create `.env` file:
```bash
cp env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/printing_press_db
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

Create PostgreSQL database:
```bash
# Using psql
psql -U postgres -c "CREATE DATABASE printing_press_db;"
```

Seed the database with sample data:
```bash
npm run seed
```

Start the backend server:
```bash
npm run dev
```

✅ Backend should now be running at `http://localhost:5000`

### Step 2: Setup Frontend

Open a new terminal and navigate to Frontend folder:
```bash
cd Frontend
```

Install dependencies:
```bash
npm install
```

Create `.env` file:
```bash
cp env.example .env
```

Content should be:
```env
VITE_API_URL=http://localhost:5000
```

Start the frontend server:
```bash
npm run dev
```

✅ Frontend should now be running at `http://localhost:3000`

## 🔐 Login to the Application

Open browser at `http://localhost:3000`

Use these default credentials:
- **Admin**: `admin@printingpress.com` / `admin123`
- **Manager**: `manager@printingpress.com` / `manager123`
- **Staff**: `staff@printingpress.com` / `staff123`

## 📊 What's Included

### Backend API Features
✅ Customer Management
✅ Vendor Management
✅ Job Tracking
✅ Payment Processing
✅ Expense Tracking
✅ Pricing Templates
✅ User Management
✅ Dashboard Analytics
✅ JWT Authentication
✅ Role-based Access Control

### Frontend Features
✅ Modern UI with Ant Design
✅ Login/Authentication
✅ Dashboard with Statistics
✅ Customer CRUD Operations
✅ Vendor CRUD Operations
✅ Job Listing & Filtering
✅ User Profile
✅ Role-based UI
✅ Responsive Design

## 🗂️ Project Structure

```
NexPro/
├── Backend/
│   ├── config/          # Database & app config
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Auth & error handling
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── utils/          # Seeder & utilities
│   ├── server.js       # Entry point
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── context/     # Auth context
    │   ├── layouts/     # Layout components
    │   ├── pages/       # Page components
    │   ├── services/    # API services
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 🔌 API Endpoints

Base URL: `http://localhost:5000/api`

### Authentication
- `POST /auth/login` - Login
- `POST /auth/register` - Register
- `GET /auth/me` - Get current user

### Resources
- `/customers` - Customer management
- `/vendors` - Vendor management
- `/jobs` - Job management
- `/payments` - Payment tracking
- `/expenses` - Expense management
- `/pricing` - Pricing templates
- `/users` - User management (admin)
- `/dashboard` - Analytics & stats

## 🧪 Testing the Setup

### 1. Test Backend
```bash
# Health check
curl http://localhost:5000/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@printingpress.com","password":"admin123"}'
```

### 2. Test Frontend
1. Open `http://localhost:3000`
2. Login with admin credentials
3. Navigate through Dashboard, Customers, Vendors, Jobs

## 🔧 Development Workflow

### Run Both Servers

**Terminal 1 - Backend:**
```bash
cd Backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd Frontend
npm run dev
```

## 🚢 Production Deployment

### Backend
```bash
cd Backend
npm install --production
NODE_ENV=production npm start
```

### Frontend
```bash
cd Frontend
npm run build
# Serve the dist/ folder with your web server
```

## 🛠️ Common Issues & Solutions

### Issue: Database Connection Failed
**Solution:**
- Ensure PostgreSQL is running
- Check DATABASE_URL in Backend/.env
- Verify database exists

### Issue: CORS Error
**Solution:**
- Ensure Backend CORS_ORIGIN matches Frontend URL
- Check if backend is running
- Verify .env files

### Issue: Port Already in Use
**Solution:**
- Backend: Change PORT in Backend/.env
- Frontend: Change port in Frontend/vite.config.js

### Issue: Login Failed
**Solution:**
- Run backend seeder: `npm run seed`
- Check browser console for errors
- Verify backend is accessible

## 📝 Sample Data

After running `npm run seed` in Backend:

**Users:**
- 3 users (admin, manager, staff)

**Customers:**
- 2 sample customers

**Vendors:**
- 2 sample vendors

**Jobs:**
- 2 sample print jobs

**Pricing Templates:**
- Business cards template
- Flyer printing template

## 🔐 Security Notes

### Development
- Default JWT secret is for development only
- Sample data passwords are simple for testing

### Production
- Change JWT_SECRET to a strong random string
- Use HTTPS
- Set NODE_ENV=production
- Use strong database passwords
- Enable database SSL
- Configure proper CORS origins

## 📚 Next Steps

1. ✅ Complete remaining frontend pages (Payments, Expenses, etc.)
2. ✅ Add form validation
3. ✅ Implement file uploads
4. ✅ Add advanced analytics
5. ✅ Set up automated testing
6. ✅ Configure CI/CD
7. ✅ Add email notifications

## 🆘 Support

### Backend Docs
- `Backend/README.md` - Detailed backend docs
- `Backend/API_ENDPOINTS.md` - API reference
- `Backend/SETUP_GUIDE.md` - Backend setup

### Frontend Docs
- `Frontend/README.md` - Frontend documentation

## 🎉 Success!

If both servers are running and you can:
- ✅ Access frontend at http://localhost:3000
- ✅ Login successfully
- ✅ View dashboard
- ✅ Manage customers and vendors

Then your setup is complete! 🚀

---

**Built with:**
- Node.js + Express.js
- PostgreSQL + Sequelize
- React + Ant Design
- JWT Authentication


