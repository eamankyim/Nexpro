import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import dealerService from '../services/dealerService';
import productService from '../services/productService';
import { useAuth } from '../context/AuthContext';
import { useShopOptional } from '../context/ShopContext';
import { showSuccess, handleApiError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DashboardTable from '../components/DashboardTable';
import TableSkeleton from '../components/TableSkeleton';
import { formatAmount } from '../utils/formatNumber';

const DealerPricing = () => {
  const { id: dealerId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTenantId } = useAuth();
  const shopContext = useShopOptional();
  const activeShopId = shopContext?.activeShopId ?? null;
  const [draftPrices, setDraftPrices] = useState({});

  const { data: dealerResponse, isLoading: dealerLoading } = useQuery({
    queryKey: ['dealer', dealerId],
    queryFn: () => dealerService.getById(dealerId),
    enabled: !!dealerId,
  });

  const dealer = dealerResponse?.data || dealerResponse;

  const { data: productsResponse, isLoading: productsLoading } = useQuery({
    queryKey: ['products', 'dealer-pricing', activeTenantId, activeShopId],
    queryFn: () => productService.getAll({ limit: 100, isActive: true }),
    enabled: !!activeTenantId && !!activeShopId,
  });

  const { data: pricesResponse, isLoading: pricesLoading } = useQuery({
    queryKey: ['dealer-prices', dealerId, activeShopId],
    queryFn: () => dealerService.getPrices(dealerId, { shopId: activeShopId }),
    enabled: !!dealerId && !!activeShopId,
  });

  const products = useMemo(() => {
    const rows = productsResponse?.data || [];
    return Array.isArray(rows) ? rows : [];
  }, [productsResponse]);

  const priceByProductKey = useMemo(() => {
    const map = {};
    const rows = pricesResponse?.data || [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const key = `${row.productId}:${row.productVariantId || ''}`;
      map[key] = row;
    });
    return map;
  }, [pricesResponse]);

  const saveMutation = useMutation({
    mutationFn: (prices) => dealerService.upsertPrices(dealerId, { shopId: activeShopId, prices }),
    onSuccess: () => {
      showSuccess('Dealer prices saved');
      setDraftPrices({});
      queryClient.invalidateQueries({ queryKey: ['dealer-prices', dealerId] });
    },
    onError: (err) => handleApiError(err, 'Failed to save dealer prices'),
  });

  const rows = useMemo(() => products.map((product) => {
    const key = `${product.id}:`;
    const existing = priceByProductKey[key];
    const draft = draftPrices[key];
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      retailPrice: product.sellingPrice,
      wholesalePrice: product.wholesalePrice,
      dealerPrice: draft ?? existing?.unitPrice ?? '',
    };
  }), [products, priceByProductKey, draftPrices]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Product', render: (_, row) => row.name },
    { key: 'sku', label: 'SKU', render: (value) => value || '—' },
    { key: 'retailPrice', label: 'Retail', render: (value) => formatAmount(value) },
    {
      key: 'wholesalePrice',
      label: 'Wholesale',
      render: (value) => (value != null && value !== '' ? formatAmount(value) : '—'),
    },
    {
      key: 'dealerPrice',
      label: 'Dealer price',
      render: (_, row) => {
        const key = `${row.id}:`;
        const placeholder = row.wholesalePrice != null && row.wholesalePrice !== ''
          ? 'Wholesale'
          : 'Retail';
        return (
          <Input
            type="number"
            min="0"
            step="0.01"
            className="h-8 w-28"
            value={draftPrices[key] ?? row.dealerPrice}
            onChange={(e) => setDraftPrices((prev) => ({ ...prev, [key]: e.target.value }))}
            placeholder={placeholder}
          />
        );
      },
    },
  ], [draftPrices]);

  const handleSave = () => {
    const prices = Object.entries(draftPrices)
      .filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => {
        const [productId] = key.split(':');
        return { productId, productVariantId: null, unitPrice: Number(value) };
      });
    if (prices.length === 0) return;
    saveMutation.mutate(prices);
  };

  if (!activeShopId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select an active shop branch to manage dealer prices for this catalogue.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dealers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to dealers
          </Button>
          <h1 className="text-2xl font-bold mt-3">{dealerLoading ? 'Loading…' : `${dealer?.businessName || 'Dealer'} prices`}</h1>
          <p className="text-sm text-muted-foreground">Branch catalogue pricing for {shopContext?.activeShop?.name || 'active shop'}</p>
        </div>
        <Button
          className="bg-[#166534] hover:bg-[#14532d]"
          onClick={handleSave}
          disabled={saveMutation.isPending || Object.keys(draftPrices).length === 0}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save prices
        </Button>
      </div>

      {productsLoading || pricesLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <DashboardTable columns={columns} data={rows} pageSize={20} />
      )}
    </div>
  );
};

export default DealerPricing;
