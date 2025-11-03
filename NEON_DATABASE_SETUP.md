# Neon Database Setup Guide

## 🚀 Quick Setup Instructions

### 1. Create Environment File

Copy the example environment file and update it with your Neon database credentials:

```bash
cd Backend
cp env.example .env
```

### 2. Update .env File

Your `.env` file should contain:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration - Neon Database
# Get your connection string from https://console.neon.tech
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require

# Alternative unpooled connection (if needed)
DATABASE_URL_UNPOOLED=postgresql://username:password@host:5432/database?sslmode=require

# JWT Configuration
# Generate a strong secret: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_key_here_change_this_in_production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Pagination
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

### 3. Install Dependencies

```bash
cd Backend
npm install
```

### 4. Run Database Migration

```bash
npm run migrate
```

This will:
- ✅ Connect to your Neon database
- ✅ Create all necessary tables
- ✅ Add new user fields (profilePicture, isFirstLogin, lastLogin)
- ✅ Set up relationships between tables

### 5. Seed Sample Data

```bash
npm run seed
```

This will create:
- 👤 Sample users (admin, manager, staff)
- 👥 Sample customers
- 🏢 Sample vendors
- 📋 Sample jobs
- 💰 Sample pricing templates

### 6. Start the Backend Server

```bash
npm run dev
```

## 🔧 Database Configuration Details

### Connection Details
- **Provider**: Neon PostgreSQL (Serverless)
- **SSL**: Required (sslmode=require)
- Get connection details from your Neon dashboard at https://console.neon.tech

### New User Fields Added
- `profilePicture` - VARCHAR(255) - User avatar URL
- `isFirstLogin` - BOOLEAN - Tracks if user needs to change password
- `lastLogin` - TIMESTAMP - Last login date

## 🚨 Important Notes

### Security
- ✅ SSL connection is required
- ✅ Change JWT_SECRET in production
- ✅ Use environment variables for sensitive data

### Connection Pooling
- **Primary URL**: Uses connection pooling (recommended)
- **Unpooled URL**: Direct connection (for specific use cases)

### Troubleshooting

#### Connection Issues
```bash
# Test database connection
npm run test:db
```

#### Migration Issues
```bash
# Reset and re-run migration
npm run migrate:reset
```

#### SSL Certificate Issues
If you encounter SSL issues, try adding a timeout:
```env
DATABASE_URL=postgresql://username:password@host:5432/database?sslmode=require&connect_timeout=15
```

## 📊 Database Schema

### Tables Created
- `users` - User accounts with roles
- `customers` - Customer information
- `vendors` - Vendor/supplier data
- `jobs` - Print job tracking
- `job_items` - Individual job items
- `invoices` - Invoice management
- `payments` - Payment tracking
- `expenses` - Expense management
- `pricing_templates` - Pricing configurations
- `vendor_price_lists` - Vendor pricing

### User Roles
- **admin** - Full system access
- **manager** - Management level access
- **staff** - Basic user access

## 🎯 Next Steps

1. ✅ Database is configured
2. ✅ Run migration to create tables
3. ✅ Seed sample data
4. ✅ Start backend server
5. ✅ Test API endpoints
6. ✅ Start frontend development server

## 🔗 Useful Commands

```bash
# Start backend
npm run dev

# Run migrations
npm run migrate

# Seed data
npm run seed

# Test connection
npm run test:db

# View logs
npm run logs
```

## 📞 Support

If you encounter any issues:
1. Check database connection
2. Verify environment variables
3. Run migration again
4. Check Neon dashboard for connection status

---

**Database Status**: ✅ Ready for NexPro Printing Press Management System
