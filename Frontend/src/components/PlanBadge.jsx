import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PLAN_CHIP_CLASSES, PLAN_CHIP_DEFAULT_CLASS } from '../constants';

const PLAN_ALIASES = {
  free: 'trial',
  standard: 'starter',
  pro: 'professional',
  launch: 'starter',
  scale: 'professional',
};

const PLAN_LABELS = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const normalizePlanId = (plan = '') =>
  PLAN_ALIASES[String(plan).trim().toLowerCase()] || String(plan).trim().toLowerCase();

/**
 * PlanBadge - Consistent subscription plan indicator for admin views.
 * trial = orange, professional = green, enterprise = blue.
 */
const PlanBadge = memo(({ plan, className, children, ...props }) => {
  if (!plan && !children) return null;

  const normalizedPlan = normalizePlanId(plan);
  const chipClass = PLAN_CHIP_CLASSES[normalizedPlan] ?? PLAN_CHIP_DEFAULT_CLASS;
  const displayText = children ?? PLAN_LABELS[normalizedPlan] ?? String(plan);

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-2.5 py-0.5 text-xs font-semibold border',
        chipClass,
        className
      )}
      {...props}
    >
      {displayText}
    </Badge>
  );
});

PlanBadge.displayName = 'PlanBadge';

export default PlanBadge;
