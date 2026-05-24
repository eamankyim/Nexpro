import { memo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

const FeatureNotAvailable = memo(({
  icon = 'Inbox',
  title = 'Feature not available',
  description,
  className,
}) => {
  return (
    <div className={cn('rounded-lg border border-border bg-card', className)}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        className="px-6"
        size="lg"
      />
    </div>
  );
});

FeatureNotAvailable.displayName = 'FeatureNotAvailable';

export default FeatureNotAvailable;
