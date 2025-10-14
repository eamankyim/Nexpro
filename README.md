# 🖨️ Printing Press Management System

A comprehensive full-stack web application for managing printing press operations including customers, jobs, vendors, payments, expenses, and pricing.

## 🌟 Features

### Backend (Node.js + Express + PostgreSQL)
- ✅ **Customer Management** - Track clients, contacts, and balances
- ✅ **Job Management** - Create and manage print jobs with auto-generated job numbers
- ✅ **Vendor Management** - Manage suppliers and relationships
- ✅ **Payment Tracking** - Record income and expense payments
- ✅ **Expense Management** - Track business expenses with categorization
- ✅ **Pricing Templates** - Price calculator with discount tiers
- ✅ **User Authentication** - JWT-based auth with role-based access
- ✅ **Dashboard Analytics** - Revenue, expenses, job statistics, top customers

### Frontend (React + Ant Design)
- ✅ **Modern UI** - Beautiful interface with Ant Design components
- ✅ **Authentication** - Secure login with JWT tokens
- ✅ **Dashboard** - Real-time statistics and charts
- ✅ **CRUD Operations** - Complete management for all resources
- ✅ **Role-based UI** - Different views for admin/manager/staff
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- PostgreSQL (v12+)

### 1. Backend Setup
```bash
cd Backend
npm install
cp env.example .env
# Edit .env with your PostgreSQL credentials
psql -U postgres -c "CREATE DATABASE printing_press_db;"
npm run seed
npm run dev
```

### 2. Frontend Setup
```bash
cd Frontend
npm install
cp env.example .env
npm run dev
```

### 3. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Login**: admin@printingpress.com / admin123

## 📁 Project Structure

```
NexPro/
│
├── Backend/                    # Node.js + Express API
│   ├── config/                # Database & app configuration
│   ├── controllers/           # Route controllers (business logic)
│   ├── middleware/            # Auth, error handling, validators
│   ├── models/               # Sequelize database models
│   ├── routes/               # Express routes
│   ├── utils/                # Utilities and seeder
│   ├── server.js             # Entry point
│   ├── package.json
│   ├── README.md
│   ├── API_ENDPOINTS.md
│   └── SETUP_GUIDE.md
│
├── Frontend/                  # React + Ant Design
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── context/          # React Context (Auth)
│   │   ├── layouts/          # Layout components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── README.md
│
├── SETUP_COMPLETE.md         # Complete setup guide
├── QUICK_REFERENCE.md        # Quick reference card
└── README.md                 # This file
```

## 🔌 API Endpoints

Base URL: `http://localhost:5000/api`

| Endpoint | Description |
|----------|-------------|
| `/auth` | Authentication (login, register) |
| `/customers` | Customer CRUD operations |
| `/vendors` | Vendor CRUD operations |
| `/jobs` | Job management + statistics |
| `/payments` | Payment tracking + statistics |
| `/expenses` | Expense management + statistics |
| `/pricing` | Pricing templates + calculator |
| `/users` | User management (admin only) |
| `/dashboard` | Analytics and reports |

See `Backend/API_ENDPOINTS.md` for detailed API documentation.

## 🎭 User Roles

| Role | Access Level |
|------|--------------|
| **Admin** | Full access to all features |
| **Manager** | Create, read, update (limited delete) |
| **Staff** | Read and update assigned jobs |

### Default Users (after seeding)
- Admin: `admin@printingpress.com` / `admin123`
- Manager: `manager@printingpress.com` / `manager123`
- Staff: `staff@printingpress.com` / `staff123`

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Authentication**: JWT
- **Security**: Helmet, bcryptjs
- **Validation**: express-validator

### Frontend
- **Library**: React 18
- **Build Tool**: Vite
- **UI Framework**: Ant Design 5
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Date Handling**: Day.js
- **Charts**: Recharts

## 📊 Database Models

- **User** - System users with roles
- **Customer** - Client information and balances
- **Vendor** - Supplier information
- **Job** - Print jobs with status tracking
- **Payment** - Income and expense payments
- **Expense** - Business expenses
- **PricingTemplate** - Pricing rules with discounts

## 🔧 Development

### Run Development Servers

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

### Available Scripts

#### Backend
- `npm run dev` - Development server with nodemon
- `npm start` - Production server
- `npm run seed` - Seed sample data

#### Frontend
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## 🧪 Testing the Setup

### Quick Health Check
```bash
# Backend health
curl http://localhost:5000/health

# Login test
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@printingpress.com","password":"admin123"}'
```

### Frontend Test
1. Open http://localhost:3000
2. Login with admin credentials
3. Navigate through dashboard, customers, vendors

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
# Deploy the dist/ folder to your hosting
```

### Environment Variables

**Backend (.env)**
```env
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your_super_secret_key
CORS_ORIGIN=https://your-frontend-domain.com
```

**Frontend (.env)**
```env
VITE_API_URL=https://your-api-domain.com
```

## 📚 Documentation

- **[SETUP_COMPLETE.md](SETUP_COMPLETE.md)** - Complete setup instructions
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick reference guide
- **[Backend/README.md](Backend/README.md)** - Backend documentation
- **[Backend/API_ENDPOINTS.md](Backend/API_ENDPOINTS.md)** - API reference
- **[Frontend/README.md](Frontend/README.md)** - Frontend documentation

## 🆘 Troubleshooting

### Common Issues

**Database Connection Failed**
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database exists

**CORS Errors**
- Check CORS_ORIGIN in backend `.env`
- Ensure backend is running
- Verify frontend URL matches

**Login Failed**
- Run backend seeder: `cd Backend && npm run seed`
- Check browser console
- Verify backend is accessible

**Port Already in Use**
- Change PORT in backend `.env`
- Or kill process: `lsof -ti:5000 | xargs kill`

## 🔐 Security Notes

### Development
- Default credentials are for testing only
- Sample JWT secret should be changed

### Production
- Use strong JWT_SECRET
- Enable HTTPS
- Use environment variables for all secrets
- Enable database SSL
- Set proper CORS origins
- Use strong passwords
- Keep dependencies updated

## 📈 Future Enhancements

- [ ] Advanced reporting and analytics
- [ ] Email notifications
- [ ] File upload and management
- [ ] Invoice generation (PDF)
- [ ] Real-time updates (WebSocket)
- [ ] Mobile app
- [ ] Multi-language support
- [ ] Advanced search and filtering
- [ ] Automated backups
- [ ] Audit logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

ISC

## 👥 Support

For issues or questions:
1. Check the documentation files
2. Review troubleshooting section
3. Check existing issues
4. Create a new issue with details

---

**Built with ❤️ for efficient printing press management**

🚀 **Ready to start?** Follow the Quick Start guide above!


