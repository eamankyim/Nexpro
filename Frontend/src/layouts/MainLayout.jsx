import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { cn } from '@/lib/utils';

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

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
    <div className="min-h-screen bg-gray-50">
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
        <main className="px-4 pt-2 pb-6">
          <div className="bg-transparent rounded-lg pt-2 px-6 pb-6 min-h-[calc(100vh-8rem)]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
