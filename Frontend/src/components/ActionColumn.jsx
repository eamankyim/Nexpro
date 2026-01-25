import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, MoreVertical } from 'lucide-react';

/**
 * Reusable Action Column Component for Tables
 * @param {Function} onView - Callback function when view button is clicked
 * @param {Object} record - The current row record
 * @param {Array} extraActions - Array of extra action objects with {label, onClick, type, icon}
 */
const ActionColumn = ({ onView, record, extraActions = [] }) => {
  if (extraActions.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onView(record)}
          size="sm"
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => onView(record)}
        size="sm"
      >
        <Eye className="h-4 w-4 mr-2" />
        View
      </Button>
      {extraActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {extraActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={action.onClick}
                className="flex items-center gap-2"
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
};

export default ActionColumn;


