import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import PlatformRoute from './components/PlatformRoute';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TenantOnboarding from './pages/TenantOnboarding';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Jobs from './pages/Jobs';
import Invoices from './pages/Invoices';
import Quotes from './pages/Quotes';
import Expenses from './pages/Expenses';
import Pricing from './pages/Pricing';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import Leads from './pages/Leads';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Employees from './pages/Employees';
import Payroll from './pages/Payroll';
import Accounting from './pages/Accounting';
import Checkout from './pages/Checkout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminTenants from './pages/admin/AdminTenants';
import AdminBilling from './pages/admin/AdminBilling';
import AdminReports from './pages/admin/AdminReports';
import AdminHealth from './pages/admin/AdminHealth';
import AdminSettings from './pages/admin/AdminSettings';

const WorkspaceRoot = () => {
  const { user } = useAuth();

  if (user?.isPlatformAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <MainLayout />;
};

function AppContent() {
  // ForcePasswordChange disabled - invited users set their own password during signup
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<TenantOnboarding />} />
        
        <Route
          path="/"
          element={
            <PrivateRoute>
              <WorkspaceRoot />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="leads" element={<Leads />} />
          <Route path="reports" element={<Reports />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="employees" element={<Employees />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="accounting" element={<Accounting />} />
          <Route path="users" element={<Users />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="checkout" element={<Checkout />} />
        </Route>

        <Route
          path="/admin"
          element={
            <PrivateRoute>
              <PlatformRoute>
                <AdminLayout />
              </PlatformRoute>
            </PrivateRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="health" element={<AdminHealth />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AntdApp>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;


