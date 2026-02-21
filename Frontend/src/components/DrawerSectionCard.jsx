import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Section card for detail drawers. Renders a bold section heading and a card
 * with light grey background, border, and padding for consistent drawer layout.
 * @param {string} title - Section heading text
 * @param {React.ReactNode} children - Card content
 * @param {Array<{ label: string, onClick: function }>} actions - Optional menu items for section actions (ellipsis)
 * @param {React.ReactNode} extra - Optional element to show next to title (e.g. Add button)
 * @param {string} className - Optional class for the wrapper
 */
function DrawerSectionCard({ title, children, actions = [], extra, className }) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-1">
          {extra}
          {Array.isArray(actions) && actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gray-500 hover:text-gray-700">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Section actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((item, i) => (
                <DropdownMenuItem key={item.key ?? i} onClick={item.onClick}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/50 p-4 [&_dl>div]:-mx-4 [&_dl>div]:w-[calc(100%+2rem)] [&_dl>div]:px-4">
        {children}
      </div>
    </section>
  );
}

export default DrawerSectionCard;
