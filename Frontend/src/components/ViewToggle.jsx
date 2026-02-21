import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useResponsive } from '@/hooks/useResponsive';

/**
 * ViewToggle - Grid/List view toggle for tables
 * Hidden on mobile; card view is default and only option on mobile.
 * @param {string} value - 'table' | 'grid'
 * @param {function} onChange - (value: 'table' | 'grid') => void
 * @param {string} [className] - Additional class names
 */
const ViewToggle = ({ value, onChange, className }) => {
  const { isMobile } = useResponsive();
  if (isMobile) return null;

  return (
    <div className={cn('flex border border-border rounded-md', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={value === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => onChange('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show as cards</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={value === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => onChange('table')}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Show as table</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default ViewToggle;
