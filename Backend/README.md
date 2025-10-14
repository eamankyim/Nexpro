# Printing Press Management System - Backend API

A comprehensive backend API for managing printing press operations including customers, jobs, vendors, payments, expenses, and pricing.

## 🚀 Features

- **Customer Management**: Track customer information, contact details, and balances
- **Job Management**: Create and manage print jobs with detailed specifications
- **Vendor Management**: Manage suppliers and vendor relationships
- **Payment Tracking**: Record and track both income and expense payments
- **Expense Management**: Track business expenses with categorization
- **Pricing Templates**: Create pricing templates for different print jobs
- **User Authentication**: JWT-based authentication with role-based access control
- **Statistics & Reports**: Get insights on jobs, payments, and expenses

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- npm or yarn

## 🔧 Installation

1. Clone the repository
```bash
git clone <repository-url>
cd Backend
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file from the example
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/printing_press_db
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:3000
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

5. Start the server
```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "admin"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Customers

#### Get All Customers
```http
GET /api/customers?page=1&limit=10&search=john
Authorization: Bearer <token>
```

#### Create Customer
```http
POST /api/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "company": "ABC Company",
  "email": "john@abc.com",
  "phone": "123-456-7890",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001"
}
```

### Jobs

#### Get All Jobs
```http
GET /api/jobs?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Create Job
```http
POST /api/jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "uuid",
  "title": "Business Cards",
  "description": "1000 business cards",
  "quantity": 1000,
  "paperType": "Glossy",
  "paperSize": "3.5x2",
  "colorType": "color",
  "quotedPrice": 150.00,
  "dueDate": "2024-12-31"
}
```

### Payments

#### Create Payment
```http
POST /api/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "income",
  "customerId": "uuid",
  "jobId": "uuid",
  "amount": 150.00,
  "paymentMethod": "credit_card",
  "paymentDate": "2024-01-15"
}
```

### Pricing

#### Calculate Job Price
```http
POST /api/pricing/calculate
Authorization: Bearer <token>
Content-Type: application/json

{
  "jobType": "business_cards",
  "paperType": "glossy",
  "paperSize": "3.5x2",
  "colorType": "color",
  "quantity": 1000,
  "additionalOptions": ["lamination"]
}
```

## 🔐 User Roles

- **admin**: Full access to all resources
- **manager**: Can create, read, update (limited delete)
- **staff**: Can read and update assigned jobs

## 📊 Database Models

### User
- id, name, email, password, role, isActive

### Customer
- id, name, company, email, phone, address, creditLimit, balance

### Vendor
- id, name, company, email, phone, address, category, balance

### Job
- id, jobNumber, customerId, title, status, priority, quantity, pricing details

### Payment
- id, paymentNumber, type, customerId, vendorId, jobId, amount, paymentMethod

### Expense
- id, expenseNumber, vendorId, jobId, category, amount, status

### PricingTemplate
- id, name, category, basePrice, pricePerUnit, discountTiers

## 🛡️ Security

- Helmet.js for security headers
- CORS configuration
- JWT token authentication
- Password hashing with bcrypt
- Role-based access control

## 🔄 API Response Format

Success Response:
```json
{
  "success": true,
  "data": {},
  "count": 10,
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

Error Response:
```json
{
  "success": false,
  "error": "Error message here"
}
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| DATABASE_URL | PostgreSQL connection string | - |
| JWT_SECRET | JWT secret key | - |
| JWT_EXPIRE | JWT expiration time | 7d |
| CORS_ORIGIN | Frontend URL | http://localhost:3000 |

## 🚦 Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run in production mode
npm start
```

## 📦 Project Structure

```
Backend/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── server.js        # Entry point
├── package.json     # Dependencies
└── README.md        # Documentation
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.


