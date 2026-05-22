import { Store, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShopOptional } from '../context/ShopContext';

/**
 * Header control to switch active shop (retail workspaces only).
 */
export default function ShopSwitcher() {
  const ctx = useShopOptional();
  if (!ctx?.isShopWorkspace || ctx.loadingShops) return null;
  if (!ctx.shops?.length) return null;

  const label = ctx.activeShop?.name || 'Select shop';

  // Single shop available: show name only (no switcher needed)
  if (ctx.shops.length === 1 && ctx.activeShop) {
    return (
      <div className="flex items-center gap-1.5 max-w-[200px] px-3 py-1.5 text-sm border border-border rounded-md bg-background">
        <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{ctx.activeShop.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-w-[200px] border-border">
          <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Shop</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ctx.shops.map((shop) => (
          <DropdownMenuItem
            key={shop.id}
            onClick={() => ctx.setActiveShop(shop.id)}
            className={ctx.activeShopId === shop.id ? 'bg-muted' : ''}
          >
            {shop.name}
            {shop.isDefault ? ' (main)' : ''}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
