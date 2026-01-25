import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import PlatformRoute from './components/PlatformRoute';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import TableSkeleton from './components/TableSkeleton';

// Lazy load heavy pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
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
const Inventory = lazy(() => import('./pages/Inventory'));
const Leads = lazy(() => import('./pages/Leads'));
const Users = lazy(() => import('./pages/Users'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Employees = lazy(() => import('./pages/Employees'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Sales = lazy(() => import('./pages/Sales'));
const Shops = lazy(() => import('./pages/Shops'));
const Pharmacies = lazy(() => import('./pages/Pharmacies'));
const Products = lazy(() => import('./pages/Products'));
const Drugs = lazy(() => import('./pages/Drugs'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const POS = lazy(() => import('./pages/POS'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminTenants = lazy(() => import('./pages/admin/AdminTenants'));
const AdminBilling = lazy(() => import('./pages/admin/AdminBilling'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

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
      // Handle GET /sso callback with Nexpro token
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

function AppContent() {
  // ForcePasswordChange disabled - invited users set their own password during signup
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <SSOHandler />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
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
            <Route path="customers" element={<Customers />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="sales" element={<Sales />} />
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
            <Route path="shops" element={<Shops />} />
            <Route path="pharmacies" element={<Pharmacies />} />
            <Route path="products" element={<Products />} />
            <Route path="drugs" element={<Drugs />} />
            <Route path="prescriptions" element={<Prescriptions />} />
            <Route path="pos" element={<POS />} />
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
      </Suspense>
    </Router>
  );
}

function App() {
  useEffect(() => {
    // Add dark class to html element for dark mode
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;


