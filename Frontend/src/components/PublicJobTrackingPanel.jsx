/**
 * Public tracking body: reference ID row, status pill, vertical timeline.
 * Modes: job workflow, first-party delivery, or restaurant kitchen (single timeline at a time).
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DEFAULT_APP_PRIMARY_HEX } from '../utils/colors';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_ORDER,
} from '../constants';

const STATUS_BADGE_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const STATUS_NEW_BLACK = '#171717';
const COMPLETED_GREEN = DEFAULT_APP_PRIMARY_HEX;

const KITCHEN_STEPS = [
  { key: ORDER_STATUSES.RECEIVED, label: 'ORDER RECEIVED' },
  { key: ORDER_STATUSES.PREPARING, label: 'PREPARING' },
  { key: ORDER_STATUSES.READY, label: 'READY' },
  { key: ORDER_STATUSES.COMPLETED, label: 'COMPLETED' },
];

const DELIVERY_STEPS = DELIVERY_STATUS_ORDER.map((key) => ({
  key,
  label: String(DELIVERY_STATUS_LABELS[key] || key).toUpperCase(),
}));

function hexToRgba(hex, alpha) {
  const fallback = DEFAULT_APP_PRIMARY_HEX;
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
  if (!m) {
    const fb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fallback);
    if (!fb) return `rgba(22, 101, 52, ${alpha})`;
    return `rgba(${parseInt(fb[1], 16)},${parseInt(fb[2], 16)},${parseInt(fb[3], 16)},${alpha})`;
  }
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

export function normalizeJobStatus(status) {
  if (status == null || status === '') return 'new';
  if (typeof status !== 'string' && typeof status !== 'number') return 'new';
  const s = String(status).trim().toLowerCase().replace(/\s+/g, '_');
  return s || 'new';
}

function normalizeKitchenOrderStatus(status) {
  if (status == null || status === '') return '';
  return String(status).trim().toLowerCase().replace(/\s+/g, '_');
}

function kitchenStepFilled(stepIndex, normalizedOrderStatus) {
  const idx = KITCHEN_STEPS.findIndex((s) => s.key === normalizedOrderStatus);
  if (idx < 0) return stepIndex === 0 && normalizedOrderStatus === '';
  return stepIndex <= idx;
}

function deliveryStepFilled(stepIndex, deliveryStatus) {
  if (!deliveryStatus) return false;
  const idx = DELIVERY_STATUS_ORDER.indexOf(deliveryStatus);
  if (idx < 0) return false;
  return stepIndex <= idx;
}

function formatTimelineDateTime(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

function isJobTimelineStepFilled(stepIndex, normalizedStatus) {
  const s = normalizedStatus;
  if (s === 'completed') return true;
  if (s === 'in_progress' || s === 'on_hold') return stepIndex <= 1;
  if (s === 'cancelled') return stepIndex === 0;
  return stepIndex === 0;
}

function getStatusBadgePresentation(status) {
  const s = normalizeJobStatus(status);
  const label = STATUS_BADGE_LABELS[s] || (status ? String(status).replace(/_/g, ' ') : '—');
  const base = {
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
  };

  if (s === 'new') {
    return {
      label: 'New',
      style: {
        ...base,
        borderColor: STATUS_NEW_BLACK,
        color: STATUS_NEW_BLACK,
        backgroundColor: 'transparent',
      },
    };
  }
  if (s === 'in_progress' || s === 'on_hold') {
    return {
      label: s === 'on_hold' ? 'On hold' : 'In progress',
      style: {
        ...base,
        borderColor: '#ea580c',
        color: '#ea580c',
        backgroundColor: 'transparent',
      },
    };
  }
  if (s === 'completed') {
    return {
      label: 'Completed',
      style: {
        ...base,
        borderColor: COMPLETED_GREEN,
        color: COMPLETED_GREEN,
        backgroundColor: hexToRgba(COMPLETED_GREEN, 0.15),
      },
    };
  }
  if (s === 'cancelled') {
    return {
      label: 'Cancelled',
      style: {
        ...base,
        borderColor: '#737373',
        color: '#525252',
        backgroundColor: 'transparent',
      },
    };
  }
  return {
    label,
    style: {
      ...base,
      borderColor: STATUS_NEW_BLACK,
      color: STATUS_NEW_BLACK,
      backgroundColor: 'transparent',
    },
  };
}

function getDeliveryBadgePresentation(deliveryStatus) {
  const base = {
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
  };
  if (!deliveryStatus) {
    return {
      label: '—',
      style: {
        ...base,
        borderColor: STATUS_NEW_BLACK,
        color: STATUS_NEW_BLACK,
        backgroundColor: 'transparent',
      },
    };
  }
  const label = DELIVERY_STATUS_LABELS[deliveryStatus] || deliveryStatus.replace(/_/g, ' ');
  return {
    label,
    style: {
      ...base,
      borderColor: COMPLETED_GREEN,
      color: COMPLETED_GREEN,
      backgroundColor: hexToRgba(COMPLETED_GREEN, 0.12),
    },
  };
}

function getKitchenBadgePresentation(orderStatus) {
  const n = normalizeKitchenOrderStatus(orderStatus);
  const label = n ? ORDER_STATUS_LABELS[n] || n.replace(/_/g, ' ') : '—';
  const base = {
    borderWidth: 1,
    borderStyle: 'solid',
    boxSizing: 'border-box',
    borderColor: COMPLETED_GREEN,
    color: COMPLETED_GREEN,
    backgroundColor: hexToRgba(COMPLETED_GREEN, 0.12),
  };
  return { label, style: base };
}

/**
 * @param {object} props
 * @param {string} props.primaryColor
 * @param {string} props.jobNumber - Job or order reference number
 * @param {string} [props.title]
 * @param {'job'|'delivery'|'kitchen'} [props.timelineKind]
 * @param {string} [props.status] - Job status when timelineKind is job
 * @param {string|null} [props.deliveryStatus]
 * @param {string|null} [props.orderStatus] - Kitchen pipeline when timelineKind is kitchen
 * @param {string|Date|null} [props.orderDate]
 * @param {string|Date|null} [props.startDate]
 * @param {string|Date|null} [props.inProgressAt]
 * @param {string|Date|null} [props.completionDate]
 * @param {string|Date|null} [props.createdAt]
 * @param {string|Date|null} [props.updatedAt]
 */
