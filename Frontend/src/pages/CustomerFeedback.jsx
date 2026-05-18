import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  RefreshCw,
  Loader2,
  MessageCircle,
  Smile,
  TrendingUp,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '../context/AuthContext';
import { useSmartSearch } from '../context/SmartSearchContext';
import { useDebounce } from '../hooks/useDebounce';
import feedbackService from '../services/feedbackService';
import { showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SEARCH_PLACEHOLDERS, DEBOUNCE_DELAYS } from '../constants';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);

const READ_IDS_KEY = (tenantId) => `reviewsReadIds:${tenantId || 'default'}`;

function loadReadIds(tenantId) {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY(tenantId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(tenantId, set) {
  localStorage.setItem(READ_IDS_KEY(tenantId), JSON.stringify([...set]));
}

function initials(name) {
  const s = (name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i += 1) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h) % 360;
}

function categoryLabel(record) {
  const m = record.metadata && typeof record.metadata === 'object' ? record.metadata : {};
  if (m.category && String(m.category).trim()) return String(m.category).trim();
  if (record.sourceRef && String(record.sourceRef).trim()) return String(record.sourceRef).trim();
  const src = (record.source || 'direct').replace(/_/g, ' ');
  return src.charAt(0).toUpperCase() + src.slice(1);
}

function categoryBadgeClass(label) {
  const lower = label.toLowerCase();
  if (/(print|digital|press)/i.test(lower)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100';
  }
  if (/(brand)/i.test(lower)) {
    return 'border-orange-200 bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100';
  }
  if (/(graphic|design)/i.test(lower)) {
    return 'border-violet-200 bg-violet-50 text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-100';
  }
  return 'border-border bg-muted/60 text-foreground';
}

/** @returns {(number|'ellipsis')[]} */
function getPaginationItems(current, total) {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Reviews inbox — same submissions as the public review link (/review/:slug or /feedback/:slug).
 */
export default function CustomerFeedback() {
  const { activeTenant, hasFeature, isManager } = useAuth();
  const { searchValue, setPageSearchConfig } = useSmartSearch();
  const tenantId = activeTenant?.id || '';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 100, pages: 1 });
  const [readIds, setReadIds] = useState(() => loadReadIds(tenantId));

  const [listQuery, setListQuery] = useState('');
  const debouncedListQuery = useDebounce(listQuery, DEBOUNCE_DELAYS.SEARCH);
  const [ratingFilter, setRatingFilter] = useState('all');
  const [commentFilter, setCommentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [listPage, setListPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setReadIds(loadReadIds(tenantId));
  }, [tenantId]);

  useEffect(() => {
    setPageSearchConfig({
      placeholder: SEARCH_PLACEHOLDERS.REVIEWS,
      scope: 'reviews',
    });
    return () => setPageSearchConfig(null);
  }, [setPageSearchConfig]);

  const fetchFeedback = useCallback(async () => {
    if (!hasFeature('crm')) return;
    setLoading(true);
    try {
      const res = await feedbackService.getCustomerFeedback({ page: 1, limit: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      showError(err, 'Failed to load reviews');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [hasFeature]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeedback();
    setRefreshing(false);
  };

  const markRead = useCallback(
    (id) => {
      const next = new Set(readIds);
      next.add(id);
      setReadIds(next);
      saveReadIds(tenantId, next);
    },
    [readIds, tenantId]
  );

  const processedRows = useMemo(() => {
    const headerQ = (searchValue || '').trim().toLowerCase();
    const listQ = debouncedListQuery.trim().toLowerCase();

    let list = [...rows];

    if (headerQ) {
      list = list.filter((r) => {
        const hay = [r.comment, r.contactName, r.contactEmail, r.contactPhone, String(r.rating), r.source, r.sourceRef]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(headerQ);
      });
    }

    if (listQ) {
      list = list.filter((r) => {
        const hay = [r.comment, r.contactName, r.contactEmail, r.contactPhone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(listQ);
      });
    }

    if (ratingFilter !== 'all') {
      const n = parseInt(ratingFilter, 10);
      list = list.filter((r) => r.rating === n);
    }

    if (commentFilter === 'with') {
      list = list.filter((r) => (r.comment || '').trim().length > 0);
    } else if (commentFilter === 'unread') {
      list = list.filter((r) => !readIds.has(r.id));
    }

    if (sortBy === 'newest') {
      list.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf());
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating || dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
    }

    return list;
  }, [rows, searchValue, debouncedListQuery, ratingFilter, commentFilter, sortBy, readIds]);

  useEffect(() => {
    setListPage(1);
  }, [debouncedListQuery, ratingFilter, commentFilter, sortBy, searchValue]);

  const listTotal = processedRows.length;
  const listPages = Math.max(1, Math.ceil(listTotal / pageSize));
  const safeListPage = Math.min(listPage, listPages);
  const pagedRows = useMemo(() => {
    const start = (safeListPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, safeListPage, pageSize]);
  const paginationItems = useMemo(
    () => getPaginationItems(safeListPage, listPages),
    [safeListPage, listPages]
  );

  useEffect(() => {
    setListPage((p) => Math.min(p, listPages));
  }, [listPages]);

  const stats = useMemo(() => {
    const n = rows.length;
    const totalAll = pagination.total || n;
    const avg = n ? rows.reduce((s, r) => s + Number(r.rating || 0), 0) / n : 0;
    const positiveShare = n ? rows.filter((r) => Number(r.rating) >= 4).length / n : 0;
    const positivePct = Math.round(positiveShare * 100);

    const sorted = [...rows].sort((a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf());
    let avgDelta = null;
    if (sorted.length >= 4) {
      const mid = Math.floor(sorted.length / 2);
      const older = sorted.slice(0, mid);
      const newer = sorted.slice(mid);
      const aOld = older.reduce((s, r) => s + Number(r.rating), 0) / older.length;
      const aNew = newer.reduce((s, r) => s + Number(r.rating), 0) / newer.length;
      avgDelta = aNew - aOld;
    }

    const now = dayjs();
    const thisMonth = rows.filter((r) => dayjs(r.createdAt).isSame(now, 'month')).length;
    const lastMonth = rows.filter((r) => dayjs(r.createdAt).isSame(now.subtract(1, 'month'), 'month')).length;
    let growthPct = 0;
    if (lastMonth > 0) {
      growthPct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    } else if (thisMonth > 0) {
      growthPct = 100;
    }

    const posOlder =
      sorted.length >= 4
        ? sorted.slice(0, Math.floor(sorted.length / 2)).filter((r) => Number(r.rating) >= 4).length /
          Math.max(1, Math.floor(sorted.length / 2))
        : null;
    const posNewer =
      sorted.length >= 4
        ? sorted.slice(Math.floor(sorted.length / 2)).filter((r) => Number(r.rating) >= 4).length /
          Math.max(1, sorted.length - Math.floor(sorted.length / 2))
        : null;
    let posDeltaPct = null;
    if (posOlder != null && posNewer != null && posOlder > 0) {
      posDeltaPct = Math.round((posNewer - posOlder) * 100);
    }

    return {
      avg: n ? avg.toFixed(1) : '—',
      avgDelta,
      totalAll,
      positivePct,
      posDeltaPct,
      growthPct,
      sampleNote: totalAll > n && n > 0,
    };
  }, [rows, pagination.total]);

  const isNewReview = (createdAt) => {
    if (!createdAt) return false;
    return dayjs().diff(dayjs(createdAt), 'day') <= 3;
  };

  if (typeof hasFeature === 'function' && !hasFeature('crm')) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Reviews require the Customers feature.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Reviews</h1>
          <p className="mt-1 text-sm text-muted-foreground md:text-base">
            See what your customers are saying about your business.
          </p>
          {isManager && (
            <p className="mt-2 text-xs text-muted-foreground">
              Share your{' '}
              <Link to="/settings?tab=workspace" className="font-medium text-foreground underline-offset-2 hover:underline">
                review link and QR
              </Link>{' '}
              under Settings → Workspace → Organization.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 self-start sm:self-auto"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-lg border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl font-bold tabular-nums text-foreground md:text-4xl">
                {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : stats.avg}
              </div>
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(22, 101, 52, 0.12)' }}
              >
                <Star className="h-5 w-5 fill-[#166534] text-[#166534]" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Average rating</p>
            {!loading && stats.avgDelta != null && Math.abs(stats.avgDelta) >= 0.05 && (
              <Badge
                variant="outline"
                className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                {stats.avgDelta >= 0 ? '↑' : '↓'} {Math.abs(stats.avgDelta).toFixed(1)} vs last month
              </Badge>
            )}
            {!loading && stats.avgDelta != null && Math.abs(stats.avgDelta) < 0.05 && (
              <p className="mt-2 text-xs text-muted-foreground">Stable vs prior reviews</p>
            )}
            {!loading && stats.avgDelta == null && rows.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">More reviews to show trends</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl font-bold tabular-nums text-foreground md:text-4xl">
                {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : stats.totalAll.toLocaleString()}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/50">
                <MessageCircle className="h-5 w-5 text-sky-700 dark:text-sky-300" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Total reviews</p>
            <p className="mt-1 text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl font-bold tabular-nums text-foreground md:text-4xl">
                {loading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : `${stats.positivePct}%`}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                <Smile className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Positive reviews</p>
            {!loading && stats.posDeltaPct != null && (
              <Badge
                variant="outline"
                className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                {stats.posDeltaPct >= 0 ? '↑' : '↓'} {Math.abs(stats.posDeltaPct)}% vs last month
              </Badge>
            )}
            {!loading && stats.posDeltaPct == null && rows.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">4–5★ share on loaded reviews</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-3xl font-bold tabular-nums text-foreground md:text-4xl">
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  `${stats.growthPct >= 0 ? '+' : ''}${stats.growthPct}%`
                )}
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
                <TrendingUp className="h-5 w-5 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium text-muted-foreground">Growth</p>
            <p className="mt-1 text-xs text-muted-foreground">vs last month</p>
          </CardContent>
        </Card>
      </div>

      {stats.sampleNote && (
        <p className="text-xs text-muted-foreground">
          Summary stats use up to {rows.length} recent reviews; total count is all-time.
        </p>
      )}

      <Card className="rounded-lg border border-border bg-card">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Search reviews by customer name or comment..."
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              className="max-w-xl"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="rating">Highest rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: '5', label: '5★' },
              { id: '4', label: '4★' },
              { id: '3', label: '3★' },
              { id: '2', label: '2★' },
              { id: '1', label: '1★' },
              { id: 'unread', label: 'Unread', filter: 'unread' },
              { id: 'with', label: 'With comment', filter: 'with' },
            ].map((chip) => {
              const isRating = chip.id !== 'unread' && chip.id !== 'with';
              const activeRating = isRating && ratingFilter === chip.id;
              const activeUnread = chip.id === 'unread' && commentFilter === 'unread';
              const activeWith = chip.id === 'with' && commentFilter === 'with';
              const activeAll = chip.id === 'all' && ratingFilter === 'all' && commentFilter === 'all';
              const isActive = chip.id === 'all' ? activeAll : chip.filter === 'unread' ? activeUnread : chip.filter === 'with' ? activeWith : activeRating;

              return (
                <Button
                  key={chip.id}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  className={cn(
                    isActive && 'bg-[#166534] text-white hover:bg-[#14532d] hover:text-white border-[#166534]'
                  )}
                  onClick={() => {
                    if (chip.id === 'all') {
                      setRatingFilter('all');
                      setCommentFilter('all');
                    } else if (chip.filter === 'unread') {
                      setRatingFilter('all');
                      setCommentFilter(commentFilter === 'unread' ? 'all' : 'unread');
                    } else if (chip.filter === 'with') {
                      setRatingFilter('all');
                      setCommentFilter(commentFilter === 'with' ? 'all' : 'with');
                    } else {
                      setCommentFilter('all');
                      setRatingFilter(ratingFilter === chip.id ? 'all' : chip.id);
                    }
                  }}
                >
                  {chip.label}
                </Button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {loading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && pagedRows.length === 0 && (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <Star className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No reviews match your filters.</p>
              </div>
            )}
            {!loading &&
              pagedRows.map((r) => {
                const name = r.contactName || 'Anonymous';
                const hue = hashHue(name);
                const cat = categoryLabel(r);
                const newFlag = isNewReview(r.createdAt) && !readIds.has(r.id);
                const email = (r.contactEmail || '').trim();

                return (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-3 min-w-0">
                        <Avatar className="h-11 w-11 shrink-0 border border-border">
                          <AvatarFallback
                            className="text-sm font-semibold text-white"
                            style={{ backgroundColor: `hsl(${hue} 45% 36%)` }}
                          >
                            {initials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">{name}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'h-4 w-4',
                                    i < Number(r.rating)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground/35'
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {r.createdAt ? dayjs(r.createdAt).fromNow() : ''}
                            </span>
                            {newFlag && (
                              <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600">New</Badge>
                            )}
                          </div>
                          {(r.comment || '').trim() ? (
                            <p className="mt-2 text-sm text-foreground leading-relaxed">{r.comment}</p>
                          ) : (
                            <p className="mt-2 text-sm italic text-muted-foreground">No written comment</p>
                          )}
                          <Badge variant="outline" className={cn('mt-2 font-normal', categoryBadgeClass(cat))}>
                            {cat}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!email}
                          title={email ? `Reply by email` : 'No email on this review'}
                          onClick={() => {
                            if (!email) return;
                            window.location.href = `mailto:${email}?subject=${encodeURIComponent('Thank you for your review')}&body=${encodeURIComponent('Hi,\n\n')}`;
                          }}
                        >
                          Reply
                        </Button>
                        {!readIds.has(r.id) && (
                          <Button type="button" variant="outline" size="sm" onClick={() => markRead(r.id)}>
                            Mark as read
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="More">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => markRead(r.id)}>Mark as read</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if (email) window.location.href = `mailto:${email}`;
                                else showError('No email for this review');
                              }}
                            >
                              Reply by email
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {!loading && listTotal > 0 && (
            <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {(safeListPage - 1) * pageSize + 1} to {Math.min(safeListPage * pageSize, listTotal)} of{' '}
                {listTotal.toLocaleString()} reviews
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={safeListPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  {paginationItems.map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground select-none">
                        …
                      </span>
                    ) : (
                      <Button
                        key={item}
                        type="button"
                        variant={item === safeListPage ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-9 min-w-9 px-2',
                          item === safeListPage &&
                            'bg-[#166534] text-white hover:bg-[#14532d] hover:text-white border-[#166534]'
                        )}
                        onClick={() => setListPage(item)}
                      >
                        {item}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={safeListPage >= listPages}
                  onClick={() => setListPage((p) => Math.min(listPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 pl-2">
                  <span className="whitespace-nowrap">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v));
                      setListPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[72px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
