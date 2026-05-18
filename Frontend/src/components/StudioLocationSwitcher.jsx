import { Building2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStudioLocationOptional } from '../context/StudioLocationContext';

/**
 * Header control to switch active studio location (studio workspaces only).
 */
export default function StudioLocationSwitcher() {
  const ctx = useStudioLocationOptional();
  if (!ctx?.isStudioWorkspace || ctx.loadingLocations) return null;
  if (!ctx.locations?.length) return null;

  const label =
    ctx.activeLocation?.name ||
    (ctx.canAccessAll ? 'All studios' : 'Select studio');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-w-[200px] border-border">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Studio location</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ctx.canAccessAll && (
          <DropdownMenuItem
            onClick={() => ctx.setActiveStudioLocation('all')}
            className={!ctx.activeStudioLocationId ? 'bg-muted' : ''}
          >
            All studios
          </DropdownMenuItem>
        )}
        {ctx.locations.map((loc) => (
          <DropdownMenuItem
            key={loc.id}
            onClick={() => ctx.setActiveStudioLocation(loc.id)}
            className={ctx.activeStudioLocationId === loc.id ? 'bg-muted' : ''}
          >
            {loc.name}
            {loc.isDefault ? ' (default)' : ''}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