export function PublicJobTrackingPanel({
  primaryColor,
  jobNumber,
  title,
  timelineKind = 'job',
  status,
  deliveryStatus = null,
  orderStatus = null,
  orderDate,
  startDate,
  inProgressAt,
  completionDate,
  createdAt,
  updatedAt,
}) {
  const color =
    typeof primaryColor === 'string' && primaryColor.trim() ? primaryColor.trim() : DEFAULT_APP_PRIMARY_HEX;

  const mode = timelineKind === 'delivery' || timelineKind === 'kitchen' ? timelineKind : 'job';

  const normalizedJobStatus = normalizeJobStatus(status);
  const normalizedKitchenStatus = normalizeKitchenOrderStatus(orderStatus);

  const badge = useMemo(() => {
    if (mode === 'delivery') return getDeliveryBadgePresentation(deliveryStatus);
    if (mode === 'kitchen') return getKitchenBadgePresentation(orderStatus);
    return getStatusBadgePresentation(status);
  }, [mode, deliveryStatus, orderStatus, status]);

  const steps = useMemo(() => {
    if (mode === 'delivery') {
      return DELIVERY_STEPS.map((s) => ({
        label: s.label,
        date: null,
      }));
    }
    if (mode === 'kitchen') {
      return KITCHEN_STEPS.map((s, i) => ({
        label: s.label,
        date:
          i === KITCHEN_STEPS.findIndex((x) => x.key === normalizedKitchenStatus) && normalizedKitchenStatus
            ? updatedAt
            : null,
      }));
    }
    const inProgressDate =
      startDate ||
      inProgressAt ||
      (normalizedJobStatus === 'in_progress' && updatedAt ? updatedAt : null);
    return [
      { label: 'JOB CREATED', date: orderDate || createdAt },
      { label: 'IN PROGRESS', date: inProgressDate },
      { label: 'COMPLETED', date: completionDate },
    ];
  }, [
    mode,
    normalizedKitchenStatus,
    normalizedJobStatus,
    orderDate,
    createdAt,
    startDate,
    inProgressAt,
    completionDate,
    updatedAt,
  ]);

  const isStepFilled = (index) => {
    if (mode === 'delivery') return deliveryStepFilled(index, deliveryStatus);
    if (mode === 'kitchen') return kitchenStepFilled(index, normalizedKitchenStatus);
    return isJobTimelineStepFilled(index, normalizedJobStatus);
  };

  const pendingStyleForIndex = (index) => {
    if (mode === 'job') {
      const isPending = !isStepFilled(index);
      const isNewFutureStep = normalizedJobStatus === 'new' && isPending;
      return { isPending, isNewFutureStep };
    }
    const isPending = !isStepFilled(index);
    return { isPending, isNewFutureStep: false };
  };

  return (
    <div className="bg-white px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-6 border-b border-border">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground">{jobNumber}</p>
          {title ? <p className="text-sm font-normal text-foreground mt-0.5">{title}</p> : null}
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium capitalize"
          style={badge.style}
        >
          {badge.label}
        </span>
      </div>

      <div className="pt-6">
        {steps.map((step, index) => {
          const isFilled = isStepFilled(index);
          const dt = isFilled ? formatTimelineDateTime(step.date) : null;
          const { isPending, isNewFutureStep } = pendingStyleForIndex(index);
          const nextFilled = index < steps.length - 1 ? isStepFilled(index + 1) : false;
          const lineStrong = isFilled && nextFilled;
          const lineClass = lineStrong
            ? 'border-neutral-800'
            : mode === 'job' && normalizedJobStatus === 'new'
              ? 'border-neutral-200'
              : 'border-neutral-300';

          return (
            <div key={step.label} className="flex gap-3 items-stretch">
              <div className="flex w-6 shrink-0 flex-col items-center">
                {isFilled ? (
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                    style={{ borderColor: color }}
                    aria-hidden
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'box-border h-5 w-5 shrink-0 rounded-full border-2 bg-white',
                      isNewFutureStep ? 'border-neutral-200' : 'border-neutral-300'
                    )}
                    aria-hidden
                  />
                )}
                {index < steps.length - 1 ? (
                  <div
                    className={`mt-0 w-0 flex-1 min-h-[2.75rem] border-l-2 border-dashed ${lineClass}`}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className={cn('min-w-0 flex-1', index < steps.length - 1 && 'pb-5')}>
                <div className="min-h-[1.125rem]">
                  {dt ? <p className="text-xs font-normal text-foreground">{dt}</p> : null}
                </div>
                <p
                  className={cn(
                    'text-sm font-bold uppercase tracking-wide mt-0.5',
                    isPending && (isNewFutureStep ? 'text-neutral-300' : 'text-neutral-400'),
                    !isPending && 'text-foreground'
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
