/**
 * Public page: track a job status via link (no login).
 * Route: /track-job/:token
 * API: GET /api/public/jobs/track/:token
 */
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Loader2 } from 'lucide-react';
import { PublicTrackingBrandShell } from '../components/PublicTrackingBrandShell';
import { PublicJobTrackingPanel } from '../components/PublicJobTrackingPanel';
import { DEFAULT_APP_PRIMARY_HEX } from '../utils/colors';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '—';
  }
}

function formatRelativeUpdated(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 10) return 'Updated just now';
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min} min${min === 1 ? '' : 's'} ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `Updated ${h}h ago`;
  return `Updated ${formatDate(value)}`;
}

export default function TrackJob() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    const path = `/api/public/jobs/track/${encodeURIComponent(token)}?_=${Date.now()}`;
    const url = API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}${path}` : path;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          if (!cancelled) {
            setError(
              res.ok
                ? 'Invalid response from server.'
                : `Unable to load this job (${res.status}).`
            );
          }
          return;
        }
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.message || `Unable to load this job (${res.status}).`);
          return;
        }
        if (json?.success && json?.data?.job) {
          setData(json.data);
        } else {
          setError('Job not found');
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || '';
        if (msg === 'Failed to fetch' || err?.name === 'TypeError') {
          setError(
            'Cannot reach the server. Check your connection. If this keeps happening, the app may be missing VITE_API_URL for this deployment.'
          );
        } else {
          setError(msg || 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const org = data?.organization || {};
  const job = data?.job;
  const primaryColor =
    typeof org.primaryColor === 'string' && org.primaryColor.trim()
      ? org.primaryColor.trim()
      : DEFAULT_APP_PRIMARY_HEX;

  const updatedLine = useMemo(() => formatRelativeUpdated(job?.updatedAt), [job?.updatedAt]);

  if (loading) {
    return (
      <PublicTrackingBrandShell variant="neutral" organizationName="Loading" subtitle="Fetching your job status…">
        <div className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (error || !job) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Unable to show this job"
        subtitle="The link may be invalid or tracking is turned off."
      >
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{error || 'Job not found'}</p>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  return (
    <PublicTrackingBrandShell
      primaryColor={primaryColor}
      organizationName={org.name || 'Job update'}
      logoUrl={org.logoUrl}
      subtitle="Track your job"
      headerMeta={updatedLine}
    >
      <PublicJobTrackingPanel
        primaryColor={primaryColor}
        jobNumber={job.jobNumber}
        title={job.title}
        timelineKind={job.timelineKind === 'delivery' ? 'delivery' : 'job'}
        status={job.status}
        deliveryStatus={job.deliveryStatus}
        orderDate={job.orderDate}
        startDate={job.startDate}
        inProgressAt={job.inProgressAt}
        completionDate={job.completionDate}
        createdAt={job.createdAt}
        updatedAt={job.updatedAt}
      />
    </PublicTrackingBrandShell>
  );
}
