import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, RefreshCw, ExternalLink, Layers, Banknote, TrendingUp } from 'lucide-react';
import DashboardTable from '../components/DashboardTable';
import DashboardStatsCard from '../components/DashboardStatsCard';
import WelcomeSection from '../components/WelcomeSection';
import merchandiseService from '../services/merchandiseService';
import { useAuth } from '../context/AuthContext';
import { useWorkspaceScope } from '../hooks/useWorkspaceScope';
import { useSmartSearch } from '../context/SmartSearchContext';
import { showError } from '../utils/toast';
import { getEmptyStateProps } from '../components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SEARCH_PLACEHOLDERS } from '../constants';
import { formatAmount, formatDecimal } from '../utils/formatNumber';

const valueFormatter = (value) => formatAmount(value);

const EMPTY_TOTALS = { totalItems: 0, totalQuantity: 0, totalCostValue: 0, totalSellingValue: 0 };

/**
 * Assets → Merchandise: read-only overview of sellable stock value (qty × cost/selling price).
 * Manager+ only (route-gated by RequireWorkspaceManager); no create/edit/delete here — use
 * Products (shop) or Drugs (pharmacy) for catalog management.
 */
const Merchandise = () => {
  const navigate = useNavigate();
  const { activeTenant, hasFeature } = useAuth();
  const { activeShopId, scopeReady } = useWorkspaceScope();
  const { searchValue, setPageSearchConfig } = useSmartSearch();

  const businessType = activeTenant?.businessType || null;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    setPageSearchConfig({ scope: 'merchandise', placeholder: SEARCH_PLACEHOLDERS.MERCHANDISE });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  const fetchSummary = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await merchandiseService.getSummary();
      setSummary(response?.data || null);
    } catch (error) {
      showError(error, 'Failed to load merchandise overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!scopeReady) return;
    fetchSummary();
  }, [scopeReady, activeShopId, fetchSummary]);

  const items = summary?.items || [];
  const totals = summary?.totals || EMPTY_TOTALS;
  const supported = summary?.supported !== false;

  const filteredItems = useMemo(() => {
    const term = searchValue?.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.sku, item.category].some(
        (field) => field && String(field).toLowerCase().includes(term)
      )
    );
  }, [items, searchValue]);

  const canDeepLinkToProducts = businessType === 'shop' && hasFeature('products');
  const canDeepLinkToDrugs = businessType === 'pharmacy' && hasFeature('pharmacyOps');
  const catalogRoute = canDeepLinkToProducts ? '/products' : canDeepLinkToDrugs ? '/drugs' : null;
  const catalogLabel = canDeepLinkToProducts ? 'Products' : 'Drugs';

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Product',
        render: (value, record) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{value}</div>
            {record.sku && (
              <div className="text-xs text-muted-foreground truncate">SKU: {record.sku}</div>
            )}
          </div>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        render: (value) => value || <span className="text-muted-foreground">—</span>,
      },
      {
        key: 'quantityOnHand',
        label: 'Qty on Hand',
        render: (value) => formatDecimal(value),
      },
      {
        key: 'costValue',
        label: 'Total Cost Value',
        render: (value) => <span className="text-foreground">{valueFormatter(value)}</span>,
      },
      {
        key: 'sellingValue',
        label: 'Total Selling Value',
        render: (value) => <span className="text-foreground">{valueFormatter(value)}</span>,
      },
    ],
    []
  );

  const emptyStateConfig = useMemo(() => {
    if (!supported) {
      return {
        icon: 'Package',
        title: "Merchandise isn't tracked for this business type",
        description:
          'Merchandise shows stock value for sellable products or drugs — it applies to shop and pharmacy workspaces.',
      };
    }
    if (searchValue) {
      return {
        icon: 'Package',
        title: 'No matching merchandise',
        description: 'Try a different search term.',
      };
    }
    return {
      icon: 'Package',
      title: 'No merchandise yet',
      description:
        businessType === 'pharmacy'
          ? 'Add drugs to your catalog to see stock value here.'
          : 'Add products to your catalog to see stock value here.',
      primaryAction: catalogRoute ? `Go to ${catalogLabel}` : undefined,
    };
  }, [supported, searchValue, businessType, catalogRoute, catalogLabel]);

  const goToCatalog = useCallback(() => {
    if (catalogRoute) navigate(catalogRoute);
  }, [catalogRoute, navigate]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <WelcomeSection
          welcomeMessage="Merchandise"
          subText="Stock value of goods you sell — read-only overview. Manage items in Products or Drugs."
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => fetchSummary({ silent: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          {catalogRoute && (
            <Button onClick={goToCatalog}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View {catalogLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-2">
        <DashboardStatsCard
          tooltip="Number of products/drugs with stock tracked"
          title="Items"
          value={totals.totalItems}
          icon={Package}
          iconBgColor="rgba(22, 101, 52, 0.1)"
          iconColor="#166534"
          loading={loading}
        />
        <DashboardStatsCard
          tooltip="Total units on hand across all merchandise"
          title="Qty on Hand"
          value={totals.totalQuantity}
          icon={Layers}
          iconBgColor="rgba(59, 130, 246, 0.1)"
          iconColor="#3b82f6"
          loading={loading}
        />
        <DashboardStatsCard
          tooltip="Total value of stock at cost price (qty × cost price)"
          title="Total Cost Value"
          value={valueFormatter(totals.totalCostValue)}
          icon={Banknote}
          iconBgColor="rgba(249, 115, 22, 0.1)"
          iconColor="#f97316"
          loading={loading}
        />
        <DashboardStatsCard
          tooltip="Total value of stock at selling price (qty × selling price)"
          title="Total Selling Value"
          value={valueFormatter(totals.totalSellingValue)}
          icon={TrendingUp}
          iconBgColor="rgba(132, 204, 22, 0.1)"
          iconColor="#84cc16"
          loading={loading}
        />
      </div>

      <DashboardTable
        data={filteredItems}
        columns={columns}
        loading={loading}
        title={null}
        pageSize={10}
        emptyState={getEmptyStateProps(emptyStateConfig, { primary: goToCatalog })}
      />
    </div>
  );
};

export default Merchandise;
