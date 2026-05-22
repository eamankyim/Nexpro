import { formatOverviewCurrency } from '../overview/overviewUtils';

/**
 * Section heading with optional date subtitle.
 */
export default function SmartReportSectionHeader({ title, description, periodLabel }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between mb-4 md:mb-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {periodLabel && (
        <p className="text-sm text-muted-foreground shrink-0">{periodLabel}</p>
      )}
    </div>
  );
}

export { formatOverviewCurrency };
