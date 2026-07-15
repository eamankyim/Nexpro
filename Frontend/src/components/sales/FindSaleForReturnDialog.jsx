import { useState, useCallback, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import saleService from '../../services/saleService';
import { showError } from '../../utils/toast';
import { formatAmount } from '../../utils/formatNumber';
import { getSalePartyLabel } from '../../utils/saleParty';
import dayjs from 'dayjs';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * Find a completed sale by sale number (or list search) to start a return from POS.
 */
export default function FindSaleForReturnDialog({
  open,
  onOpenChange,
  onSelectSale,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 500);

  const search = useCallback(async (q) => {
    const term = String(q || '').trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await saleService.getSales({
        search: term,
        limit: 15,
        page: 1,
      });
      const payload = res?.data?.data != null ? res.data : res;
      const rows = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
      setResults(
        rows.filter((s) => !s.deletedAt && s.status !== 'cancelled' && s.status !== 'pending')
      );
    } catch (error) {
      showError(error, 'Failed to search sales');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    search(debouncedQuery);
  }, [debouncedQuery, open, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Find sale for return</DialogTitle>
          <DialogDescription>
            Search by sale number to start a refund or exchange.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="find-sale-query">Sale number</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="find-sale-query"
                className="pl-9"
                placeholder="e.g. SALE-0001"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && debouncedQuery.trim().length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No matching sales.</p>
          )}
          <ul className="max-h-64 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {results.map((sale) => (
              <li key={sale.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-3 hover:bg-muted/50"
                  onClick={() => {
                    onSelectSale?.(sale);
                    onOpenChange?.(false);
                  }}
                >
                  <div className="font-medium text-foreground">{sale.saleNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {getSalePartyLabel(sale)} · {formatAmount(sale.total)} · {dayjs(sale.createdAt).format('MMM D, YYYY')}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
