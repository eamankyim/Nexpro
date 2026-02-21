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

/**
 * ReportsTableWithCards - Renders table on desktop, card list on mobile
 * @param {Array} columns - [{ key, label, render?(value, record) }]
 * @param {Array} data - Array of record objects
 * @param {string} className - Additional classes for wrapper
 */
const ReportsTableWithCards = ({ columns = [], data = [], className = '' }) => {
  // Use 1024 breakpoint - matches MainLayout (cards when sidebar hidden)
  const { isMobile } = useResponsive({ mobileBreakpoint: BREAKPOINTS.TABLET });

  if (isMobile) {
    return (
      <div className={`space-y-2 ${className}`}>
        {data.map((record, index) => (
          <Card key={index} className="border">
            <CardContent className="px-4 py-3 space-y-2">
              {columns.map((col) => {
                const value = col.render
                  ? col.render(record[col.key], record, index)
                  : (record[col.key] ?? '-');
                return (
                  <div key={col.key} className="flex justify-between items-start gap-2">
                    <span className="text-sm text-foreground min-w-0">{value}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <Table className="min-w-[400px]">
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
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
