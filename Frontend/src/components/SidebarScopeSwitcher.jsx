import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useShopOptional } from '../context/ShopContext';
import { useStudioLocationOptional } from '../context/StudioLocationContext';

/**
 * Shop or studio picker in the sidebar brand area (under the app title).
 * @param {object} props
 * @param {string} [props.organizationName] - Workspace org name when viewing all locations
 * @param {string} [props.className]
 */
export default function SidebarScopeSwitcher({ organizationName = '', className }) {
  const shop = useShopOptional();
  const studio = useStudioLocationOptional();

  const config = useMemo(() => {
    if (shop?.isShopWorkspace && shop.loadingShops) {
      return {
        type: 'shop',
        showDropdown: false,
        label: organizationName || 'Loading…',
        ctx: null,
      };
    }

    if (studio?.isStudioWorkspace && studio.loadingLocations) {
      return {
        type: 'studio',
        showDropdown: false,
        label: organizationName || 'Loading…',
        ctx: null,
      };
    }

    if (shop?.isShopWorkspace && shop.shops?.length > 0) {
      const showDropdown = shop.shops.length > 1;
      const label = shop.activeShop?.name || organizationName || 'Select shop';

      return {
        type: 'shop',
        showDropdown,
        label,
        ctx: shop,
      };
    }

    if (studio?.isStudioWorkspace && studio.locations?.length > 0) {
      const showDropdown = studio.canAccessAll || studio.locations.length > 1;
      const label =
        studio.activeLocation?.name ||
        (studio.canAccessAll && !studio.activeStudioLocationId
          ? (organizationName || 'All studios')
          : studio.canAccessAll
            ? 'All studios'
            : organizationName || 'Select studio');

      return {
        type: 'studio',
        showDropdown,
        label,
        ctx: studio,
      };
    }

    return null;
  }, [shop, studio, organizationName]);

  if (!config) {
    if (!organizationName) return null;
    return (
      <span className={cn('text-xs text-muted-foreground truncate', className)}>
        {organizationName}
      </span>
    );
  }

  if (!config.showDropdown || !config.ctx) {
    return (
      <span className={cn('text-xs text-muted-foreground truncate', className)}>
        {config.label}
      </span>
    );
  }

  const isShop = config.type === 'shop';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-0.5 max-w-full text-xs text-muted-foreground hover:text-foreground transition-colors rounded-sm -ml-0.5 px-0.5 py-0.5',
            className
          )}
          aria-label={isShop ? 'Switch shop' : 'Switch studio location'}
        >
          <span className="truncate text-left">{config.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{isShop ? 'Shop' : 'Studio location'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isShop ? (
          <>
            {config.ctx.shops.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => config.ctx.setActiveShop(item.id)}
                className={config.ctx.activeShopId === item.id ? 'bg-muted' : ''}
              >
                {item.name}
                {item.isDefault ? ' (main)' : ''}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            {config.ctx.canAccessAll && (
              <DropdownMenuItem
                onClick={() => config.ctx.setActiveStudioLocation('all')}
                className={!config.ctx.activeStudioLocationId ? 'bg-muted' : ''}
              >
                All studios
              </DropdownMenuItem>
            )}
            {config.ctx.locations.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => config.ctx.setActiveStudioLocation(item.id)}
                className={config.ctx.activeStudioLocationId === item.id ? 'bg-muted' : ''}
              >
                {item.name}
                {item.isDefault ? ' (default)' : ''}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
