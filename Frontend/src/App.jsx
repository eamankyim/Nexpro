import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BrandingProvider } from './context/BrandingContext';
import { PublicConfigProvider, usePublicConfig } from './context/PublicConfigContext';
import { HintModeProvider } from './context/HintModeContext';
import { ThemeProvider } from './context/ThemeContext';
import { PWAInstallProvider } from './context/PWAInstallContext';
import { PlatformAdminPermissionsProvider } from './context/PlatformAdminPermissionsContext';
import PrivateRoute from './components/PrivateRoute';
import PlatformRoute from './components/PlatformRoute';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ErrorBoundary from './components/ErrorBoundary';
import RequireWorkspaceManager from './components/RequireWorkspaceManager';
import TableSkeleton from './components/TableSkeleton';
import { SHOW_SHOPS } from './constants';
import PWAInstallBanner from './components/PWAInstallBanner';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
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
const ViewQuote = lazy(() => import('./pages/ViewQuote'));
const TrackJob = lazy(() => import('./pages/TrackJob'));
const TenantTrackLookup = lazy(() => import('./pages/TenantTrackLookup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Marketing = lazy(() => import('./pages/Marketing'));
const AskAI = lazy(() => import('./pages/AskAI'));
const Automations = lazy(() => import('./pages/Automations'));
const Vendors = lazy(() => import('./pages/Vendors'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Reports = lazy(() => import('./pages/Reports'));
const ExportData = lazy(() => import('./pages/ExportData'));
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
const Tasks = lazy(() => import('./pages/Tasks'));
const Deliveries = lazy(() => import('./pages/Deliveries'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
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

const FeatureRoute = ({ featureKey, children, fallback = '/dashboard' }) => {
  const { hasFeature } = useAuth();
  if (typeof hasFeature === 'function' && !hasFeature(featureKey)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
};

/** Backend Sabito SSO redirects here with ?token=JWT&success=true — must not hit * → /dashboard (strips query). */
const SsoCallbackScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    <p className="text-sm text-muted-foreground">Signing you in…</p>
  </div>
);

// SSO Handler Component
const SSOHandler = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const { sabitoSSO, loginWithToken } = useAuth();

  useEffect(() => {
    const sabitoToken = searchParams.get('sabitoToken');
    const nexproToken = searchParams.get('token'); // JWT from GET /sso → /sso-callback only

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
    } else if (
      pathname === '/sso-callback' &&
      nexproToken &&
      searchParams.get('success') === 'true'
    ) {
      // Handle GET /sso callback with ABS token (only on this path — not /signup?token= invite links)
      searchParams.delete('token');
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });

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
  }, [pathname, searchParams, sabitoSSO, loginWithToken, setSearchParams]);

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
            <Route path="/view-quote/:token" element={<ViewQuote />} />
            <Route path="/track-job/:token" element={<TrackJob />} />
            <Route path="/track/:tenantSlug" element={<TenantTrackLookup />} />
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
            <Route path="workspace" element={<Navigate to="/dashboard" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="customers" element={<FeatureRoute featureKey="crm"><Customers /></FeatureRoute>} />
            <Route path="marketing" element={<FeatureRoute featureKey="marketing"><RequireWorkspaceManager><Marketing /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="automations" element={<FeatureRoute featureKey="automations"><RequireWorkspaceManager><Automations /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="ask-ai" element={<RequireWorkspaceManager><AskAI /></RequireWorkspaceManager>} />
            <Route path="vendors" element={<FeatureRoute featureKey="crm"><Vendors /></FeatureRoute>} />
            <Route path="jobs" element={<FeatureRoute featureKey="jobAutomation"><Jobs /></FeatureRoute>} />
            <Route path="deliveries" element={<FeatureRoute featureKey="deliveries"><Deliveries /></FeatureRoute>} />
            <Route path="sales" element={<FeatureRoute featureKey="paymentsExpenses"><Sales /></FeatureRoute>} />
            <Route path="orders" element={<FeatureRoute featureKey="orders"><Orders /></FeatureRoute>} />
            <Route path="quotes" element={<FeatureRoute featureKey="quoteAutomation"><Quotes /></FeatureRoute>} />
            <Route path="invoices" element={<FeatureRoute featureKey="invoices"><Invoices /></FeatureRoute>} />
            <Route path="expenses" element={<FeatureRoute featureKey="expenses"><Expenses /></FeatureRoute>} />
            <Route path="pricing" element={<FeatureRoute featureKey="pricingTemplates"><Pricing /></FeatureRoute>} />
            <Route path="leads" element={<FeatureRoute featureKey="leadPipeline"><Leads /></FeatureRoute>} />
            <Route path="reports">
              <Route index element={<FeatureRoute featureKey="reports"><Navigate to="/reports/overview" replace /></FeatureRoute>} />
              <Route path="overview" element={<FeatureRoute featureKey="reports"><RequireWorkspaceManager><Reports /></RequireWorkspaceManager></FeatureRoute>} />
              <Route path="smart-report" element={<FeatureRoute featureKey="reports"><RequireWorkspaceManager><Reports /></RequireWorkspaceManager></FeatureRoute>} />
              <Route path="compliance" element={<FeatureRoute featureKey="reports"><RequireWorkspaceManager><Reports /></RequireWorkspaceManager></FeatureRoute>} />
            </Route>
            <Route path="export-data" element={<FeatureRoute featureKey="advancedReporting"><RequireWorkspaceManager><ExportData /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="materials" element={<FeatureRoute featureKey="materials"><Materials /></FeatureRoute>} />
            <Route path="inventory" element={<Navigate to="/materials" replace />} />
            <Route path="assets" element={<Navigate to="/materials" replace />} />
            <Route path="equipment" element={<FeatureRoute featureKey="materials"><Equipment /></FeatureRoute>} />
            <Route path="employees" element={<FeatureRoute featureKey="payroll"><RequireWorkspaceManager><Employees /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="payroll" element={<FeatureRoute featureKey="payroll"><RequireWorkspaceManager><Payroll /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="accounting" element={<FeatureRoute featureKey="accounting"><RequireWorkspaceManager><Accounting /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="shops" element={SHOW_SHOPS ? <FeatureRoute featureKey="shopsModule"><Shops /></FeatureRoute> : <Navigate to="/dashboard" replace />} />
            <Route path="pharmacies" element={<FeatureRoute featureKey="pharmacyOps"><Pharmacies /></FeatureRoute>} />
            <Route path="products" element={<FeatureRoute featureKey="products"><Products /></FeatureRoute>} />
            <Route path="drugs" element={<FeatureRoute featureKey="pharmacyOps"><Drugs /></FeatureRoute>} />
            <Route path="prescriptions" element={<FeatureRoute featureKey="pharmacyOps"><Prescriptions /></FeatureRoute>} />
            <Route path="users" element={<FeatureRoute featureKey="roleManagement"><RequireWorkspaceManager><Users /></RequireWorkspaceManager></FeatureRoute>} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<RequireWorkspaceManager><Settings /></RequireWorkspaceManager>} />
            <Route path="checkout" element={<RequireWorkspaceManager><Checkout /></RequireWorkspaceManager>} />
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
            <Route path="workspace" element={<Navigate to="/admin/tasks" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </TourProvider>
    </Router>
  );
}

function GoogleAuthWrapper({ children }) {
  const { googleClientId } = usePublicConfig();
  useEffect(() => {
    const masked = googleClientId ? `${googleClientId.substring(0, 15)}...` : '(empty)';
    console.log('[App] GoogleOAuthProvider clientId:', masked);
  }, [googleClientId]);
  // Do not use key={googleClientId} here — it remounts the entire subtree (Router, auth), causing full-screen flashes.
  return (
    <GoogleOAuthProvider clientId={googleClientId || ''}>
      {children}
    </GoogleOAuthProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <PublicConfigProvider>
        <GoogleAuthWrapper>
          <ThemeProvider>
            <PWAInstallProvider>
              <AuthProvider>
                <BrandingProvider>
                  <HintModeProvider>
                    <AppContent />
                    <PWAInstallBanner />
                    <PWAUpdatePrompt />
                  </HintModeProvider>
                </BrandingProvider>
              </AuthProvider>
            </PWAInstallProvider>
          </ThemeProvider>
        </GoogleAuthWrapper>
      </PublicConfigProvider>
    </ErrorBoundary>
  );
}

export default App;


