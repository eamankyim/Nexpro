# ABS (African Business Suite) - Business Management System - Frontend

React frontend application for ABS (African Business Suite) - Business Management System.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher; v20 recommended — see `.nvmrc`)
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

### Lighthouse (optional)

With `npm run dev` running on port 3000, generate an HTML report in this folder:

```bash
npm run lighthouse:local
```

Opens nothing automatically; open `lighthouse-report.html` in a browser. Uses `npx lighthouse` (no extra install if you have Chrome).

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

## 📱 Testing on your phone (same Wi‑Fi)

1. **Backend** must be running on your machine (e.g. `npm run dev` in `Backend/` on port 5001).
2. **Frontend** dev server listens on all interfaces (`host: true` in Vite). Start it:
   ```bash
   npm run dev
   ```
3. **Find your computer’s IP** (same Wi‑Fi as the phone):
   ```bash
   npm run show-ip
   ```
   Or manually: macOS/Linux `ifconfig | grep "inet "`, Windows `ipconfig` → use `192.168.x.x` or `10.x.x.x`.
4. On your **phone**, open: `http://<your-IP>:3000`  
   Example: `http://192.168.1.42:3000`
5. **API and uploads** go through the Vite proxy when on LAN, so no extra config.

Ensure phone and computer are on the same network. If the app doesn’t load, check firewall (allow port 3000).

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

### Vercel deployment

- **Root Directory:** In Vercel project settings, set **Root Directory** to `Frontend` (capital F). On Linux (Vercel) the path is case-sensitive; `frontend` will not match the repo folder.
- **Node:** Vercel uses `.nvmrc` (Node 20) and `engines` in `package.json`. Build uses extra memory (`NODE_OPTIONS=--max-old-space-size=4096`) for the large bundle.
- If the build still fails, open the **Inspect** URL from the deploy log and check the build logs for the exact error.

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


