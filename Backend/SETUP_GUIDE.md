# Printing Press Management System - Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v12 or higher) - [Download](https://www.postgresql.org/download/)
- **Git** - [Download](https://git-scm.com/)
- A code editor (VS Code recommended)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup PostgreSQL Database

#### Option A: Using pgAdmin or psql
```sql
CREATE DATABASE printing_press_db;
```

#### Option B: Using Command Line
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE printing_press_db;

# Exit
\q
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:
```bash
cp env.example .env
```

Edit `.env` file with your configuration:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/printing_press_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Pagination
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

**Important:** Replace the following:
- `yourpassword` - Your PostgreSQL password
- `your_super_secret_jwt_key_change_this_in_production` - A strong, random JWT secret

### 5. Seed the Database (Optional)

To populate the database with sample data:
```bash
npm run seed
```

This will create:
- 3 sample users (admin, manager, staff)
- 2 sample customers
- 2 sample vendors
- 2 pricing templates
- 2 sample jobs
- Sample expenses and payments

**Test User Credentials:**
- Admin: `admin@printingpress.com` / `admin123`
- Manager: `manager@printingpress.com` / `manager123`
- Staff: `staff@printingpress.com` / `staff123`

### 6. Start the Server

#### Development Mode (with auto-reload)
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The server will start at `http://localhost:5000`

## 🧪 Testing the API

### Option 1: Using cURL
```bash
# Health check
curl http://localhost:5000/health

# Register a new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "admin"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@printingpress.com",
    "password": "admin123"
  }'
```

### Option 2: Using Postman or Thunder Client
1. Import the endpoints from `API_ENDPOINTS.md`
2. Set the base URL to `http://localhost:5000`
3. For authenticated requests, add the token to headers:
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN_HERE`

### Option 3: Using the Browser
Open your browser and navigate to:
- API Info: `http://localhost:5000`
- Health Check: `http://localhost:5000/health`

## 📁 Project Structure

```
Backend/
├── config/                 # Configuration files
│   ├── config.js          # App configuration
│   └── database.js        # Database connection
├── controllers/           # Route controllers
│   ├── authController.js
│   ├── customerController.js
│   ├── dashboardController.js
│   ├── expenseController.js
│   ├── jobController.js
│   ├── paymentController.js
│   ├── pricingController.js
│   ├── userController.js
│   └── vendorController.js
├── middleware/            # Custom middleware
│   ├── auth.js           # Authentication middleware
│   ├── errorHandler.js   # Error handling
│   └── validators.js     # Validation middleware
├── models/               # Database models
│   ├── Customer.js
│   ├── Expense.js
│   ├── Job.js
│   ├── Payment.js
│   ├── PricingTemplate.js
│   ├── User.js
│   ├── Vendor.js
│   └── index.js
├── routes/               # API routes
│   ├── authRoutes.js
│   ├── customerRoutes.js
│   ├── dashboardRoutes.js
│   ├── expenseRoutes.js
│   ├── jobRoutes.js
│   ├── paymentRoutes.js
│   ├── pricingRoutes.js
│   ├── userRoutes.js
│   └── vendorRoutes.js
├── utils/               # Utility files
│   └── seeder.js       # Database seeder
├── .gitignore
├── env.example         # Environment variables template
├── package.json
├── server.js          # Entry point
├── README.md
├── SETUP_GUIDE.md
└── API_ENDPOINTS.md
```

## 🔧 Troubleshooting

### Database Connection Issues

**Error: "Unable to connect to the database"**

1. Check if PostgreSQL is running:
```bash
# Windows
pg_ctl status

# Linux/Mac
sudo service postgresql status
```

2. Verify your DATABASE_URL in `.env`
3. Check PostgreSQL user permissions
4. Ensure the database exists

### Port Already in Use

**Error: "Port 5000 is already in use"**

Change the PORT in `.env`:
```env
PORT=5001
```

### JWT Secret Error

**Error: "JWT secret is not defined"**

Ensure JWT_SECRET is set in `.env`:
```env
JWT_SECRET=your_secret_key_here
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🔐 Security Best Practices

### For Production:

1. **Change JWT Secret**
   - Use a strong, random secret key
   - Never commit `.env` file to version control

2. **Update CORS Origin**
   ```env
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. **Use Environment Variables**
   - Never hardcode sensitive data
   - Use different `.env` files for different environments

4. **Database Security**
   - Use strong passwords
   - Limit database user permissions
   - Enable SSL for database connections

5. **HTTPS**
   - Use HTTPS in production
   - Configure SSL certificates

## 📊 Database Management

### View Database Tables
```bash
psql -U postgres -d printing_press_db

# List all tables
\dt

# View table structure
\d table_name

# Exit
\q
```

### Reset Database
```bash
# Drop and recreate database
psql -U postgres
DROP DATABASE printing_press_db;
CREATE DATABASE printing_press_db;
\q

# Run seeder again
npm run seed
```

## 🚀 Deployment

### Deploying to Heroku

1. Install Heroku CLI
2. Login to Heroku:
   ```bash
   heroku login
   ```

3. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

4. Add PostgreSQL addon:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

5. Set environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_secret_key
   heroku config:set CORS_ORIGIN=https://your-frontend.com
   ```

6. Deploy:
   ```bash
   git push heroku main
   ```

### Deploying to Other Platforms

- **Railway**: Connect GitHub repo and set environment variables
- **Render**: Similar to Heroku, auto-deploy from GitHub
- **DigitalOcean**: Use App Platform or Droplets
- **AWS**: Use Elastic Beanstalk or EC2

## 📝 Next Steps

1. **Set up the frontend** using the API
2. **Configure production environment**
3. **Set up monitoring and logging**
4. **Implement automated backups**
5. **Add additional features** as needed

## 🤝 Support

For issues or questions:
1. Check the README.md and API_ENDPOINTS.md
2. Review the troubleshooting section
3. Check existing issues on GitHub
4. Create a new issue with detailed information

## 📄 License

This project is licensed under the ISC License.

