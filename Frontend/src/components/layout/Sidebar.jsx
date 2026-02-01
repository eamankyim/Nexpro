import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  FilePlus, 
  Users, 
  BarChart3, 
  Settings, 
  UserCog,
  Package,
  ChevronLeft,
  ChevronRight,
  Menu,
  ShoppingCart,
  Store,
  Receipt,
  Banknote,
  LayoutList,
  PackagePlus,
  UserPlus,
  Pill
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';

const getMenuItems = (businessType, isAdmin) => {
  // Standalone (most important): Dashboard, Sales, Products, Jobs (printing_press), Customers, Invoices, Expenses
  const baseItems = [
    { key: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];
  if (businessType === 'shop') {
    baseItems.push({ key: '/sales', icon: ShoppingCart, label: 'Sales' });
    baseItems.push({ key: '/products', icon: Package, label: 'Products' });
  }
  if (businessType === 'printing_press') {
    baseItems.push({ key: '/jobs', icon: FileText, label: 'Jobs' });
  }
  baseItems.push(
    { key: '/customers', icon: Users, label: 'Customers' },
    { key: '/invoices', icon: Receipt, label: 'Invoices' },
    { key: '/expenses', icon: Banknote, label: 'Expenses' },
  );

  // Advanced group: everything else (Leads, Vendors, Shops/Pharmacies, Payroll, Accounting, Inventory, Employees, etc.)
  const advancedChildren = [
    { key: '/leads', label: 'Leads' },
    { key: '/vendors', label: 'Vendors' },
    { key: '/payroll', label: 'Payroll' },
    { key: '/accounting', label: 'Accounting' },
    { key: '/inventory', label: 'Inventory' },
    { key: '/employees', label: 'Employees' },
  ];
  if (businessType === 'shop') {
    advancedChildren.splice(2, 0, { key: '/shops', label: 'Shops' });
    advancedChildren.push({ key: '/foot-traffic', label: 'Foot Traffic' });
  }
  if (businessType === 'pharmacy') {
    advancedChildren.splice(2, 0, { key: '/pharmacies', label: 'Pharmacies' });
    advancedChildren.push({ key: '/prescriptions', label: 'Prescriptions' });
    advancedChildren.push({ key: '/drugs', label: 'Drugs' });
    advancedChildren.push({ key: '/foot-traffic', label: 'Foot Traffic' });
  }
  if (businessType === 'printing_press') {
    advancedChildren.push({ key: '/quotes', label: 'Quotes' });
    advancedChildren.push({ key: '/pricing', label: 'Pricing' });
  }

  baseItems.push({
    key: 'advanced',
    icon: LayoutList,
    label: 'Advanced',
    children: advancedChildren,
  });

  // Reports section with children
  const reportsChildren = [
    { key: '/reports/overview', label: 'Overview' },
    { key: '/reports/smart-report', label: 'Smart Report' },
  ];

  baseItems.push(
    {
      key: 'reports',
      icon: BarChart3,
      label: 'Reports',
      children: reportsChildren
    },
    { key: '/users', icon: UserCog, label: 'Users', adminOnly: true },
    { key: '/settings', icon: Settings, label: 'Settings' }
  );

  return baseItems.filter(item => !item.adminOnly || isAdmin);
};

/**
 * Top 3 quick actions per business type (Point of Sale, Restock, Add customer, etc.)
 * @param {string|null} businessType - 'shop' | 'pharmacy' | 'printing_press'
 * @returns {Array<{ label: string, path: string, icon: React.Component }>}
 */
const getQuickActions = (businessType) => {
  if (!businessType) return [];
  if (businessType === 'shop') {
    return [
      { label: 'Point of Sale', path: '/sales?openPOS=1', icon: ShoppingCart },
      { label: 'Restock', path: '/inventory', icon: PackagePlus },
      { label: 'Add customer', path: '/customers?add=1', icon: UserPlus },
    ];
  }
  if (businessType === 'pharmacy') {
    return [
      { label: 'Point of Sale', path: '/sales?openPOS=1', icon: ShoppingCart },
      { label: 'New prescription', path: '/prescriptions', icon: Pill },
      { label: 'Restock', path: '/inventory', icon: PackagePlus },
    ];
  }
  if (businessType === 'printing_press') {
    return [
      { label: 'New job', path: '/jobs', icon: FileText },
      { label: 'New quote', path: '/quotes', icon: FilePlus },
      { label: 'Add customer', path: '/customers?add=1', icon: UserPlus },
    ];
  }
  return [];
};

export function Sidebar({ collapsed, onCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, activeTenant } = useAuth();
  const [openKeys, setOpenKeys] = useState([]);

  const businessType = activeTenant?.businessType || null;
  const menuItems = useMemo(() => getMenuItems(businessType, isAdmin), [businessType, isAdmin]);
  const quickActions = useMemo(() => getQuickActions(businessType), [businessType]);

  // Open the group that contains the current route by default
  useEffect(() => {
    const pathname = location.pathname;
    const parent = menuItems.find(
      (item) =>
        item.children &&
        item.children.some(
          (c) => pathname === c.key || pathname.startsWith(c.key + '/')
        )
    );
    if (parent && !openKeys.includes(parent.key)) {
      setOpenKeys((prev) => [...prev, parent.key]);
    }
  }, [location.pathname, menuItems, openKeys]);

  // Route prefetching map - maps routes to their lazy import functions
  const routePrefetchMap = useMemo(() => ({
    '/dashboard': () => import('../../pages/Dashboard'),
    '/customers': () => import('../../pages/Customers'),
    '/vendors': () => import('../../pages/Vendors'),
    '/jobs': () => import('../../pages/Jobs'),
    '/sales': () => import('../../pages/Sales'),
    '/invoices': () => import('../../pages/Invoices'),
    '/quotes': () => import('../../pages/Quotes'),
    '/expenses': () => import('../../pages/Expenses'),
    '/pricing': () => import('../../pages/Pricing'),
    '/reports/overview': () => import('../../pages/Reports'),
    '/reports/smart-report': () => import('../../pages/Reports'),
    '/inventory': () => import('../../pages/Inventory'),
    '/leads': () => import('../../pages/Leads'),
    '/users': () => import('../../pages/Users'),
    '/settings': () => import('../../pages/Settings'),
    '/employees': () => import('../../pages/Employees'),
    '/payroll': () => import('../../pages/Payroll'),
    '/accounting': () => import('../../pages/Accounting'),
    '/shops': () => import('../../pages/Shops'),
    '/pharmacies': () => import('../../pages/Pharmacies'),
    '/products': () => import('../../pages/Products'),
    '/drugs': () => import('../../pages/Drugs'),
    '/prescriptions': () => import('../../pages/Prescriptions'),
    '/foot-traffic': () => import('../../pages/FootTraffic'),
  }), []);

  const handlePrefetch = useCallback((key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      const prefetchFn = routePrefetchMap[key];
      if (prefetchFn) {
        // Prefetch the route component
        prefetchFn().catch(() => {
          // Silently fail if prefetch fails
        });
      }
    }
  }, [routePrefetchMap]);

  const handleMenuClick = useCallback((key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
    }
  }, [navigate]);

  const toggleSubmenu = useCallback((key) => {
    setOpenKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  }, []);

  const handleParentClick = useCallback((item) => {
    if (collapsed) {
      onCollapse?.(false);
      setOpenKeys(prev => (prev.includes(item.key) ? prev : [...prev, item.key]));
    } else {
      toggleSubmenu(item.key);
    }
  }, [collapsed, onCollapse, toggleSubmenu]);

  const tooltipContentClass = 'shadow-none border border-gray-200';

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-white text-gray-900 transition-all duration-300 border-r border-gray-200 overflow-hidden",
      collapsed ? "w-20" : "w-64"
    )}>
      <TooltipProvider delayDuration={200}>
        <div className="h-16 flex-shrink-0 flex items-center justify-center px-4 border-b border-gray-200">
          <div className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center"
          )}>
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#84cc16] text-lg font-bold text-white"
              aria-hidden
            >
              S
            </span>
            {!collapsed && (
              <div className="flex items-center">
                <span className="text-xl font-bold text-[#166534]">Shop</span>
                <span className="text-xl font-bold text-[#84cc16]">WISE</span>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-1">
          {menuItems.map((item) => (
              <div key={item.key}>
                {item.children ? (
                  (() => {
                    const isOpen = openKeys.includes(item.key);
                    const parentBtn = (
                      <button
                        onClick={() => handleParentClick(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-700",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronRight className={cn(
                              "h-4 w-4 transition-transform flex-shrink-0",
                              isOpen && "rotate-90"
                            )} />
                          </>
                        )}
                      </button>
                    );
                    return (
                      <>
                        {collapsed ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{parentBtn}</TooltipTrigger>
                            <TooltipContent side="right" className={tooltipContentClass}>
                              {item.label}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          parentBtn
                        )}
                        {isOpen && !collapsed && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <button
                                key={child.key}
                                onClick={() => handleMenuClick(child.key)}
                                onMouseEnter={() => handlePrefetch(child.key)}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors",
                                  location.pathname === child.key 
                                    ? "bg-[#166534] text-white font-medium hover:bg-[#14532d]" 
                                    : "text-gray-700"
                                )}
                              >
                                {child.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    const leafBtn = (
                      <button
                        onClick={() => handleMenuClick(item.key)}
                        onMouseEnter={() => handlePrefetch(item.key)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors",
                          location.pathname === item.key 
                            ? "bg-[#166534] text-white font-medium hover:bg-[#14532d]" 
                            : "text-gray-700",
                          collapsed && "justify-center px-2"
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </button>
                    );
                    return collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{leafBtn}</TooltipTrigger>
                        <TooltipContent side="right" className={tooltipContentClass}>
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      leafBtn
                    );
                  })()
                )}
              </div>
            ))}
          {quickActions.length > 0 && (
            <div className="-mx-4 mt-2 border-t border-gray-200 pt-2 pb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-1.5">
                Quick actions
              </p>
              <div className="space-y-1 mt-1 px-4">
                {quickActions.map((action) => {
                  const btn = (
                    <button
                      key={action.path}
                      onClick={() => navigate(action.path)}
                      onMouseEnter={() => {
                        const path = action.path.split('?')[0];
                        const prefetchFn = routePrefetchMap[path];
                        if (prefetchFn) prefetchFn().catch(() => {});
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-[#166534]",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#166534] text-white">
                        <action.icon className="h-4 w-4" />
                      </span>
                      {!collapsed && <span>{action.label}</span>}
                    </button>
                  );
                  return collapsed ? (
                    <Tooltip key={action.path}>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right" className={tooltipContentClass}>
                        {action.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    btn
                  );
                })}
              </div>
            </div>
          )}
        </nav>
        <div className="flex-shrink-0 p-3 border-t border-gray-200">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCollapse?.(!collapsed)}
                className={cn(
                  "w-full hover:bg-gray-100 text-gray-700",
                  collapsed && "w-10 mx-auto"
                )}
              >
                {collapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className={tooltipContentClass}>
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, activeTenant } = useAuth();
  const [openKeys, setOpenKeys] = useState([]);

  const businessType = activeTenant?.businessType || null;
  const menuItems = useMemo(() => getMenuItems(businessType, isAdmin), [businessType, isAdmin]);
  const quickActions = useMemo(() => getQuickActions(businessType), [businessType]);

  // Open the group that contains the current route when sheet opens or location changes
  useEffect(() => {
    const pathname = location.pathname;
    const parent = menuItems.find(
      (item) =>
        item.children &&
        item.children.some(
          (c) => pathname === c.key || pathname.startsWith(c.key + '/')
        )
    );
    if (parent && !openKeys.includes(parent.key)) {
      setOpenKeys((prev) => [...prev, parent.key]);
    }
  }, [location.pathname, menuItems, openKeys]);

  const routePrefetchMap = useMemo(() => ({
    '/dashboard': () => import('../../pages/Dashboard'),
    '/customers': () => import('../../pages/Customers'),
    '/vendors': () => import('../../pages/Vendors'),
    '/jobs': () => import('../../pages/Jobs'),
    '/sales': () => import('../../pages/Sales'),
    '/invoices': () => import('../../pages/Invoices'),
    '/quotes': () => import('../../pages/Quotes'),
    '/expenses': () => import('../../pages/Expenses'),
    '/pricing': () => import('../../pages/Pricing'),
    '/reports/overview': () => import('../../pages/Reports'),
    '/reports/smart-report': () => import('../../pages/Reports'),
    '/inventory': () => import('../../pages/Inventory'),
    '/leads': () => import('../../pages/Leads'),
    '/users': () => import('../../pages/Users'),
    '/settings': () => import('../../pages/Settings'),
    '/employees': () => import('../../pages/Employees'),
    '/payroll': () => import('../../pages/Payroll'),
    '/accounting': () => import('../../pages/Accounting'),
    '/shops': () => import('../../pages/Shops'),
    '/pharmacies': () => import('../../pages/Pharmacies'),
    '/products': () => import('../../pages/Products'),
    '/drugs': () => import('../../pages/Drugs'),
    '/prescriptions': () => import('../../pages/Prescriptions'),
    '/foot-traffic': () => import('../../pages/FootTraffic'),
  }), []);

  const handlePrefetch = useCallback((key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      const prefetchFn = routePrefetchMap[key];
      if (prefetchFn) {
        prefetchFn().catch(() => {});
      }
    }
  }, [routePrefetchMap]);

  const handleMenuClick = useCallback((key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
      setOpen(false);
    }
  }, [navigate]);

  const toggleSubmenu = (key) => {
    setOpenKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden min-h-[44px] min-w-[44px] bg-gray-100 hover:bg-gray-200"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-white text-gray-900 p-0 border-r border-gray-200">
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-[#166534]">Shop</span>
            <span className="text-2xl font-bold text-[#84cc16]">WISE</span>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => (
              <div key={item.key}>
                {item.children ? (
                  (() => {
                    const isOpen = openKeys.includes(item.key);
                    return (
                      <div>
                        <button
                          onClick={() => toggleSubmenu(item.key)}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-100 transition-colors text-gray-700 min-h-[44px]"
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            isOpen && "rotate-90"
                          )} />
                        </button>
                        {isOpen && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <button
                                key={child.key}
                                onClick={() => handleMenuClick(child.key)}
                                onMouseEnter={() => handlePrefetch(child.key)}
                                className={cn(
                                  "w-full text-left px-3 py-3 rounded-md hover:bg-gray-100 transition-colors text-gray-700 min-h-[44px]",
                                  location.pathname === child.key && "bg-gray-100 text-gray-900 font-medium"
                                )}
                              >
                                {child.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <button
                    onClick={() => handleMenuClick(item.key)}
                    onMouseEnter={() => handlePrefetch(item.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-100 transition-colors min-h-[44px]",
                      location.pathname === item.key 
                        ? "bg-[#166534] text-white font-medium hover:bg-[#14532d]" 
                        : "text-gray-700"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )}
              </div>
            ))}
          {quickActions.length > 0 && (
            <div className="-mx-4 mt-2 border-t border-gray-200 pt-2 pb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-1.5">
                Quick actions
              </p>
              <div className="space-y-1 mt-1 px-4">
                {quickActions.map((action) => (
                  <button
                    key={action.path}
                    onClick={() => {
                      navigate(action.path);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-100 transition-colors text-[#166534] min-h-[44px]"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#166534] text-white">
                      <action.icon className="h-4 w-4" />
                    </span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
