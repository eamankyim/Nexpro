import { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Mail, Loader2, WifiOff, X } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { SmartSearchProvider } from '../context/SmartSearchContext';
import { StudioLocationProvider } from '../context/StudioLocationContext';
import { ShopProvider } from '../context/ShopContext';
import NotificationWebSocketListener from '../components/NotificationWebSocketListener';
import PaymentCollectionRequiredBanner from '../components/PaymentCollectionRequiredBanner';
import BillingGraceBanner from '../components/BillingGraceBanner';
import BillingLockedScreen from '../components/BillingLockedScreen';
import ShopAccessBanner from '../components/ShopAccessBanner';
import SupportAccessBanner from '../components/SupportAccessBanner';
import { useResponsive, useSafeAreaInsets, BREAKPOINTS } from '../hooks/useResponsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useDismissibleDashboardBanner } from '../hooks/useDismissibleDashboardBanner';
import authService from '../services/authService';
import { showSuccess, showError } from '../utils/toast';

// Floating AI assistant is off for now. To restore: import AssistantChatPanel, FloatingActionButton, MessageCircle; add state + FAB + panel (see git history).

const MainLayout = () => {
  const location = useLocation();
  const safeAreaInsets = useSafeAreaInsets();
  const { isMobile: isBelowTablet } = useResponsive({ mobileBreakpoint: BREAKPOINTS.TABLET });
  const {
    user,
    activeTenantId,
    refreshAuthState,
    needsEmailVerification,
    billingStatus,
    isSupportAccessActive,
  } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const wasBelowTabletRef = useRef(isBelowTablet);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const showVerifyEmailBanner = useMemo(() => Boolean(needsEmailVerification), [needsEmailVerification]);
  const isDashboardRoute = location.pathname === '/' || location.pathname === '/dashboard';
  const dashboardBannerScopeId = activeTenantId || user?.id || 'global';
  const {
    dismissed: verifyEmailDismissedOnDashboard,
    dismiss: dismissVerifyEmailDashboard,
  } = useDismissibleDashboardBanner('verify-email', dashboardBannerScopeId, showVerifyEmailBanner);
  const {
    dismissed: paymentCollectionDismissedOnDashboard,
    dismiss: dismissPaymentCollectionDashboard,
  } = useDismissibleDashboardBanner('payment-collection-required', dashboardBannerScopeId);
  const showVerifyEmailInLayout =
    showVerifyEmailBanner && !(isDashboardRoute && verifyEmailDismissedOnDashboard);

  const isBillingExemptRoute = useMemo(() => {
    const path = location.pathname;
    if (path === '/checkout' || path === '/profile') return true;
    if (path.startsWith('/settings')) return true;
    return false;
  }, [location.pathname]);

  const showBillingLock =
    !isSupportAccessActive &&
    billingStatus?.canAccessApp === false &&
    billingStatus?.billingStatus === 'locked' &&
    !isBillingExemptRoute;

  // When banner would show, refetch /auth/me once so we get latest emailVerifiedAt (e.g. user verified via link or script)
  const hasRefetchedForVerifyBanner = useRef(false);
  useEffect(() => {
    if (!showVerifyEmailBanner || !user || hasRefetchedForVerifyBanner.current) return;
    hasRefetchedForVerifyBanner.current = true;
    refreshAuthState().catch(() => {});
  }, [showVerifyEmailBanner, user, refreshAuthState]);

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification();
      showSuccess('Verification email sent. Check your inbox.');
      await refreshAuthState();
    } catch (err) {
      const msg = err?.response?.data?.message || '';
      if (err?.response?.status === 400 && msg.toLowerCase().includes('already verified')) {
        await refreshAuthState();
        showSuccess('Your email is already verified.');
        return;
      }
      showError(err, msg || 'Failed to send. Try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  // Auto-expand only when transitioning from mobile/tablet to desktop.
  // Keep user's manual collapse state while already on desktop.
  useEffect(() => {
    const wasBelowTablet = wasBelowTabletRef.current;
    if (wasBelowTablet && !isBelowTablet && collapsed) {
      setCollapsed(false);
    }
    wasBelowTabletRef.current = isBelowTablet;
  }, [isBelowTablet, collapsed]);

  return (
    <SmartSearchProvider>
      <StudioLocationProvider>
      <ShopProvider>
      <NotificationWebSocketListener />
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        {!isBelowTablet && (
          <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
        )}

        {/* Main Content Area */}
        <div
          className={cn(
            'transition-all duration-300',
            !isBelowTablet && (collapsed ? 'ml-20' : 'ml-64')
          )}
        >
          <Header />
          <SupportAccessBanner />
          {/* Global offline banner */}
          {!isOnline && (
            <div className="mx-4 sm:mx-4 lg:mx-6 mt-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5 flex items-center gap-2 text-red-800 dark:text-red-200 text-sm">
              <WifiOff className="h-4 w-4 shrink-0" />
              <span>You&apos;re offline. Reconnect to continue, or use the mobile app for offline work.</span>
            </div>
          )}
          {/* Email verification banner only in layout; onboarding banner is on Dashboard */}
          {showVerifyEmailInLayout && (
            <div className="mx-4 sm:mx-4 lg:mx-6 mt-2 rounded-lg border border-amber-600/50 bg-amber-500/10 p-3 sm:p-3 lg:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center sm:items-start gap-2 sm:gap-3 min-w-0">
                <Mail className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm sm:text-base font-medium text-foreground">Verify your email</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    We sent a link to your email. Click it to verify, or resend below.
                  </p>
                </div>
              </div>
              <div className="flex w-full sm:w-auto items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none shrink-0 border-amber-600/50 text-amber-700 hover:bg-amber-500/20"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend link'}
                </Button>
                {isDashboardRoute && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-amber-700 hover:bg-amber-500/20"
                    aria-label="Hide email verification banner on dashboard"
                    onClick={dismissVerifyEmailDashboard}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
          {/* Auto-send on but payment not set: refetched every 10 min */}
          <PaymentCollectionRequiredBanner
            dismissible={isDashboardRoute}
            dismissed={isDashboardRoute && paymentCollectionDismissedOnDashboard}
            onDismiss={dismissPaymentCollectionDashboard}
          />
          <ShopAccessBanner />
          <BillingGraceBanner billing={billingStatus} />
          <main
            className="w-full bg-muted/50 py-4 sm:py-6"
            style={{
              paddingBottom:
                safeAreaInsets.bottom > 0
                  ? `calc(1.5rem + ${safeAreaInsets.bottom}px)`
                  : undefined,
            }}
          >
            <div className="min-h-[calc(100dvh-8rem)] px-4 sm:px-4 lg:px-6">
              {showBillingLock ? <BillingLockedScreen billing={billingStatus} /> : <Outlet />}
            </div>
          </main>
        </div>

      </div>
      </ShopProvider>
      </StudioLocationProvider>
    </SmartSearchProvider>
  );
};

export default MainLayout;
