import { CheckCircle2 } from 'lucide-react';

const SHORT_STEP_COPY = {
  placed: { label: 'Order placed', description: 'Received' },
  processing: { label: 'Processing', description: 'Preparing' },
  packed: { label: 'Packed', description: 'Ready' },
  out_for_delivery: { label: 'Out for delivery', description: 'On the way' },
  delivered: { label: 'Delivered', description: 'Delivered' },
};

const formatStepTime = (value) => {
  if (!value) return 'Pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Pending';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getStepCopy = (step) => (
  SHORT_STEP_COPY[step?.key] || {
    label: step?.label || 'Update',
    description: step?.description || 'Pending',
  }
);

const getStepClasses = (state) => {
  if (state === 'complete') {
    return {
      dot: 'border-green-700 bg-green-700 text-white',
      connector: 'bg-green-300',
      panel: 'border-green-200 bg-green-50 text-green-900',
      time: 'text-green-800',
    };
  }

  if (state === 'current') {
    return {
      dot: 'border-green-700 bg-white text-green-700',
      connector: 'bg-slate-200',
      panel: 'border-green-300 bg-white text-slate-950',
      time: 'text-slate-700',
    };
  }

  return {
    dot: 'border-slate-300 bg-white text-slate-300',
    connector: 'bg-slate-200',
    panel: 'border-slate-200 bg-slate-50 text-slate-500',
    time: 'text-slate-500',
  };
};

const isTimelineDone = (timeline) => (
  timeline.length > 0
  && timeline.every((step) => step?.status === 'complete' || step?.completed === true || Boolean(step?.timestamp))
);

const getVisualState = (step, timelineDone) => {
  const deliveredComplete = step?.key === 'delivered' && (step?.completed === true || Boolean(step?.timestamp));

  if (step?.status === 'complete' || deliveredComplete || (timelineDone && step?.completed === true)) {
    return 'complete';
  }

  if (step?.status === 'current') return 'current';

  return 'pending';
};

const DeliveryProgressTimeline = ({ timeline = [] }) => {
  if (!timeline.length) return null;
  const timelineDone = isTimelineDone(timeline);

  return (
    <div className="overflow-x-auto pb-2">
      <ol className="grid gap-3 md:flex md:min-w-[46rem] md:items-start" aria-label="Delivery progress timeline">
        {timeline.map((step, index) => {
          const copy = getStepCopy(step);
          const visualState = getVisualState(step, timelineDone);
          const classes = getStepClasses(visualState);
          const isCompleted = visualState === 'complete';

          return (
            <li key={step?.key || `${copy.label}-${index}`} className="relative flex flex-1 items-start gap-3 md:flex-col md:items-center md:px-2 md:text-center">
              {index < timeline.length - 1 ? (
                <span className={`absolute left-5 top-10 h-full w-0.5 md:left-1/2 md:top-5 md:h-0.5 md:w-full ${classes.connector}`} aria-hidden="true" />
              ) : null}
              <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${classes.dot}`}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <span className="h-2.5 w-2.5 rounded-full bg-current" />}
              </span>
              <div className={`min-h-28 w-full min-w-0 rounded-2xl border p-3 sm:rounded-3xl md:mt-3 md:min-h-32 ${classes.panel}`}>
                <p className="text-sm font-black">{copy.label}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide">{copy.description}</p>
                <p className={`mt-3 text-xs font-bold leading-5 ${classes.time}`}>
                  {formatStepTime(step?.timestamp)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default DeliveryProgressTimeline;
