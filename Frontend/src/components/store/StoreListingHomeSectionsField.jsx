import { Checkbox } from '@/components/ui/checkbox';

/**
 * Multi-select for Online Store home product sections (listing.metadata.sectionIds).
 * @param {{
 *   sections?: Array<{ id: string, title: string, enabled?: boolean }> | null,
 *   value?: string[],
 *   onChange: (next: string[]) => void,
 *   idPrefix?: string,
 * }} props
 */
export default function StoreListingHomeSectionsField({
  sections = [],
  value = [],
  onChange,
  idPrefix = 'home-section',
}) {
  const options = Array.isArray(sections) ? sections : [];
  const selected = Array.isArray(value) ? value : [];

  if (!options.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No home sections yet. Add them from Online Store → Edit → Product sections.
      </p>
    );
  }

  const toggle = (sectionId, checked) => {
    if (checked) {
      onChange(selected.includes(sectionId) ? selected : [...selected, sectionId]);
      return;
    }
    onChange(selected.filter((id) => id !== sectionId));
  };

  return (
    <div className="space-y-2">
      {options.map((section) => {
        const id = `${idPrefix}-${section.id}`;
        const checked = selected.includes(section.id);
        return (
          <label
            key={section.id}
            htmlFor={id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5"
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) => toggle(section.id, next === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{section.title}</span>
              {section.enabled === false ? (
                <span className="text-xs text-muted-foreground">Hidden on storefront</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
