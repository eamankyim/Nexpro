import { memo, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useResponsive, BREAKPOINTS } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';
import TableSkeleton from './TableSkeleton';
import MobileCardView from './MobileCardView';

/**
 * DashboardTable - Generic reusable table component for dashboard
 * Shows table on desktop/tablet, cards on mobile
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions with { key, label, render }
 * @param {boolean} loading - Loading state
 * @param {string} title - Table title
 * @param {Object} emptyState - EmptyState config { icon, title, description, primaryAction, secondaryAction }
 * @param {React.ReactNode} emptyIcon - (Legacy) Icon to show when empty
 * @param {string} emptyDescription - (Legacy) Description text when empty
 * @param {string} emptyTitle - (Legacy) Title text when empty
 * @param {React.ReactNode} emptyAction - Optional action button/content to show when empty
 * @param {number} pageSize - Number of items per page (default: 10)
 * @param {Function} onPageChange - Callback when page changes (optional, for external pagination)
 * @param {Object} externalPagination - External pagination state { current, total } (optional)
 * @param {Function} onCardClick - Optional callback when card is clicked (mobile only)
 * @param {string} viewMode - 'table' | 'grid' (when provided with onViewModeChange, toggle is rendered by parent)
 * @param {Function} onViewModeChange - Callback when view mode changes (parent controls toggle placement)
 * @param {Function} getCardImage - Optional function(record) => imageUrl for card thumbnail in grid/card view
 */
const DashboardTable = memo(({
  data = [],
  columns = [],
  loading = false,
  title = 'Table',
  emptyState,
  emptyIcon,
  emptyDescription = 'No items found',
  emptyTitle,
  emptyAction,
  pageSize = 10,
  onPageChange,
  externalPagination,
  onCardClick,
  viewMode: controlledViewMode,
  onViewModeChange,
  getCardImage
}) => {
  // Use 1024 breakpoint for card vs table - matches MainLayout sidebar (cards when sidebar hidden)
  const { isMobile } = useResponsive({ mobileBreakpoint: BREAKPOINTS.TABLET });
  const [internalPagination, setInternalPagination] = useState({ current: 1, pageSize });
  const [internalViewMode, setInternalViewMode] = useState('table');
  const viewMode = onViewModeChange ? (controlledViewMode ?? 'table') : internalViewMode;
  const setViewMode = onViewModeChange || setInternalViewMode;
  
  // Use external pagination if provided, otherwise use internal
  const pagination = externalPagination || internalPagination;
  const setPagination = onPageChange ? 
    (updater) => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
      onPageChange(newPagination);
    } : 
    setInternalPagination;

  const effectivePageSize = pagination.pageSize || pageSize;
  const totalItems = useMemo(() => externalPagination?.total ?? data.length, [externalPagination?.total, data.length]);
  const totalPages = useMemo(() => Math.ceil(totalItems / effectivePageSize), [totalItems, effectivePageSize]);
  const startIndex = useMemo(() => (pagination.current - 1) * effectivePageSize + 1, [pagination.current, effectivePageSize]);
  const endIndex = useMemo(() => Math.min(pagination.current * effectivePageSize, totalItems), [pagination.current, effectivePageSize, totalItems]);
  
  const paginatedData = useMemo(() => {
    if (externalPagination) {
      // External pagination - data is already paginated
      return data;
    }
    // Internal pagination - slice the data
    return data.slice(
      (pagination.current - 1) * effectivePageSize,
      pagination.current * effectivePageSize
    );
  }, [data, pagination.current, effectivePageSize, externalPagination]);

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, current: newPage, pageSize }));
  };

  // Use card view when: grid mode selected OR mobile
  const useCardView = viewMode === 'grid' || isMobile;

  if (useCardView) {
    return (
      <div>
        {title !== null && title !== undefined && title !== '' && (
          <h2 className={cn("text-lg font-semibold", isMobile ? "mb-2 px-0" : "mb-4 px-1")}>{title}</h2>
        )}
        <MobileCardView
          data={data}
          columns={columns}
          loading={loading}
          emptyState={emptyState}
          emptyIcon={emptyIcon}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
          pageSize={pageSize}
          onPageChange={onPageChange}
          externalPagination={externalPagination}
          onCardClick={onCardClick}
          gridLayout={viewMode === 'grid'}
          getCardImage={getCardImage}
        />
      </div>
    );
  }

  // On desktop/tablet, use table view
  return (
    <Card className={cn(!isMobile && "mt-6")}>
      {title !== null && title !== undefined && title !== '' && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? undefined : "pt-6"}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={pageSize} cols={columns.length || 6} />
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            {emptyState ? (
              <EmptyState
                icon={emptyState.icon}
                title={emptyState.title}
                description={emptyState.description}
                primaryAction={emptyState.primaryAction}
                secondaryAction={emptyState.secondaryAction}
              />
            ) : (
              <div className="text-center space-y-3">
                {emptyTitle && <h3 className="text-lg font-medium">{emptyTitle}</h3>}
                <Empty
                  description={emptyDescription}
                  image={emptyIcon}
                />
                {emptyAction}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="border-b overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="border-b">
                    {columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item, index) => (
                    <TableRow key={item.id || item.key || index} className="border-b last:border-b-0">
                      {columns.map((column) => (
                        <TableCell key={column.key}>
                          {column.render ? column.render(item[column.key], item, index) : (item[column.key] !== undefined && item[column.key] !== null ? item[column.key] : '—')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalItems > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 rounded-b-md">
                <div className="text-sm text-muted-foreground text-center sm:text-left">
                  Showing {startIndex} to {endIndex} of {totalItems} items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.current - 1)}
                    disabled={pagination.current === 1 || loading}
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Previous</span>
                  </Button>
                  <div className="text-sm px-2">
                    Page {pagination.current} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={pagination.current === totalPages || loading}
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

DashboardTable.displayName = 'DashboardTable';

export default DashboardTable;
