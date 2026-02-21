import { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  UserCog,
  Settings,
  Currency,
  AlertTriangle,
  FileSearch,
  Link as LinkIcon,
  Search,
  LogOut,
  UserCheck,
  Briefcase,
  Receipt,
  Menu,
  ChevronDown,
  User,
  UserCircle,
} from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SmartSearchProvider, useSmartSearch } from '../context/SmartSearchContext';
import { usePlatformAdminPermissions } from '../context/PlatformAdminPermissionsContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Footer from '../components/layout/Footer';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

function AdminHeaderSearch() {
  const { placeholder, scope, searchValue, setSearchValue } = useSmartSearch();
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        key={scope}
        type="search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="pl-10 w-full rounded-full"
      />
    </div>
  );
}

const menuItems = [
  { path: '/admin', icon: BarChart3, label: 'Overview' },
  { path: '/admin/tenants', icon: Users, label: 'Tenants' },
  { path: '/admin/customers', icon: UserCircle, label: 'Customers' },
  { path: '/admin/users', icon: UserCog, label: 'Internal Users' },
  { path: '/admin/leads', icon: UserCheck, label: 'Leads' },
  { path: '/admin/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/admin/expenses', icon: Receipt, label: 'Expenses' },
  { path: '/admin/billing', icon: Currency, label: 'Billing' },
  { path: '/admin/reports', icon: FileSearch, label: 'Reports' },
  { path: '/admin/health', icon: AlertTriangle, label: 'System Health' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 1024);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigateToSabito = () => {
    const token = localStorage.getItem('token');
    const sabitoUrl = import.meta.env.VITE_SABITO_URL || 'http://localhost:5175';
    const url = token ? `${sabitoUrl}?nexproToken=${token}` : sabitoUrl;
    window.location.href = url;
  };

  const navContent = (
    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
      {menuItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        const permissionMap = {
          '/admin': 'overview.view',
          '/admin/tenants': 'tenants.view',
          '/admin/customers': 'tenants.view',
          '/admin/users': 'users.view',
          '/admin/leads': 'leads.view',
          '/admin/jobs': 'jobs.view',
          '/admin/expenses': 'expenses.view',
          '/admin/billing': 'billing.view',
          '/admin/reports': 'reports.view',
          '/admin/health': 'health.view',
          '/admin/settings': 'settings.view',
        };
        const requiredPermission = permissionMap[item.path];
        if (requiredPermission && !permissionsLoading && !hasPermission(requiredPermission)) {
          return null;
        }
        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              setMobileSheetOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors min-h-[44px]',
              isActive
                ? 'bg-[#166534] text-white font-medium'
                : 'text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
      <aside className="fixed left-0 top-0 bottom-0 z-50 w-[220px] flex flex-col bg-card border-r border-border overflow-hidden">
        <div className="h-16 flex-shrink-0 flex items-center px-4 border-b border-border">
          <span className="font-semibold text-lg tracking-wide text-foreground">
            ShopWISE Control Center
          </span>
        </div>
        {navContent}
      </aside>
      )}

      <SmartSearchProvider>
        <div className={cn(
          "min-h-screen flex flex-col",
          isMobile ? "ml-0" : "ml-[220px]"
        )}>
          <header className="sticky top-0 z-40 h-16 flex items-center justify-between gap-4 px-6 bg-card border-b border-border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isMobile && (
                <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 min-h-[44px] min-w-[44px] bg-muted hover:bg-muted/80"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[260px] p-0 flex flex-col overflow-hidden">
                    <div className="h-16 flex-shrink-0 flex items-center px-4 border-b border-border">
                      <span className="font-semibold text-lg tracking-wide text-foreground">
                        ShopWISE Control
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">{navContent}</div>
                  </SheetContent>
                </Sheet>
              )}
              <div className="flex-1 max-w-[400px] min-w-[120px]">
                <AdminHeaderSearch />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 h-auto py-1.5 pl-1.5 pr-2 rounded-full bg-muted hover:bg-muted/80 min-h-[44px]"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.profilePicture} alt={user?.name} />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium text-foreground max-w-[140px] truncate">
                      {user?.name || 'User'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    View profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleNavigateToSabito}>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Open Sabito
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 px-6 py-4 sm:p-6 overflow-auto">
            <div className="bg-card rounded-lg border border-border min-h-[360px] p-6">
              <Outlet />
            </div>
          </main>
          <Footer />
        </div>
      </SmartSearchProvider>
    </div>
  );
};

export default AdminLayout;
