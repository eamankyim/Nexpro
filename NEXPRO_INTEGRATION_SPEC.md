# NEXPro Integration Specification
## Complete Codebase Documentation for Sabito Integration

---

## 1. Database Schema

### 1.1 Customer Table (`customers`)

**Table Name:** `customers`

**Columns:**
```sql
- id: UUID (Primary Key, auto-generated)
- tenantId: UUID (Foreign Key → tenants.id, NOT NULL)
- name: VARCHAR (NOT NULL)
- company: VARCHAR
- email: VARCHAR (validated as email)
- phone: VARCHAR
- address: TEXT
- city: VARCHAR
- state: VARCHAR
- zipCode: VARCHAR
- country: VARCHAR (default: 'USA')
- taxId: VARCHAR
- creditLimit: DECIMAL(10, 2) (default: 0)
- howDidYouHear: VARCHAR (marketing source tracking)
- referralName: VARCHAR
- balance: DECIMAL(10, 2) (default: 0, calculated field)
- notes: TEXT
- isActive: BOOLEAN (default: true)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

**Indexes:**
- Primary key on `id`
- Foreign key index on `tenantId`
- Unique constraint not explicitly defined on email (email can be duplicated across tenants)

**Relationships:**
- `customers.tenantId` → `tenants.id` (Many-to-One)
- `customers.id` → `jobs.customerId` (One-to-Many)
- `customers.id` → `quotes.customerId` (One-to-Many)
- `customers.id` → `invoices.customerId` (One-to-Many)
- `customers.id` → `payments.customerId` (One-to-Many)

**Model File:** `Backend/models/Customer.js`

---

### 1.2 Invoice Table (`invoices`)

**Table Name:** `invoices`

**Columns:**
```sql
- id: UUID (Primary Key, auto-generated)
- tenantId: UUID (Foreign Key → tenants.id, NOT NULL)
- invoiceNumber: VARCHAR (UNIQUE, NOT NULL, format: INV-YYYYMM-####)
- jobId: UUID (Foreign Key → jobs.id, NOT NULL)
- customerId: UUID (Foreign Key → customers.id, NOT NULL)
- invoiceDate: DATE (default: NOW)
- dueDate: DATE (NOT NULL)
- subtotal: DECIMAL(10, 2) (default: 0)
- taxRate: DECIMAL(5, 2) (default: 0, percentage e.g., 12.5 for 12.5%)
- taxAmount: DECIMAL(10, 2) (default: 0, auto-calculated)
- discountType: ENUM('percentage', 'fixed') (default: 'fixed')
- discountValue: DECIMAL(10, 2) (default: 0)
- discountAmount: DECIMAL(10, 2) (default: 0, auto-calculated)
- discountReason: VARCHAR(255)
- totalAmount: DECIMAL(10, 2) (default: 0, auto-calculated: subtotal + taxAmount - discountAmount)
- amountPaid: DECIMAL(10, 2) (default: 0)
- balance: DECIMAL(10, 2) (default: 0, auto-calculated: totalAmount - amountPaid)
- status: ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled') (default: 'draft')
- paymentTerms: VARCHAR (default: 'Due on Receipt', e.g., "Net 30", "Net 15")
- items: JSON (array of line items from the job)
- notes: TEXT
- termsAndConditions: TEXT
- sentDate: DATE (when invoice was sent to customer)
- paidDate: DATE (when invoice was fully paid)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

**Status Values:**
- `draft` - Invoice created but not sent
- `sent` - Invoice sent to customer
- `paid` - Invoice fully paid
- `partial` - Partial payment received
- `overdue` - Past due date and not paid
- `cancelled` - Invoice cancelled

**Indexes:**
- Primary key on `id`
- Unique constraint on `invoiceNumber`
- Foreign key indexes on `tenantId`, `jobId`, `customerId`

**Relationships:**
- `invoices.tenantId` → `tenants.id` (Many-to-One)
- `invoices.customerId` → `customers.id` (Many-to-One)
- `invoices.jobId` → `jobs.id` (Many-to-One)

**Model File:** `Backend/models/Invoice.js`

**Auto-Calculations (via Model Hooks):**
- `taxAmount` = (subtotal × taxRate) / 100
- `discountAmount` = percentage ? (subtotal × discountValue) / 100 : discountValue
- `totalAmount` = subtotal + taxAmount - discountAmount
- `balance` = totalAmount - amountPaid
- `status` auto-updates based on balance and dueDate

---

### 1.3 Job Table (`jobs`)

**Table Name:** `jobs`

**Key Columns:**
```sql
- id: UUID (Primary Key)
- tenantId: UUID (Foreign Key → tenants.id, NOT NULL)
- jobNumber: VARCHAR (UNIQUE, NOT NULL)
- customerId: UUID (Foreign Key → customers.id, NOT NULL)
- title: VARCHAR (NOT NULL)
- description: TEXT
- status: ENUM('new', 'in_progress', 'on_hold', 'cancelled', 'completed') (default: 'new')
- finalPrice: DECIMAL(10, 2)
- completionDate: DATE
- ... (many more fields)
```

**Key Relationship:** When `jobs.status` changes to `'completed'`, an invoice is automatically generated.

---

### 1.4 Payment Table (`payments`)

**Table Name:** `payments`

**Key Columns:**
```sql
- id: UUID (Primary Key)
- tenantId: UUID (Foreign Key → tenants.id, NOT NULL)
- paymentNumber: VARCHAR (UNIQUE, NOT NULL)
- type: ENUM('income', 'expense') (NOT NULL)
- customerId: UUID (Foreign Key → customers.id, nullable)
- vendorId: UUID (Foreign Key → vendors.id, nullable)
- jobId: UUID (Foreign Key → jobs.id, nullable)
- amount: DECIMAL(10, 2) (NOT NULL)
- paymentMethod: ENUM('cash', 'mobile_money', 'check', 'credit_card', 'bank_transfer', 'other')
- paymentDate: DATE (default: NOW)
- status: ENUM('pending', 'completed', 'failed', 'refunded') (default: 'completed')
```

**Relationships:**
- Payments can be linked to invoices (via jobId or customerId)
- When payment is recorded on invoice, a Payment record is created

---

### 1.5 Multi-Tenant Architecture

**Tenant Table (`tenants`):**
- All business data is tenant-scoped
- Every customer, invoice, job, etc. has a `tenantId` foreign key
- Users can belong to multiple tenants via `user_tenants` join table
- Data isolation is enforced at the API level via middleware

**Key Tables:**
- `tenants` - Business/organization accounts
- `users` - User accounts
- `user_tenants` - Many-to-many relationship (user membership in tenants)

---

## 2. API Documentation

### 2.1 Base URL
```
Base URL: /api
Full URL: https://your-api-domain.com/api
```

### 2.2 Authentication

**Method:** JWT Bearer Token

**Headers Required:**
```
Authorization: Bearer {jwt_token}
x-tenant-id: {tenant_uuid}  // Required for multi-tenant isolation
```

**Token Generation:**
- Tokens generated on login via `/api/auth/login`
- Token expiration: 7 days (configurable via `JWT_EXPIRE` env var)
- Secret key: `JWT_SECRET` environment variable

**Auth Endpoints:**
- `POST /api/auth/login` - Login (returns token)
- `POST /api/auth/register` - Register (requires invite token)
- `GET /api/auth/me` - Get current user (protected)
- `PUT /api/auth/updatedetails` - Update user details (protected)
- `PUT /api/auth/updatepassword` - Update password (protected)

**Login Request:**
```json
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Login Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "admin"
    },
    "token": "jwt_token_here",
    "memberships": [...],
    "defaultTenantId": "uuid"
  }
}
```

---

### 2.3 Customer Endpoints

#### Get All Customers
```http
GET /api/customers?page=1&limit=10&search=john
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `search` - Search term (searches name, company, email)

**Response:**
```json
{
  "success": true,
  "count": 50,
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "name": "John Doe",
      "company": "ABC Company",
      "email": "john@abc.com",
      "phone": "123-456-7890",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "taxId": null,
      "creditLimit": 5000.00,
      "balance": 0.00,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### Get Single Customer
```http
GET /api/customers/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Response:** Same structure as single customer object above, includes related jobs (limit 10).

#### Create Customer
```http
POST /api/customers
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
Content-Type: application/json

{
  "name": "John Doe",
  "company": "ABC Company",
  "email": "john@abc.com",
  "phone": "123-456-7890",
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zipCode": "10001",
  "country": "USA",
  "creditLimit": 5000,
  "howDidYouHear": "Referral",
  "referralName": "Jane Smith"
}
```

**Validation:**
- `name` is required
- `email` must be valid email format (if provided)
- `tenantId` is automatically set from `x-tenant-id` header

**Response:** Created customer object

#### Update Customer
```http
PUT /api/customers/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
Content-Type: application/json

{
  "name": "John Doe Updated",
  "creditLimit": 10000
}
```

**Response:** Updated customer object

#### Delete Customer
```http
DELETE /api/customers/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

---

### 2.4 Invoice Endpoints

#### Get All Invoices
```http
GET /api/invoices?page=1&limit=10&status=draft&customerId={uuid}&jobId={uuid}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Query Parameters:**
- `page`, `limit` - Pagination
- `status` - Filter by status (draft, sent, paid, partial, overdue, cancelled)
- `customerId` - Filter by customer
- `jobId` - Filter by job
- `search` - Search invoice number

**Response:**
```json
{
  "success": true,
  "count": 25,
  "pagination": {...},
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "invoiceNumber": "INV-202401-0001",
      "jobId": "uuid",
      "customerId": "uuid",
      "invoiceDate": "2024-01-15",
      "dueDate": "2024-02-15",
      "subtotal": 1000.00,
      "taxRate": 12.5,
      "taxAmount": 125.00,
      "discountType": "percentage",
      "discountValue": 10,
      "discountAmount": 100.00,
      "totalAmount": 1025.00,
      "amountPaid": 0.00,
      "balance": 1025.00,
      "status": "draft",
      "paymentTerms": "Net 30",
      "items": [...],
      "customer": {
        "id": "uuid",
        "name": "John Doe",
        "company": "ABC Company",
        "email": "john@abc.com",
        "phone": "123-456-7890"
      },
      "job": {
        "id": "uuid",
        "jobNumber": "JOB-202401-0001",
        "title": "Business Cards",
        "status": "completed"
      },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### Get Single Invoice
```http
GET /api/invoices/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Response:** Full invoice object with customer and job details

#### Create Invoice (Manual)
```http
POST /api/invoices
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
Content-Type: application/json

{
  "jobId": "uuid",
  "dueDate": "2024-02-15",
  "paymentTerms": "Net 30",
  "taxRate": 12.5,
  "discountType": "percentage",
  "discountValue": 10,
  "discountReason": "Early payment discount",
  "notes": "Thank you for your business",
  "termsAndConditions": "Payment is due within 30 days"
}
```

**Note:** Most invoices are **auto-generated** when a job status changes to `'completed'`. Manual creation is available as fallback.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-202401-0001",
    ...
  }
}
```

#### Update Invoice
```http
PUT /api/invoices/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
Content-Type: application/json

{
  "status": "sent",
  "notes": "Updated notes"
}
```

#### Record Payment on Invoice
```http
POST /api/invoices/{id}/payment
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
Content-Type: application/json

{
  "amount": 500.00,
  "paymentMethod": "credit_card",
  "referenceNumber": "REF-12345",
  "paymentDate": "2024-01-20"
}
```

**Behavior:**
- Updates `invoice.amountPaid`
- Recalculates `invoice.balance`
- Updates `invoice.status` (to 'paid' if balance = 0, or 'partial')
- Creates a `Payment` record
- Updates customer balance
- Triggers notification if invoice becomes fully paid

**Response:** Updated invoice object

#### Mark Invoice as Fully Paid (without payment details)
```http
POST /api/invoices/{id}/mark-paid
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Behavior:**
- Sets `amountPaid = totalAmount`
- Sets `balance = 0`
- Sets `status = 'paid'`
- Sets `paidDate = now`
- Updates customer balance

#### Send Invoice
```http
POST /api/invoices/{id}/send
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Behavior:**
- Sets `status = 'sent'` (if currently 'draft')
- Sets `sentDate = now`

#### Cancel Invoice
```http
POST /api/invoices/{id}/cancel
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

**Behavior:**
- Sets `status = 'cancelled'`
- Cannot record payments on cancelled invoices

#### Delete Invoice
```http
DELETE /api/invoices/{id}
Authorization: Bearer {token}
x-tenant-id: {tenant_id}
```

---

### 2.5 Response Format

**Success Response:**
```json
{
  "success": true,
  "count": 10,  // For list endpoints
  "pagination": {  // For paginated endpoints
    "page": 1,
    "limit": 10,
    "totalPages": 5
  },
  "data": {}  // Or []
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message here"
}
```

**Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

---

## 3. Customer Model Structure

### 3.1 Customer Object Structure

```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID
  tenantId: "550e8400-e29b-41d4-a716-446655440001",  // UUID
  name: "John Doe",  // Required
  company: "ABC Company",
  email: "john@abc.com",  // Validated as email
  phone: "123-456-7890",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  zipCode: "10001",
  country: "USA",  // Default: "USA"
  taxId: "TAX-12345",
  creditLimit: 5000.00,  // DECIMAL, default: 0
  howDidYouHear: "Referral",  // Marketing source
  referralName: "Jane Smith",
  balance: 0.00,  // DECIMAL, calculated field
  notes: "Important customer notes",
  isActive: true,  // BOOLEAN, default: true
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z"
}
```

### 3.2 Customer Creation/Update Logic

**File:** `Backend/controllers/customerController.js`

**Create Logic:**
1. Request body is sanitized (removes `tenantId` if present)
2. `tenantId` is automatically set from `req.tenantId` (from middleware)
3. Customer is created via Sequelize ORM
4. Validation is handled by model (email format, required fields)

**Validation Rules:**
- `name` is required (NOT NULL)
- `email` must be valid email format (if provided)
- No explicit unique constraint on email (can duplicate across tenants)

**Duplicate Handling:**
- No duplicate prevention at database level
- Duplicates allowed (same email can exist for different tenants)
- Frontend can implement duplicate checking if needed

**Update Logic:**
1. Customer is fetched with tenant filter (ensures tenant isolation)
2. Request body is sanitized
3. Customer is updated via Sequelize ORM
4. All fields are optional for update (only provided fields are updated)

---

## 4. Invoice Model Structure

### 4.1 Invoice Object Structure

```javascript
{
  id: "550e8400-e29b-41d4-a716-446655440000",  // UUID
  tenantId: "550e8400-e29b-41d4-a716-446655440001",  // UUID
  invoiceNumber: "INV-202401-0001",  // UNIQUE, format: INV-YYYYMM-####
  jobId: "550e8400-e29b-41d4-a716-446655440002",  // Required, FK → jobs.id
  customerId: "550e8400-e29b-41d4-a716-446655440003",  // Required, FK → customers.id
  invoiceDate: "2024-01-15T10:00:00.000Z",  // Default: NOW
  dueDate: "2024-02-15T00:00:00.000Z",  // Required
  subtotal: 1000.00,  // DECIMAL(10,2), default: 0
  taxRate: 12.5,  // DECIMAL(5,2), percentage (e.g., 12.5 = 12.5%)
  taxAmount: 125.00,  // DECIMAL(10,2), auto-calculated
  discountType: "percentage",  // ENUM: 'percentage' | 'fixed'
  discountValue: 10.00,  // DECIMAL(10,2)
  discountAmount: 100.00,  // DECIMAL(10,2), auto-calculated
  discountReason: "Early payment discount",
  totalAmount: 1025.00,  // DECIMAL(10,2), auto-calculated (subtotal + taxAmount - discountAmount)
  amountPaid: 500.00,  // DECIMAL(10,2), default: 0
  balance: 525.00,  // DECIMAL(10,2), auto-calculated (totalAmount - amountPaid)
  status: "partial",  // ENUM: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled'
  paymentTerms: "Net 30",  // String, default: "Due on Receipt"
  items: [  // JSON array (line items from job)
    {
      "category": "Business Cards",
      "description": "Standard business cards",
      "quantity": 500,
      "unitPrice": 2.00,
      "total": 1000.00
    }
  ],
  notes: "Thank you for your business",
  termsAndConditions: "Payment is due within 30 days",
  sentDate: "2024-01-16T10:00:00.000Z",  // When invoice was sent
  paidDate: null,  // When invoice was fully paid
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
  
  // Populated via includes:
  customer: {
    id: "uuid",
    name: "John Doe",
    company: "ABC Company",
    email: "john@abc.com",
    phone: "123-456-7890"
  },
  job: {
    id: "uuid",
    jobNumber: "JOB-202401-0001",
    title: "Business Cards",
    status: "completed"
  }
}
```

### 4.2 Invoice Lifecycle

**Status Transitions:**
1. **draft** → Created but not sent
2. **draft** → **sent** (via `/send` endpoint or when first payment recorded)
3. **sent** → **partial** (when payment recorded but not fully paid)
4. **sent/partial** → **paid** (when balance = 0)
5. **sent/partial** → **overdue** (auto-updated when dueDate < now and balance > 0)
6. **any** → **cancelled** (via `/cancel` endpoint)

**When Invoices are Created:**
1. **Auto-generated:** When `jobs.status` changes to `'completed'`
   - Triggered in `jobController.updateJob()` or `jobController.createJob()`
   - Invoice includes all job items
   - Default settings: Net 30 payment terms, 0% tax, no discount
   - Invoice number format: `INV-YYYYMM-####`

2. **Manual creation:** Via `POST /api/invoices`
   - Requires `jobId`
   - Invoice items are pulled from job

**When Invoices are Marked as Paid:**
1. Via `POST /api/invoices/:id/payment` - Record payment (can be partial)
2. Via `POST /api/invoices/:id/mark-paid` - Mark as fully paid (no payment details)

**Events/Hooks Available:**

**Model Hooks (Sequelize):**
- `beforeSave` - Auto-calculates:
  - `taxAmount` = (subtotal × taxRate) / 100
  - `discountAmount` (based on discountType)
  - `totalAmount` = subtotal + taxAmount - discountAmount
  - `balance` = totalAmount - amountPaid
  - `status` (based on balance and dueDate)

**Controller Events:**
- Payment recorded → Updates customer balance
- Invoice paid → Logs activity (via `activityLogger.logInvoicePaid()`)
- Invoice paid → Sends notification (via `notificationService.notifyInvoicePaid()`)

**Files:**
- Model: `Backend/models/Invoice.js`
- Controller: `Backend/controllers/invoiceController.js`
- Service: `Backend/services/customerBalanceService.js`
- Service: `Backend/services/activityLogger.js`
- Service: `Backend/services/notificationService.js`

---

## 5. Authentication System

### 5.1 Current Auth: JWT Tokens

**Implementation:**
- **Library:** `jsonwebtoken` (npm package)
- **Token Type:** Bearer token in Authorization header
- **Token Secret:** `JWT_SECRET` environment variable
- **Token Expiration:** `JWT_EXPIRE` environment variable (default: '7d')

**Token Generation:**
```javascript
// In authController.js
const token = jwt.sign(
  { id: user.id },  // Payload
  config.jwt.secret,  // Secret from env
  { expiresIn: config.jwt.expire }  // Expiration (7d default)
);
```

**Token Validation:**
```javascript
// In middleware/auth.js
const decoded = jwt.verify(token, config.jwt.secret);
const user = await User.findByPk(decoded.id);
```

**Files:**
- Token generation: `Backend/controllers/authController.js`
- Token validation: `Backend/middleware/auth.js`
- Config: `Backend/config/config.js`

### 5.2 API Security

**Middleware Used:**
1. **`protect`** - Validates JWT token, sets `req.user`
   - File: `Backend/middleware/auth.js`
   - Checks `Authorization: Bearer {token}` header
   - Verifies token signature
   - Loads user from database
   - Returns 401 if invalid/missing

2. **`authorize(...roles)`** - Role-based access control
   - File: `Backend/middleware/auth.js`
   - Checks `req.user.role` against allowed roles
   - Returns 403 if unauthorized

3. **`tenantContext`** - Multi-tenant isolation
   - File: `Backend/middleware/tenant.js` (assumed, not seen)
   - Extracts `x-tenant-id` header
   - Sets `req.tenantId`
   - Filters all queries by tenantId

**Middleware Chain Example:**
```javascript
router.use(protect);  // Must be authenticated
router.use(tenantContext);  // Must provide tenant context
router.post('/', authorize('admin', 'manager'), createCustomer);
```

**CORS Setup:**
- File: `Backend/config/config.js`
- Supports multiple origins via `CORS_ORIGIN` env var (comma-separated)
- Credentials: `true` (allows cookies/auth headers)
- Vercel URLs auto-allowed

**Rate Limiting:**
- Not explicitly implemented in codebase (may be handled by hosting provider)

**API Keys:**
- Not used for API authentication
- JWT tokens are the only authentication method

---

## 6. Webhook/Event System

### 6.1 Current Webhooks

**Status:** No webhook system currently implemented in NEXPro codebase.

**Existing Integrations:**
- Paystack payment gateway (mentioned in `PAYSTACK_INTEGRATION.md`)
  - Webhook endpoint planned: `/api/webhooks/paystack`
  - Not yet implemented
  - Would handle payment confirmation events

**Files Mentioned (but not present):**
- `Backend/controllers/webhookController.js` - Planned
- `Backend/routes/webhookRoutes.js` - Planned
- `Backend/services/paystackService.js` - Has webhook signature verification method

### 6.2 Event System

**No formal event system**, but activity logging exists:

**Activity Logger:**
- File: `Backend/services/activityLogger.js`
- Methods:
  - `logInvoicePaid(invoice, userId)` - Logs when invoice is paid
  - Other activity logging methods

**Notification System:**
- File: `Backend/services/notificationService.js`
- Methods:
  - `notifyInvoicePaid(invoice, triggeredBy)` - Sends in-app notification
  - Other notification methods
- Creates `Notification` records in database
- In-app notifications only (no webhooks/external events)

### 6.3 How Events Are Triggered

**Invoice Paid Event:**
1. Payment recorded via `POST /api/invoices/:id/payment`
2. Invoice status updates to 'paid'
3. `activityLogger.logInvoicePaid()` called
4. `notificationService.notifyInvoicePaid()` called
5. Customer balance updated

**No external webhook/event triggers** - all internal to NEXPro.

---

## 7. Technology Stack

### 7.1 Backend

**Framework:** Express.js (Node.js)
- Version: ^4.18.2
- File: `Backend/server.js`

**Database:** PostgreSQL
- Connection via Sequelize ORM
- Connection string: `DATABASE_URL` environment variable
- Supports Neon PostgreSQL, Render, etc.

**ORM:** Sequelize
- Version: ^6.35.2
- Models: `Backend/models/`
- Migrations: `Backend/migrations/`
- Relationships defined in `Backend/models/index.js`

**Key Dependencies:**
```json
{
  "express": "^4.18.2",
  "sequelize": "^6.35.2",
  "pg": "^8.11.3",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "morgan": "^1.10.0",
  "dotenv": "^16.3.1"
}
```

### 7.2 Frontend

**Framework:** React
- Version: ^18.2.0
- Build tool: Vite
- File: `Frontend/src/App.jsx`

**UI Library:** Ant Design (antd)
- Version: ^5.12.5
- Components used throughout

**State Management:**
- React Context API (`AuthContext`)
- React Query (`@tanstack/react-query`) for server state

**Routing:** React Router DOM
- Version: ^6.20.1

**HTTP Client:** Axios
- Version: ^1.6.2
- Base config: `Frontend/src/services/api.js`
- Interceptors for auth token injection

### 7.3 How Customers/Invoices are Managed in UI

**Customer Management:**
- Page: `Frontend/src/pages/Customers.jsx`
- Service: `Frontend/src/services/customerService.js`
- CRUD operations via API
- List view with search/filter
- Form modal for create/edit

**Invoice Management:**
- Page: `Frontend/src/pages/Invoices.jsx`
- Service: `Frontend/src/services/invoiceService.js`
- List view with status filters
- Detail view with payment recording
- PDF export functionality
- Status badges (draft, sent, paid, etc.)

---

## 8. Integration Patterns

### 8.1 Existing Integrations

**Payment Gateway (Planned):**
- **Paystack** - Ghana/Nigeria payment gateway
- File: `Backend/PAYSTACK_INTEGRATION.md`
- Status: Documentation exists, implementation planned
- Webhook endpoint planned: `/api/webhooks/paystack`

**No other third-party integrations** currently implemented.

### 8.2 How Integrations Are Implemented

**Service Layer Pattern:**
- Services in `Backend/services/`
- Examples:
  - `customerBalanceService.js` - Updates customer balances
  - `invoiceAccountingService.js` - Accounting journal entries
  - `notificationService.js` - In-app notifications
  - `paystackService.js` - Payment gateway (planned)

**Middleware Pattern:**
- Auth middleware for protection
- Tenant middleware for isolation
- Error handling middleware

**Controller Pattern:**
- Controllers in `Backend/controllers/`
- Handle HTTP requests/responses
- Call services/models
- Return standardized JSON responses

---

## 9. Environment Variables

### 9.1 Required Configuration

**Backend (`Backend/.env`):**
```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# CORS (comma-separated, no spaces)
CORS_ORIGIN=http://localhost:3000,https://sabito.com

# Frontend URL (for invite links)
FRONTEND_URL=http://localhost:3000

# Pagination
DEFAULT_PAGE_SIZE=10
MAX_PAGE_SIZE=100
```

**Frontend (`Frontend/.env`):**
```env
VITE_API_URL=http://localhost:5000
# Or in production: https://api.sabito.com
```

---

## 10. Quick Reference Checklist

✅ **Customer Table Schema**
- Table: `customers`
- Columns: id, tenantId, name, email, phone, address, balance, etc.
- Relationships: → jobs, invoices, payments

✅ **Invoice Table Schema**
- Table: `invoices`
- Columns: id, invoiceNumber, jobId, customerId, status, amounts, etc.
- Status: draft, sent, paid, partial, overdue, cancelled
- Auto-calculations: taxAmount, discountAmount, totalAmount, balance

✅ **Customer Model/Service Code**
- Model: `Backend/models/Customer.js`
- Controller: `Backend/controllers/customerController.js`
- Service: `Frontend/src/services/customerService.js`

✅ **Invoice Model/Service Code**
- Model: `Backend/models/Invoice.js`
- Controller: `Backend/controllers/invoiceController.js`
- Service: `Frontend/src/services/invoiceService.js`

✅ **Authentication Mechanism**
- JWT Bearer tokens
- Middleware: `Backend/middleware/auth.js`
- Token generation: `Backend/controllers/authController.js`

✅ **API Endpoint Structure**
- Base: `/api`
- Customers: `/api/customers`
- Invoices: `/api/invoices`
- Auth: `/api/auth`
- Documentation: `Backend/API_ENDPOINTS.md`

✅ **Technology Stack**
- Backend: Express.js + Sequelize + PostgreSQL
- Frontend: React + Vite + Ant Design
- Auth: JWT tokens

✅ **Webhook/Event System**
- No webhooks currently implemented
- Activity logging exists (`activityLogger.js`)
- Notification system exists (`notificationService.js`)
- Paystack webhooks planned

✅ **Integration Patterns**
- Service layer pattern
- Middleware pattern (auth, tenant)
- Controller pattern
- No third-party integrations currently active

---

## 11. Key Integration Points for Sabito

### 11.1 Shared Authentication
- Both apps should use same `JWT_SECRET`
- Tokens work across domains (if CORS allows)
- Token format: `Bearer {jwt_token}` in Authorization header

### 11.2 Shared Database (Recommended)
- Both apps connect to same PostgreSQL database
- Share `users`, `tenants`, `customers` tables
- NEXPro-specific tables: `invoices`, `jobs`, `payments`, etc.

### 11.3 API Integration
- Sabito can call NEXPro API endpoints
- Requires: JWT token + `x-tenant-id` header
- All endpoints are tenant-scoped

### 11.4 Customer Synchronization
- Option A: Shared `customers` table (recommended)
- Option B: Sync customers via API calls
- Option C: Separate customer tables with sync logic

### 11.5 Invoice Creation from Sabito
- Option A: Create invoice via `POST /api/invoices`
- Option B: Create job first, then invoice auto-generates on completion
- Option C: Direct database insert (not recommended)

---

## 12. Files to Share with Sabito Team

### Essential Files:
1. `Backend/models/Customer.js` - Customer model
2. `Backend/models/Invoice.js` - Invoice model
3. `Backend/controllers/customerController.js` - Customer CRUD
4. `Backend/controllers/invoiceController.js` - Invoice CRUD
5. `Backend/controllers/authController.js` - Authentication
6. `Backend/middleware/auth.js` - Auth middleware
7. `Backend/API_ENDPOINTS.md` - API documentation
8. `Backend/models/index.js` - Relationships
9. `Backend/config/config.js` - Configuration

### Migration Files (for schema reference):
- Any migration files that create/alter customers/invoices tables

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**NEXPro Version:** Current codebase as of this date

