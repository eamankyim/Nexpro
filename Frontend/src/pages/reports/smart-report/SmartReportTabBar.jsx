import { cn } from '@/lib/utils';
import { SMART_REPORT_TABS } from './smartReportConstants';

/**
 * Horizontal tab bar for Smart Report sections.
 */
export default function SmartReportTabBar({ tabs, activeTab, onTabChange }) {
  const visibleTabs = tabs?.length ? tabs : SMART_REPORT_TABS;

  return (
    <div className="border-b border-border overflow-x-auto">
      <div className="flex min-w-max gap-0">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
