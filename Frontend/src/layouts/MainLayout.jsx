import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { SmartSearchProvider } from '../context/SmartSearchContext';
import { useAuth } from '../context/AuthContext';
import { useResponsive, useSafeAreaInsets } from '../hooks/useResponsive';
import AssistantChatPanel from '../components/AssistantChatPanel';
import FloatingActionButton from '../components/FloatingActionButton';
import ForcePasswordChange from '../components/ForcePasswordChange';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { user, shouldCompleteProfile, refreshAuthState } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const safeAreaInsets = useSafeAreaInsets();
  const canUseAssistant = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    // Auto-expand sidebar when switching to desktop
    if (!isMobile && !isTablet) {
      setCollapsed(false);
    }
  }, [isMobile, isTablet]);

  if (shouldCompleteProfile) {
    console.log('[ProfileCompletion] Showing ForcePasswordChange modal for', user?.email);
    return (
      <ForcePasswordChange
        visible
        onComplete={async () => {
          if (typeof refreshAuthState === 'function') {
            await refreshAuthState();
          }
        }}
      />
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50"
      style={{
        paddingTop: safeAreaInsets.top > 0 ? `${safeAreaInsets.top}px` : undefined,
        paddingLeft: safeAreaInsets.left > 0 ? `${safeAreaInsets.left}px` : undefined,
        paddingRight: safeAreaInsets.right > 0 ? `${safeAreaInsets.right}px` : undefined,
        paddingBottom: safeAreaInsets.bottom > 0 ? `${safeAreaInsets.bottom}px` : undefined,
      }}
    >
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      )}

      <SmartSearchProvider>
        {/* Main Content Area */}
        <div className={cn(
          "transition-all duration-300",
          !isMobile && (collapsed ? "lg:ml-20" : "lg:ml-64")
        )}>
          <Header />
          <main className={cn(
            "pt-1 pb-4 md:pt-2 md:pb-6",
            // Responsive padding: mobile (12px), tablet (24px), desktop (32px)
            "px-3 md:px-6 lg:px-8"
          )}>
            <div className={cn(
              "bg-transparent rounded-lg min-h-[calc(100vh-8rem)]",
              // Responsive padding: mobile (pt-1 pb-3), tablet/desktop (pt-2 pb-6)
              "pt-1 pb-3 md:pt-2 md:pb-6"
            )}>
              <Outlet />
            </div>
          </main>
        </div>
      </SmartSearchProvider>

      {canUseAssistant && (
        <>
          <AssistantChatPanel open={chatOpen} onOpenChange={setChatOpen} />
          <FloatingActionButton
            icon={MessageCircle}
            label="AI Assistant"
            onClick={() => setChatOpen(true)}
            position="bottom-right"
            showOnAllSizes
            hideOnScroll={false}
          />
        </>
      )}
    </div>
  );
};

export default MainLayout;
