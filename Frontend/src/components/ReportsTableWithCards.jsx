import { useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useResponsive, BREAKPOINTS } from '@/hooks/useResponsive';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const REPORTS_VIRT_MIN_ROWS = 35;
const REPORTS_MOBILE_VIRT_MIN = 24;
const REPORTS_ROW_EST_PX = 48;
const REPORTS_MOBILE_CARD_EST_PX = 128;

const columnHeading = (col) => col.label ?? col.title ?? col.key;

/**
 * Mobile card list with windowed rows for large generated reports.
 */
function ReportsMobileVirtualized({
  scrollRef,
  data,
  title,
  className,
  showHeaderRow,
  headerEndColumns,
  bodyColumns,
  mobileRows,
  scrollResetDep,
}) {
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => REPORTS_MOBILE_CARD_EST_PX,
    overscan: 5,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [scrollResetDep, scrollRef]);

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      {title ? <h3 className="text-sm font-semibold text-foreground shrink-0">{title}</h3> : null}
      <div
        ref={scrollRef}
        className="mt-2 max-h-[min(70vh,560px)] min-h-0 overflow-auto"
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const record = data[vi.index];
            const index = vi.index;
            return (
              <div
                key={vi.key}
                ref={virtualizer.measureElement}
                data-index={vi.index}
                className="absolute left-0 top-0 w-full pb-2"
                style={{
                  transform: `translateY(${vi.start}px)`,
                  height: `${vi.size}px`,
                }}
              >
                <Card className="border">
                  <CardContent className="px-4 py-3 space-y-2">
                    {showHeaderRow && (
                      <div className="flex justify-between items-start gap-2 pb-2 border-b">
                        <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
                          {bodyColumns[0].render
                            ? bodyColumns[0].render(record[bodyColumns[0].key], record, index)
                            : (record[bodyColumns[0].key] ?? '-')}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {headerEndColumns.map((col) => (
                            <div key={col.key}>
                              {col.render
                                ? col.render(record[col.key], record, index)
                                : (record[col.key] ?? '-')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {mobileRows.map((col) => {
                      const value = col.render
                        ? col.render(record[col.key], record, index)
                        : (record[col.key] ?? '-');
                      return (
                        <div key={col.key} className="flex justify-between items-start gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">
                            {columnHeading(col)}:
                          </span>
                          <span className="text-sm text-foreground min-w-0 text-right">{value}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Desktop-only virtualized grid (reports can return hundreds of rows).
 */
function ReportsVirtualizedGrid({ scrollRef, columns, data, scrollResetDep }) {
  const gridTemplateColumns = useMemo(
    () => columns.map(() => 'minmax(0,1fr)').join(' '),
    [columns.length]
  );

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => REPORTS_ROW_EST_PX,
    overscan: 10,
    measureElement:
      typeof document !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !/Firefox\//.test(navigator.userAgent)
        ? (el) => el?.getBoundingClientRect().height ?? REPORTS_ROW_EST_PX
        : undefined,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [scrollResetDep, scrollRef]);

  return (
    <div className="min-w-[400px]">
      <div
        className="sticky top-0 z-[1] grid gap-0 border-b bg-card text-sm font-medium"
        style={{ gridTemplateColumns }}
      >
        {columns.map((col) => (
          <div key={col.key} className="h-11 px-3 flex items-center border-b border-border">
            {columnHeading(col)}
          </div>
        ))}
      </div>
      <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const record = data[virtualRow.index];
          const index = virtualRow.index;
          return (
            <div
              key={`${virtualRow.key}-${index}`}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="absolute left-0 grid w-full border-b border-border text-sm"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns,
                height: `${virtualRow.size}px`,
              }}
            >
              {columns.map((col) => (
                <div key={col.key} className="flex min-w-0 items-center px-3 py-2">
                  <span className="min-w-0 break-words">
                    {col.render
                      ? col.render(record[col.key], record, index)
                      : (record[col.key] ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * ReportsTableWithCards - Renders table on desktop (with optional title and column names), card list on mobile
 * @param {Array} columns - [{ key, label?, title?, render?, mobileDashboardPlacement?: 'headerEnd' }] (headerEnd = top-right on mobile, first body column left)
 * @param {Array} data - Array of record objects
 * @param {string} [title] - Optional table title (shown above table in table mode, above cards on mobile)
 * @param {string} className - Additional classes for wrapper
 */
const ReportsTableWithCards = ({ columns = [], data = [], title = '', className = '' }) => {
  // Use 1024 breakpoint - matches MainLayout (cards when sidebar hidden)
  const { isMobile } = useResponsive({ mobileBreakpoint: BREAKPOINTS.TABLET });
  const reportsScrollRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const useVirt = !isMobile && data.length >= REPORTS_VIRT_MIN_ROWS;
  const useMobileVirt = isMobile && data.length >= REPORTS_MOBILE_VIRT_MIN;

  const headerEndColumns = useMemo(
    () => columns.filter((c) => c.mobileDashboardPlacement === 'headerEnd'),
    [columns]
  );
  const bodyColumns = useMemo(
    () => columns.filter((c) => c.mobileDashboardPlacement !== 'headerEnd'),
    [columns]
  );

  if (isMobile) {
    const showHeaderRow = headerEndColumns.length > 0 && bodyColumns.length > 0;
    const mobileRows = showHeaderRow ? bodyColumns.slice(1) : bodyColumns;

    if (useMobileVirt) {
      return (
        <ReportsMobileVirtualized
          scrollRef={mobileScrollRef}
          data={data}
          title={title}
          className={className}
          showHeaderRow={showHeaderRow}
          headerEndColumns={headerEndColumns}
          bodyColumns={bodyColumns}
          mobileRows={mobileRows}
          scrollResetDep={data}
        />
      );
    }

    return (
      <div className={`space-y-2 ${className}`}>
        {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
        {data.map((record, index) => (
          <Card key={index} className="border">
            <CardContent className="px-4 py-3 space-y-2">
              {showHeaderRow && (
                <div className="flex justify-between items-start gap-2 pb-2 border-b">
                  <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {bodyColumns[0].render
                      ? bodyColumns[0].render(record[bodyColumns[0].key], record, index)
                      : (record[bodyColumns[0].key] ?? '-')}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {headerEndColumns.map((col) => (
                      <div key={col.key}>
                        {col.render
                          ? col.render(record[col.key], record, index)
                          : (record[col.key] ?? '-')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mobileRows.map((col) => {
                const value = col.render
                  ? col.render(record[col.key], record, index)
                  : (record[col.key] ?? '-');
                return (
                  <div key={col.key} className="flex justify-between items-start gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">{columnHeading(col)}:</span>
                    <span className="text-sm text-foreground min-w-0 text-right">{value}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (useVirt) {
    return (
      <div className={cn('border border-border rounded-md', className)}>
        {title ? <h3 className="text-sm font-semibold text-foreground mb-2 px-3 pt-3">{title}</h3> : null}
        <div ref={reportsScrollRef} className="max-h-[min(65vh,520px)] overflow-auto px-0 pb-1">
          <ReportsVirtualizedGrid
            scrollRef={reportsScrollRef}
            columns={columns}
            data={data}
            scrollResetDep={data}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      {title ? <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3> : null}
      <Table className="min-w-[400px]">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{columnHeading(col)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((record, index) => (
            <TableRow key={index}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render
                    ? col.render(record[col.key], record, index)
                    : (record[col.key] ?? '-')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReportsTableWithCards;
