import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatInteger } from '../../utils/formatNumber';
import { getCustomerName, getOrderNumber } from '../../hooks/useOnlineStoreOrderAttention';

/**
 * Prominent banner for online store orders needing attention.
 * @param {{ pendingOrderCount: number, latestOrder: object|null, className?: string }} props
 */
const OnlineStoreOrderBanner = ({ pendingOrderCount, latestOrder, className = 'mb-6' }) => {
  if (!pendingOrderCount || pendingOrderCount <= 0) return null;

  return (
    <Card className={`border border-emerald-200 bg-emerald-50 ${className}`.trim()}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <ShoppingBag className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">New online order</p>
            <h2 className="mt-1 text-lg font-semibold text-emerald-950">
              {pendingOrderCount === 1
                ? '1 online order needs attention'
                : `${formatInteger(pendingOrderCount)} online orders need attention`}
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
              {latestOrder
                ? `Latest order: ${getOrderNumber(latestOrder)} from ${getCustomerName(latestOrder)}. Review payment, items, and fulfillment.`
                : 'Review payment, items, and fulfillment before dispatch.'}
            </p>
          </div>
          <Button asChild className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-800">
            <Link to="/store/orders">View online orders</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnlineStoreOrderBanner;
