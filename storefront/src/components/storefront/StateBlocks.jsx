import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
);

export const OrderHistorySkeleton = ({ rows = 3 }) => (
  <div
    className="mt-6 grid gap-4"
    role="status"
    aria-live="polite"
    aria-label="Loading order history"
  >
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="rounded-2xl border border-slate-200 p-4 sm:rounded-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-8 w-8 rounded-xl" />
          <SkeletonBlock className="h-5 w-36" />
          <SkeletonBlock className="h-6 w-24 rounded-full" />
        </div>
        <SkeletonBlock className="mt-4 h-4 w-2/3" />
        <SkeletonBlock className="mt-3 h-4 w-1/2" />
      </div>
    ))}
  </div>
);

export const WishlistSkeleton = ({ rows = 3 }) => (
  <div
    className="mt-6 grid gap-4"
    role="status"
    aria-live="polite"
    aria-label="Loading wishlist"
  >
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:rounded-3xl">
        <SkeletonBlock className="h-28 w-full sm:w-28" />
        <div>
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-3 h-5 w-56 max-w-full" />
          <SkeletonBlock className="mt-4 h-6 w-24 rounded-full" />
          <SkeletonBlock className="mt-3 h-5 w-20" />
        </div>
        <div className="grid gap-2 sm:w-32">
          <SkeletonBlock className="h-10 rounded-full" />
          <SkeletonBlock className="h-10 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const InlineErrorState = ({
  title = 'Could not load this section',
  message = 'Check your connection and try again.',
  onRetry,
}) => (
  <div
    role="alert"
    className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:rounded-3xl"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm leading-6 opacity-90">{message}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 rounded-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
            onClick={onRetry}
          >
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  </div>
);
