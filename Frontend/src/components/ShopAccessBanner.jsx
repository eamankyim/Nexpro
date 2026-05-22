import { Store } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useShopOptional } from '../context/ShopContext';

/**
 * Shown when a shop workspace user has no shop assignments (cannot use POS/sales/products).
 */
export default function ShopAccessBanner() {
  const shop = useShopOptional();
  if (!shop?.isShopWorkspace || shop.loadingShops) return null;
  if (shop.canAccessAll || shop.shops.length > 0) return null;

  return (
    <div className="mx-4 sm:mx-4 lg:mx-6 mt-2">
      <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/30">
        <Store className="h-4 w-4" />
        <AlertTitle>No shop assigned</AlertTitle>
        <AlertDescription>
          Your account is not linked to a shop yet. Ask your workspace administrator to assign you
          to a shop so you can view sales, products, and use the POS.
        </AlertDescription>
      </Alert>
    </div>
  );
}
