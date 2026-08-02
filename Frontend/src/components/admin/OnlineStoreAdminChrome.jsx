import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';
import adminService from '../../services/adminService';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ONLINE_STORE_ADMIN_SECTIONS = {
  setup: {
    key: 'setup',
    path: '/admin/online-store/setup',
    label: 'Setup',
    title: 'Store setup',
    description:
      'Provision an online store for a tenant: store info, heroes, sample products, and real client products — then go live.',
    permission: 'tenants.update',
  },
  domains: {
    key: 'domains',
    path: '/admin/online-store/domains',
    label: 'Custom domains',
    title: 'Custom domains',
    description:
      'Merchants submit domains from Online Store → Connect Domain. Verify after DNS points at the storefront CNAME target. Verified domains are added to API CORS automatically.',
    permission: 'tenants.view',
  },
  heroes: {
    key: 'heroes',
    path: '/admin/online-store/heroes',
    label: 'Hero library',
    title: 'Hero library',
    description:
      'Upload Online Store hero designs with 3–5 colorways. Merchants pick designs; we match color to their brand. Prefer 1920×600 images.',
    permission: 'settings.view',
  },
};

const NAV_ITEMS = [
  ONLINE_STORE_ADMIN_SECTIONS.setup,
  ONLINE_STORE_ADMIN_SECTIONS.domains,
  ONLINE_STORE_ADMIN_SECTIONS.heroes,
];

/**
 * Shared Sabito-style header + section tabs for Online Store Admin pages.
 * @param {{ section: 'setup' | 'domains' | 'heroes', actions?: import('react').ReactNode, children?: import('react').ReactNode }} props
 */
export default function OnlineStoreAdminChrome({ section, actions, children }) {
  const location = useLocation();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [pendingDomainCount, setPendingDomainCount] = useState(0);
  const config = ONLINE_STORE_ADMIN_SECTIONS[section] || ONLINE_STORE_ADMIN_SECTIONS.setup;
  const canViewDomains = !permissionsLoading && hasPermission('tenants.view');

  useEffect(() => {
    if (!canViewDomains) return undefined;

    let cancelled = false;
    const loadPendingCount = async () => {
      try {
        const res = await adminService.getOnlineStorePendingDomainCount();
        if (!cancelled && res?.success) {
          setPendingDomainCount(Number(res.data?.count) || 0);
        }
      } catch {
        // Badge is best-effort
      }
    };

    loadPendingCount();
    const intervalId = window.setInterval(loadPendingCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canViewDomains, location.pathname]);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (permissionsLoading) return true;
    return hasPermission(item.permission);
  });

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Store className="h-5 w-5 text-brand" />
              <h2 className="text-2xl font-semibold text-foreground">{config.title}</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{config.description}</p>
            {section === 'domains' ? (
              <p className="mt-2 max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Vercel: you must still add each domain manually in the Vercel project (Domains) so TLS and
                routing work. Marking Verified here does not provision the domain on Vercel.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="w-fit border-brand/30 text-brand">
              Online Store Admin
            </Badge>
            {actions}
          </div>
        </div>
      </div>

      <div className="mb-2 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {visibleNavItems.map((item) => {
          const isActive = section === item.key;
          const badgeCount = item.key === 'domains' ? pendingDomainCount : 0;
          return (
            <Button
              key={item.key}
              asChild
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className="shrink-0"
            >
              <Link to={item.path} className="inline-flex items-center gap-2">
                {item.label}
                {badgeCount > 0 ? (
                  <span
                    className={cn(
                      'min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold',
                      isActive
                        ? 'bg-white text-brand'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    )}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          );
        })}
      </div>

      {children}
    </div>
  );
}
