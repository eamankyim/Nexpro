import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { CHUNK_LOAD_REFRESH_MESSAGE, reloadForChunkError } from '../utils/chunkLoadError';

/**
 * Toast body for stale chunk / deploy mismatch errors with a fast Refresh action.
 */
export default function ChunkLoadRefreshToast({ message = CHUNK_LOAD_REFRESH_MESSAGE }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isRefreshing) return;
    setIsRefreshing(true);
    reloadForChunkError();
  };

  return (
    <div className="flex flex-col gap-2 pr-1">
      <span className="text-sm leading-snug">{message}</span>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
      >
        {isRefreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}
