import { memo, useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import SwipeableCard from './SwipeableCard';
import { useResponsive } from '@/hooks/useResponsive';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * MobileCardView - Card-based layout for mobile devices
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions with { key, label, render }
 * @param {boolean} loading - Loading state
 * @param {string} emptyDescription - Description text when empty
 * @param {React.ReactNode} emptyIcon - Icon to show when empty
 * @param {number} pageSize - Number of items per page (default: 10)
 * @param {Function} onPageChange - Callback when page changes (optional, for external pagination)
 * @param {Object} externalPagination - External pagination state { current, total } (optional)
 * @param {Function} onCardClick - Optional callback when card is clicked
 * @param {Function} getSwipeActions - Optional function that returns { leftActions, rightActions } for each item
 * @param {boolean} enableSwipe - Whether to enable swipe actions (default: true on mobile)
 * @param {Function} getQuickActions - Optional function that returns quick action menu items for each item
 * @param {boolean} enableLongPress - Whether to enable long-press quick actions (default: true on mobile)
 */
const MobileCardView = memo(({
  data = [],
  columns = [],
  loading = false,
  emptyDescription = 'No items found',
  emptyIcon,
  pageSize = 10,
  onPageChange,
  externalPagination,
  onCardClick,
  getSwipeActions,
  enableSwipe = true,
  getQuickActions,
  enableLongPress = true,
}) => {
  const { isMobile } = useResponsive();
  const [internalPagination, setInternalPagination] = useState({ current: 1, pageSize });
  const longPressTimer = useRef(null);
  const longPressTarget = useRef(null);
  const [longPressMenuOpen, setLongPressMenuOpen] = useState(false);
  const [longPressItem, setLongPressItem] = useState(null);
  const [longPressIndex, setLongPressIndex] = useState(-1);
  const [longPressPosition, setLongPressPosition] = useState({ x: 0, y: 0 });
  
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

  // Separate primary columns (first 2-3) from secondary columns
  const primaryColumns = useMemo(() => {
    return columns.slice(0, 3).filter(col => col.key !== 'actions');
  }, [columns]);

  const secondaryColumns = useMemo(() => {
    return columns.slice(3).filter(col => col.key !== 'actions');
  }, [columns]);

  // Find actions column
  const actionsColumn = useMemo(() => {
    return columns.find(col => col.key === 'actions' || col.label?.toLowerCase().includes('action'));
  }, [columns]);

  // Get swipe actions for each item (MUST be before early returns)
  const getItemSwipeActions = useMemo(() => {
    if (!getSwipeActions || !enableSwipe || !isMobile) {
      return () => ({ leftActions: [], rightActions: [] });
    }
    return getSwipeActions;
  }, [getSwipeActions, enableSwipe, isMobile]);

  // Get quick actions for each item (MUST be before early returns)
  const getItemQuickActions = useMemo(() => {
    if (!getQuickActions || !enableLongPress || !isMobile) {
      return () => [];
    }
    return getQuickActions;
  }, [getQuickActions, enableLongPress, isMobile]);

  // Check if quick actions are enabled (MUST be before early returns)
  const hasQuickActions = enableLongPress && isMobile && getQuickActions;

  // Handle long press (MUST be before early returns)
  const handleTouchStart = useCallback((e, item, index) => {
    if (!enableLongPress || !isMobile) return;

    longPressTarget.current = { item, index };
    const touch = e.touches?.[0] || e;
    
    longPressTimer.current = setTimeout(() => {
      // Trigger haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      // Show quick actions menu
      const quickActions = getItemQuickActions(item, index);
      if (quickActions && quickActions.length > 0) {
        setLongPressItem(item);
        setLongPressIndex(index);
        setLongPressPosition({ x: touch.clientX, y: touch.clientY });
        setLongPressMenuOpen(true);
      }
    }, 500); // 500ms long press
  }, [enableLongPress, isMobile, getItemQuickActions]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressTarget.current = null;
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(pageSize)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (paginatedData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Empty
          description={emptyDescription}
          image={emptyIcon}
        />
      </div>
    );
  }

  // Get quick actions for long-pressed item
  const longPressQuickActions = longPressItem && longPressIndex !== -1
    ? getItemQuickActions(longPressItem, longPressIndex)
    : [];

  return (
    <>
      {/* Long Press Quick Actions Menu */}
      {hasQuickActions && longPressQuickActions.length > 0 && (
        <Popover open={longPressMenuOpen} onOpenChange={setLongPressMenuOpen}>
          <PopoverTrigger asChild>
            <div className="hidden" />
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-1"
            style={{
              position: 'fixed',
              left: `${longPressPosition.x}px`,
              top: `${longPressPosition.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="flex flex-col">
              {longPressQuickActions.map((action, actionIndex) => (
                <Button
                  key={actionIndex}
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick?.(longPressItem, longPressIndex);
                    setLongPressMenuOpen(false);
                    setLongPressItem(null);
                    setLongPressIndex(-1);
                  }}
                  className="justify-start min-h-[44px] w-full"
                >
                  {action.icon && <action.icon className="mr-2 h-4 w-4" />}
                  <span>{action.label}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <div className="space-y-3">
        {/* Cards */}
        {paginatedData.map((item, index) => {
        const swipeActions = getItemSwipeActions(item, index);
        const { leftActions = [], rightActions = [] } = swipeActions || {};
        const hasSwipeActions = (leftActions.length > 0 || rightActions.length > 0) && enableSwipe && isMobile;

        const quickActions = getItemQuickActions(item, index);
        const hasItemQuickActions = quickActions && quickActions.length > 0 && enableLongPress && isMobile;

        const cardContent = (
          <Card 
            key={item.id || item.key || index}
            className={cn(
              "transition-colors",
              onCardClick && "cursor-pointer hover:bg-gray-50 active:bg-gray-100",
              hasItemQuickActions && "select-none" // Prevent text selection during long press
            )}
            onClick={() => onCardClick && onCardClick(item, index)}
            onTouchStart={(e) => handleTouchStart(e, item, index)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
          >
            <CardContent className="p-4">
              {/* Primary Information */}
              <div className="space-y-2 mb-3">
                {primaryColumns.map((column) => {
                  const value = column.render 
                    ? column.render(item[column.key], item, index)
                    : (item[column.key] !== undefined && item[column.key] !== null ? item[column.key] : '—');
                  
                  return (
                    <div key={column.key} className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-500 min-w-[80px]">
                        {column.label}:
                      </span>
                      <span className="text-sm text-gray-900 flex-1 text-right">
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Secondary Information (collapsible or shown if space allows) */}
              {secondaryColumns.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  {secondaryColumns.slice(0, 2).map((column) => {
                    const value = column.render 
                      ? column.render(item[column.key], item, index)
                      : (item[column.key] !== undefined && item[column.key] !== null ? item[column.key] : '—');
                    
                    return (
                      <div key={column.key} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-400 min-w-[70px]">
                          {column.label}:
                        </span>
                        <span className="text-xs text-gray-600 flex-1 text-right truncate">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              {actionsColumn && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-end">
                    {actionsColumn.render && actionsColumn.render(null, item, index)}
                  </div>
                </div>
              )}

              {/* Click indicator */}
              {onCardClick && (
                <div className="mt-2 flex justify-end">
                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                </div>
              )}
            </CardContent>
          </Card>
        );

        // Wrap content (quick actions handled separately via state)
        const wrappedContent = cardContent;

        // Wrap in SwipeableCard if swipe actions are available
        if (hasSwipeActions) {
          return (
            <SwipeableCard
              key={item.id || item.key || index}
              leftActions={leftActions}
              rightActions={rightActions}
            >
              {wrappedContent}
            </SwipeableCard>
          );
        }

        return wrappedContent;
        })}

        {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 px-2">
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
      </div>
    </>
  );
});

MobileCardView.displayName = 'MobileCardView';

export default MobileCardView;
