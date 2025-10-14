# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Environment File
Copy `env.example` to `.env` and update with your PostgreSQL credentials:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/printing_press_db
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### Step 3: Create PostgreSQL Database
Open PowerShell or Command Prompt and run:

```bash
# Using psql command
psql -U postgres -c "CREATE DATABASE printing_press_db;"
```

Or use pgAdmin to create a database named `printing_press_db`

### Step 4: Seed Sample Data (Optional)
```bash
npm run seed
```

This creates test users:
- **Admin**: `admin@printingpress.com` / `admin123`
- **Manager**: `manager@printingpress.com` / `manager123`
- **Staff**: `staff@printingpress.com` / `staff123`

### Step 5: Start the Server
```bash
npm run dev
```

Server will start at: `http://localhost:5000`

## ✅ Verify Installation

### Test 1: Health Check
Open browser: `http://localhost:5000/health`

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "environment": "development"
}
```

### Test 2: API Info
Open browser: `http://localhost:5000`

You should see all available endpoints.

### Test 3: Login
Use Postman, Thunder Client, or cURL:

```bash
curl -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@printingpress.com\",\"password\":\"admin123\"}"
```

You should receive a JWT token.

## 📚 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm start` | Start production server |
| `npm run seed` | Populate database with sample data |

## 🔗 Important Endpoints

### Authentication
- **POST** `/api/auth/register` - Register new user
- **POST** `/api/auth/login` - Login user
- **GET** `/api/auth/me` - Get current user

### Main Features
- **Customers**: `/api/customers`
- **Vendors**: `/api/vendors`
- **Jobs**: `/api/jobs`
- **Payments**: `/api/payments`
- **Expenses**: `/api/expenses`
- **Pricing**: `/api/pricing`
- **Dashboard**: `/api/dashboard`

## 🛠️ Common Issues

### Issue: Database Connection Failed
**Solution**: 
1. Ensure PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Verify database exists

### Issue: Port Already in Use
**Solution**: Change PORT in `.env` to another port (e.g., 5001)

### Issue: JWT Error
**Solution**: Ensure JWT_SECRET is set in `.env`

## 📖 Full Documentation

- **Setup Guide**: See `SETUP_GUIDE.md`
- **API Reference**: See `API_ENDPOINTS.md`
- **Project Info**: See `README.md`

## 🎯 Next Steps

1. ✅ Test all endpoints using Postman/Thunder Client
2. ✅ Connect your frontend (Ant Design based)
3. ✅ Customize models and add business logic
4. ✅ Deploy to production

## 💡 Tips

- Use the seeded data to test without creating everything manually
- Check the `utils/seeder.js` to see sample data structure
- All passwords in seed data are for testing only
- Review `models/` folder to understand data structure
- Use dashboard endpoints for analytics

---

**Need Help?** Check `SETUP_GUIDE.md` for detailed instructions and troubleshooting.


