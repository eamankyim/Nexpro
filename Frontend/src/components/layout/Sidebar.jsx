import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  FilePlus, 
  Users, 
  ShoppingBag, 
  Wallet, 
  Database, 
  BarChart3, 
  Settings, 
  UserCog,
  AppWindow,
  Package,
  UserCheck,
  ChevronRight,
  Menu,
  ShoppingCart,
  Store,
  Pill,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

const getMenuItems = (businessType, isAdmin) => {
  const baseItems = [
    { key: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { key: '/leads', icon: FilePlus, label: 'Leads' },
    { key: '/customers', icon: Users, label: 'Customers' },
  ];

  // Operations - business type specific
  if (businessType === 'printing_press') {
    baseItems.push({ key: '/jobs', icon: FileText, label: 'Jobs' });
    // Add Vendors directly after Jobs for printing_press
    baseItems.push({ key: '/vendors', icon: Package, label: 'Vendors' });
  } else if (businessType === 'shop' || businessType === 'pharmacy') {
    baseItems.push({ key: '/sales', icon: ShoppingCart, label: 'Sales' });
  }

  // Sales & Operations section (only for shop/pharmacy, not for printing_press)
  const salesOpsChildren = [];
  if (businessType === 'shop') {
    salesOpsChildren.push({ key: '/vendors', label: 'Vendors' });
    salesOpsChildren.push({ key: '/shops', label: 'Shops' });
  }
  if (businessType === 'pharmacy') {
    salesOpsChildren.push({ key: '/vendors', label: 'Vendors' });
    salesOpsChildren.push({ key: '/pharmacies', label: 'Pharmacies' });
  }

  // Financial section
  const financialChildren = [
    { key: '/invoices', label: 'Invoices' },
    { key: '/expenses', label: 'Expenses' },
    { key: '/payroll', label: 'Payroll' },
    { key: '/accounting', label: 'Accounting' }
  ];
  if (businessType === 'printing_press') {
    financialChildren.push(
      { key: '/quotes', label: 'Quotes' },
      { key: '/pricing', label: 'Pricing' }
    );
  }

  // Resources section
  const resourcesChildren = [
    { key: '/inventory', label: 'Inventory' },
    { key: '/employees', label: 'Employees' }
  ];
  if (businessType === 'shop') {
    resourcesChildren.push({ key: '/products', label: 'Products' });
  }
  if (businessType === 'pharmacy') {
    resourcesChildren.push({ key: '/drugs', label: 'Drugs' });
  }

  // Add POS for shops
  if (businessType === 'shop') {
    baseItems.push({ key: '/pos', icon: CreditCard, label: 'POS' });
  }

  // Add Prescriptions for pharmacy
  if (businessType === 'pharmacy') {
    baseItems.push({ key: '/prescriptions', icon: Pill, label: 'Prescriptions' });
  }

  // Add collapsible sections
  // Only add Sales & Operations section for shop/pharmacy (not for printing_press)
  if (businessType === 'shop' || businessType === 'pharmacy') {
    baseItems.push({
      key: 'sales-operations',
      icon: AppWindow,
      label: 'Sales & Operations',
      children: salesOpsChildren
    });
  }
  
  baseItems.push(
    {
      key: 'financial',
      icon: Wallet,
      label: 'Financial',
      children: financialChildren
    },
    {
      key: 'resources',
      icon: Database,
      label: 'Resources',
      children: resourcesChildren
    }
  );

  // Common items
  baseItems.push(
    { key: '/reports', icon: BarChart3, label: 'Reports' },
    { key: '/users', icon: UserCog, label: 'Users', adminOnly: true },
    { key: '/settings', icon: Settings, label: 'Settings' }
  );

  // Filter admin-only items
  return baseItems.filter(item => !item.adminOnly || isAdmin);
};

export function Sidebar({ collapsed, onCollapse }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, activeTenant } = useAuth();
  const [openKeys, setOpenKeys] = useState(['financial', 'resources']);

  const businessType = activeTenant?.businessType || null;
  const menuItems = useMemo(() => getMenuItems(businessType, isAdmin), [businessType, isAdmin]);

  const handleMenuClick = (key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
    }
  };

  const toggleSubmenu = (key) => {
    setOpenKeys(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 z-50 bg-white text-gray-900 transition-all duration-300 overflow-auto border-r border-gray-200",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200">
        {collapsed ? (
          <span className="text-2xl font-bold">NP</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold">Nex</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-600 to-pink-600 bg-clip-text text-transparent">PRO</span>
          </div>
        )}
      </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
          if (item.children) {
            const isOpen = openKeys.includes(item.key);
            return (
              <div key={item.key}>
                <button
                  onClick={() => toggleSubmenu(item.key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-700",
                    collapsed && "justify-center"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-90"
                      )} />
                    </>
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <button
                        key={child.key}
                        onClick={() => handleMenuClick(child.key)}
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
              </div>
            );
          }
          return (
            <button
              key={item.key}
              onClick={() => handleMenuClick(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors",
                location.pathname === item.key 
                  ? "bg-[#166534] text-white font-medium hover:bg-[#14532d]" 
                  : "text-gray-700",
                collapsed && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, activeTenant } = useAuth();
  const [openKeys, setOpenKeys] = useState(['financial', 'resources']);

  const businessType = activeTenant?.businessType || null;
  const menuItems = useMemo(() => getMenuItems(businessType, isAdmin), [businessType, isAdmin]);

  const handleMenuClick = (key) => {
    if (key && typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
      setOpen(false);
    }
  };

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
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-white text-gray-900 p-0 border-r border-gray-200">
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold">Nex</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-purple-600 to-pink-600 bg-clip-text text-transparent">PRO</span>
          </div>
        </div>
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            if (item.children) {
              const isOpen = openKeys.includes(item.key);
              return (
                <div key={item.key}>
                  <button
                    onClick={() => toggleSubmenu(item.key)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-700"
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
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-gray-700",
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
            }
            return (
              <button
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors",
                  location.pathname === item.key 
                    ? "bg-[#166534] text-white font-medium hover:bg-[#14532d]" 
                    : "text-gray-700"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
