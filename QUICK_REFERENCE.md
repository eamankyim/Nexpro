# 🚀 Quick Reference - Printing Press Management

## 📦 Installation (First Time)

```bash
# Backend Setup
cd Backend
npm install
cp env.example .env
# Edit .env with your PostgreSQL credentials
psql -U postgres -c "CREATE DATABASE printing_press_db;"
npm run seed
npm run dev

# Frontend Setup (New Terminal)
cd Frontend
npm install
cp env.example .env
npm run dev
```

## 🔑 Default Login

- **URL**: http://localhost:3000
- **Admin**: admin@printingpress.com / admin123
- **Manager**: manager@printingpress.com / manager123
- **Staff**: staff@printingpress.com / staff123

## 🎯 Daily Development

```bash
# Terminal 1 - Backend
cd Backend
npm run dev        # Runs on http://localhost:5000

# Terminal 2 - Frontend  
cd Frontend
npm run dev        # Runs on http://localhost:3000
```

## 📁 Project Layout

```
NexPro/
├── Backend/        → Node.js + Express API
│   ├── models/     → Database models
│   ├── controllers/→ Business logic
│   ├── routes/     → API endpoints
│   └── .env        → Config (create from env.example)
│
└── Frontend/       → React + Ant Design
    ├── src/
    │   ├── pages/     → Page components
    │   ├── services/  → API calls
    │   └── context/   → Auth state
    └── .env           → Config (create from env.example)
```

## 🔌 API Endpoints (Backend)

| Endpoint | Purpose |
|----------|---------|
| `/api/auth` | Login, Register |
| `/api/customers` | Customer CRUD |
| `/api/vendors` | Vendor CRUD |
| `/api/jobs` | Job management |
| `/api/payments` | Payment tracking |
| `/api/expenses` | Expense tracking |
| `/api/pricing` | Pricing templates |
| `/api/dashboard` | Analytics |
| `/api/users` | User management |

## 🎨 Frontend Routes

| Route | Page |
|-------|------|
| `/login` | Login page |
| `/dashboard` | Main dashboard |
| `/customers` | Customer list |
| `/vendors` | Vendor list |
| `/jobs` | Job list |
| `/payments` | Payments |
| `/expenses` | Expenses |
| `/pricing` | Pricing |
| `/users` | User management |
| `/profile` | User profile |

## 🛠️ Useful Commands

### Backend
```bash
npm run dev      # Development mode
npm start        # Production mode
npm run seed     # Seed sample data
```

### Frontend
```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

## 🔧 Environment Variables

### Backend (.env)
```env
PORT=5000
DATABASE_URL=postgresql://user:pass@localhost:5432/printing_press_db
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
```

## 🎭 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access (create, edit, delete all) |
| **Manager** | Create, edit (limited delete) |
| **Staff** | View, edit assigned jobs |

## 📊 Features Checklist

### ✅ Implemented
- [x] Authentication & Authorization
- [x] Dashboard with statistics
- [x] Customer management (full CRUD)
- [x] Vendor management (full CRUD)
- [x] Job listing & filtering
- [x] Role-based access control
- [x] Responsive UI

### ⏳ To Implement
- [ ] Complete job management (create/edit)
- [ ] Payment tracking UI
- [ ] Expense management UI
- [ ] Pricing templates UI
- [ ] User management UI (admin)
- [ ] File uploads
- [ ] Advanced analytics

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check if PostgreSQL is running and .env is configured |
| Database error | Run `npm run seed` in Backend folder |
| Login fails | Ensure backend is running and seeded |
| CORS error | Check CORS_ORIGIN in Backend/.env matches frontend URL |
| Port in use | Change PORT in .env or kill process using the port |

## 📝 Quick Test

```bash
# Test Backend
curl http://localhost:5000/health

# Test Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@printingpress.com","password":"admin123"}'

# Open Frontend
open http://localhost:3000
```

## 🔗 Documentation

- **Backend**: `Backend/README.md`
- **Frontend**: `Frontend/README.md`
- **API Docs**: `Backend/API_ENDPOINTS.md`
- **Full Setup**: `SETUP_COMPLETE.md`

## 💡 Pro Tips

1. **Auto-reload**: Both servers auto-reload on code changes
2. **Seeder**: Re-run `npm run seed` to reset sample data
3. **API Testing**: Use Postman/Thunder Client for API testing
4. **Debugging**: Check browser console and terminal logs
5. **Database**: Use pgAdmin to view database tables

---

**Quick Start**: Just run `npm run dev` in both Backend and Frontend folders! 🚀


