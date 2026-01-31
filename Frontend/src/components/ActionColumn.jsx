import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { SecondaryButton } from '@/components/ui/secondary-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, MoreVertical } from 'lucide-react';
import { useResponsive } from '@/hooks/useResponsive';
import { cn } from '@/lib/utils';

/**
 * Reusable Action Column Component for Tables
 * @param {Function} onView - Callback function when view button is clicked
 * @param {Object} record - The current row record
 * @param {Array} extraActions - Array of extra action objects with {label, onClick, type, icon}
 */
const ActionColumn = memo(({ onView, record, extraActions = [] }) => {
  const { isMobile } = useResponsive();

  if (extraActions.length === 0) {
    return (
      <div className={cn("flex items-center gap-1 md:gap-2")}>
        <SecondaryButton
          onClick={() => onView(record)}
          size={isMobile ? "icon" : "sm"}
        >
          <Eye className="h-4 w-4" />
          {!isMobile && <span className="ml-2">View</span>}
        </SecondaryButton>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 md:gap-2")}>
      <SecondaryButton
        onClick={() => onView(record)}
        size={isMobile ? "icon" : "sm"}
      >
        <Eye className="h-4 w-4" />
        {!isMobile && <span className="ml-2">View</span>}
      </SecondaryButton>
      {extraActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SecondaryButton size={isMobile ? "icon" : "sm"}>
              <MoreVertical className="h-4 w-4" />
            </SecondaryButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {extraActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={action.disabled ? undefined : action.onClick}
                className="flex items-center gap-2"
                disabled={action.disabled}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});

ActionColumn.displayName = 'ActionColumn';

export default ActionColumn;


