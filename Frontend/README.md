# NEXPro - Printing Press Management System - Frontend

React + Ant Design frontend application for NEXPro - Printing Press Management System.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Backend API running on `http://localhost:5000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:5000
```

3. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🔑 Default Login Credentials

After running the backend seeder:
- **Admin**: `admin@printingpress.com` / `admin123`
- **Manager**: `manager@printingpress.com` / `manager123`
- **Staff**: `staff@printingpress.com` / `staff123`

## 📁 Project Structure

```
Frontend/
├── public/              # Static files
├── src/
│   ├── components/      # Reusable components
│   │   └── PrivateRoute.jsx
│   ├── context/         # React Context
│   │   └── AuthContext.jsx
│   ├── layouts/         # Layout components
│   │   └── MainLayout.jsx
│   ├── pages/          # Page components
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Customers.jsx
│   │   ├── Vendors.jsx
│   │   ├── Jobs.jsx
│   │   ├── Payments.jsx
│   │   ├── Expenses.jsx
│   │   ├── Pricing.jsx
│   │   ├── Users.jsx
│   │   └── Profile.jsx
│   ├── services/       # API services
│   │   ├── api.js
│   │   ├── authService.js
│   │   ├── customerService.js
│   │   ├── vendorService.js
│   │   ├── jobService.js
│   │   ├── paymentService.js
│   │   ├── expenseService.js
│   │   ├── pricingService.js
│   │   ├── dashboardService.js
│   │   └── userService.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
└── package.json
```

## 🎨 Features

### Implemented
- ✅ Authentication (Login/Logout)
- ✅ Dashboard with statistics
- ✅ Customer Management (CRUD)
- ✅ Vendor Management (CRUD)
- ✅ Jobs List & Filtering
- ✅ User Profile
- ✅ Role-based Access Control
- ✅ Responsive Layout
- ✅ Modern UI with Ant Design

### To Implement
- ⏳ Complete Job Management (Create/Edit)
- ⏳ Payment Tracking
- ⏳ Expense Management
- ⏳ Pricing Templates
- ⏳ User Management (Admin)
- ⏳ Advanced Analytics
- ⏳ File Upload
- ⏳ Notifications

## 🔐 Authentication

The app uses JWT token-based authentication:
- Tokens are stored in `localStorage`
- Auto-logout on 401 responses
- Protected routes with `PrivateRoute` component
- Role-based UI rendering

## 🛠️ API Services

All API calls are centralized in the `services/` directory:
- `api.js` - Axios instance with interceptors
- Individual service files for each resource
- Automatic token attachment
- Error handling

## 📱 Responsive Design

- Mobile-friendly sidebar
- Collapsible navigation
- Responsive tables
- Adaptive forms

## 🎨 Customization

### Theme
Edit theme in `src/App.jsx`:
```jsx
<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 6,
    },
  }}
>
```

### API URL
Change API URL in `.env`:
```env
VITE_API_URL=https://your-api-url.com
```

## 🚢 Production Build

```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## 📦 Technologies Used

- **React 18** - UI library
- **Vite** - Build tool
- **Ant Design 5** - UI components
- **React Router 6** - Routing
- **Axios** - HTTP client
- **Day.js** - Date formatting
- **Recharts** - Charts (optional)

## 🔄 State Management

- **AuthContext** - Authentication state
- React hooks for local state
- API services for data fetching

## 🧪 Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| VITE_API_URL | Backend API URL | http://localhost:5000 |

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📄 License

ISC


