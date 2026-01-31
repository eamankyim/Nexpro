import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Secondary button: white background with border (stroke).
 * Same design as Refresh / Filter / Cancel buttons. Use for secondary actions
 * across the app instead of <Button variant="outline">.
 */
const SecondaryButton = React.forwardRef(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="secondaryStroke"
    className={cn(className)}
    {...props}
  />
));
SecondaryButton.displayName = 'SecondaryButton';

export { SecondaryButton };
