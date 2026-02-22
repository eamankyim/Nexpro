import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HintModeProvider } from './context/HintModeContext';
import { ThemeProvider } from './context/ThemeContext';
import { PWAInstallProvider } from './context/PWAInstallContext';
import { PlatformAdminPermissionsProvider } from './context/PlatformAdminPermissionsContext';
import PrivateRoute from './components/PrivateRoute';
import PlatformRoute from './components/PlatformRoute';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import TableSkeleton from './components/TableSkeleton';
import PWAInstallBanner from './components/PWAInstallBanner';
import { useSwipeBack } from './hooks/useSwipeBack';
import { useIOSKeyboardFix } from './hooks/useKeyboardHandling';
import Products from './pages/Products';
import TourProvider from './components/tour/TourProvider';

// Lazy load heavy pages for code splitting (Products is static to avoid duplicate React)
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const PayInvoice = lazy(() => import('./pages/PayInvoice'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Vendors = lazy(() => import('./pages/Vendors'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Reports = lazy(() => import('./pages/Reports'));
const Materials = lazy(() => import('./pages/Materials'));
const Equipment = lazy(() => import('./pages/Equipment'));
const Leads = lazy(() => import('./pages/Leads'));
const Users = lazy(() => import('./pages/Users'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Employees = lazy(() => import('./pages/Employees'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Sales = lazy(() => import('./pages/Sales'));
const Orders = lazy(() => import('./pages/Orders'));
const Shops = lazy(() => import('./pages/Shops'));
const Pharmacies = lazy(() => import('./pages/Pharmacies'));
const Drugs = lazy(() => import('./pages/Drugs'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const FootTraffic = lazy(() => import('./pages/FootTraffic'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminTenants = lazy(() => import('./pages/admin/AdminTenants'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses'));
const AdminRoles = lazy(() => import('./pages/admin/AdminRoles'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const Workspace = lazy(() => import('./pages/Workspace'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#166534] mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const WorkspaceRoot = () => {
  const { user } = useAuth();

  if (user?.isPlatformAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <MainLayout />;
};

// SSO Handler Component
const SSOHandler = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sabitoSSO, loginWithToken } = useAuth();

  useEffect(() => {
    const sabitoToken = searchParams.get('sabitoToken');
    const nexproToken = searchParams.get('token'); // From GET /sso callback
    
    if (sabitoToken) {
      // Remove token from URL
      searchParams.delete('sabitoToken');
      setSearchParams(searchParams, { replace: true });

      // Perform SSO login via POST endpoint
      sabitoSSO(sabitoToken)
        .then(() => {
          // SSO successful, user is now logged in
          // AuthContext will handle redirect
          window.location.href = '/dashboard';
        })
        .catch((error) => {
          console.error('SSO login failed:', error);
          // Redirect to login page on error
          window.location.href = '/login?error=sso_failed';
        });
    } else if (nexproToken && searchParams.get('success') === 'true') {
      // Handle GET /sso callback with ShopWISE token
      searchParams.delete('token');
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
      
      // Store token and login
      localStorage.setItem('token', nexproToken);
      loginWithToken(nexproToken)
        .then(() => {
          window.location.href = '/dashboard';
        })
        .catch((error) => {
          console.error('SSO callback login failed:', error);
          window.location.href = '/login?error=sso_failed';
        });
    }
  }, [searchParams, sabitoSSO, loginWithToken, setSearchParams]);

  return null;
};

// Component to handle mobile gestures and fixes inside Router context
const MobileEnhancements = () => {
  // Enable swipe-back gesture for mobile navigation
  useSwipeBack();
  // Fix iOS keyboard viewport issues
  useIOSKeyboardFix();
  return null;
};

function AppContent() {
  // ForcePasswordChange (Complete Your Profile) shown only for admin-created users; excluded for invited users and platform admins
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <MobileEnhancements />
      <SSOHandler />
      <TourProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/pay-invoice/:token" element={<PayInvoice />} />
          <Route
            path="/onboarding"
            element={
              <PrivateRoute>
                <Onboarding />
              </PrivateRoute>
            }
          />
          
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
            <Route path="workspace" element={<Workspace />} />
            <Route path="customers" element={<Customers />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="sales" element={<Sales />} />
            <Route path="orders" element={<Orders />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="leads" element={<Leads />} />
            <Route path="reports">
              <Route index element={<Navigate to="/reports/overview" replace />} />
              <Route path="overview" element={<Reports />} />
              <Route path="smart-report" element={<Reports />} />
              <Route path="compliance" element={<Reports />} />
            </Route>
            <Route path="materials" element={<Materials />} />
            <Route path="inventory" element={<Navigate to="/materials" replace />} />
            <Route path="assets" element={<Navigate to="/materials" replace />} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="employees" element={<Employees />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="shops" element={<Shops />} />
            <Route path="pharmacies" element={<Pharmacies />} />
            <Route path="products" element={<Products />} />
            <Route path="drugs" element={<Drugs />} />
            <Route path="prescriptions" element={<Prescriptions />} />
            <Route path="foot-traffic" element={<FootTraffic />} />
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
                  <PlatformAdminPermissionsProvider>
                    <AdminLayout />
                  </PlatformAdminPermissionsProvider>
                </PlatformRoute>
              </PrivateRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="expenses" element={<AdminExpenses />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="roles" element={<Navigate to="/admin/settings?tab=roles" replace />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="health" element={<AdminHealth />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </TourProvider>
    </Router>
  );
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ThemeProvider>
          <PWAInstallProvider>
            <AuthProvider>
              <HintModeProvider>
                <AppContent />
                <PWAInstallBanner />
              </HintModeProvider>
            </AuthProvider>
          </PWAInstallProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
}

export default App;


