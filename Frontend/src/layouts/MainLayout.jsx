import { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { MessageCircle, Mail, Sparkles, Loader2 } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { SmartSearchProvider } from '../context/SmartSearchContext';
import NotificationWebSocketListener from '../components/NotificationWebSocketListener';
import AssistantChatPanel from '../components/AssistantChatPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import { useSafeAreaInsets } from '../hooks/useResponsive';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { showSuccess, showError } from '../utils/toast';

const MainLayout = () => {
  const safeAreaInsets = useSafeAreaInsets();
  const navigate = useNavigate();
  const { user, activeTenant, memberships, refreshAuthState } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const showVerifyEmailBanner = useMemo(
    () => Boolean(user && !user.emailVerifiedAt),
    [user, user?.emailVerifiedAt]
  );
  const onboardingCompleted = useMemo(
    () => Boolean(activeTenant?.metadata?.onboarding?.completedAt),
    [activeTenant?.metadata?.onboarding?.completedAt]
  );
  const wasInvited = useMemo(
    () => Array.isArray(memberships) && memberships.some((m) => !!m.invitedBy),
    [memberships]
  );
  const showOnboardingBanner = useMemo(
    () => Boolean(user?.emailVerifiedAt && !onboardingCompleted && !wasInvited),
    [user?.emailVerifiedAt, onboardingCompleted, wasInvited]
  );

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification();
      showSuccess('Verification email sent. Check your inbox.');
      await refreshAuthState();
    } catch (err) {
      showError(err, err?.response?.data?.message || 'Failed to send. Try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <SmartSearchProvider>
      <NotificationWebSocketListener />
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
        )}

        {/* Main Content Area */}
        <div className={cn(
          "transition-all duration-300",
          !isMobile && (collapsed ? "ml-20" : "ml-64")
        )}>
          <Header />
          {/* Prioritized banners: verify email first, then onboarding only after verified */}
          {showVerifyEmailBanner && (
            <div className="mx-4 sm:mx-4 lg:mx-6 mt-2 rounded-lg border border-amber-600/50 bg-amber-500/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Verify your email</p>
                  <p className="text-sm text-muted-foreground">We sent a link to your email. Click it to verify, or resend below.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-600/50 text-amber-700 hover:bg-amber-500/20"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resend link'}
              </Button>
            </div>
          )}
          {!showVerifyEmailBanner && showOnboardingBanner && (
            <div className="mx-4 sm:mx-4 lg:mx-6 mt-2 rounded-lg border border-[#166534]/50 bg-[#166534]/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Sparkles className="h-5 w-5 shrink-0 text-[#166534]" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">Finish setting up your business</p>
                  <p className="text-sm text-muted-foreground">Complete your business profile to get the most out of ShopWISE.</p>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-[#166534] hover:bg-[#14532d] text-white"
                onClick={() => navigate('/onboarding')}
              >
                Complete profile
              </Button>
            </div>
          )}
          <main
            className="w-full bg-muted/50 py-4 sm:py-6"
            style={{
              paddingBottom: safeAreaInsets.bottom > 0 ? `calc(1.5rem + ${safeAreaInsets.bottom}px)` : undefined,
            }}
          >
            <div className="min-h-[calc(100vh-8rem)] px-4 sm:px-4 lg:px-6">
              <Outlet />
            </div>
          </main>
        </div>

        {/* AI Assistant: slide-over panel + floating button */}
        <AssistantChatPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
        {!assistantOpen && (
          <FloatingActionButton
            icon={MessageCircle}
            label="AI Assistant"
            tooltip="AI Assistant"
            onClick={() => setAssistantOpen(true)}
            position="bottom-left"
            showOnAllSizes
            show
            hideOnScroll={false}
          />
        )}
      </div>
    </SmartSearchProvider>
  );
};

export default MainLayout;
