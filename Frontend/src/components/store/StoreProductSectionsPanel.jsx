import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

import { showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const MAX_PRODUCT_SECTIONS = 12;
const DEFAULT_MAX_ITEMS = 8;

const DEFAULT_SECTION_DEFS = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    slug: 'featured',
    title: 'Featured products',
    description: null,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    slug: 'new-arrivals',
    title: 'New arrivals',
    description: null,
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    slug: 'weekend-sales',
    title: 'Weekend sales',
    description: null,
  },
];

const createId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const createDefaultItems = () => DEFAULT_SECTION_DEFS.map((def, index) => ({
  id: def.id,
  slug: def.slug,
  title: def.title,
  description: def.description || '',
  sortOrder: index,
  enabled: true,
  isDefault: true,
  maxItems: DEFAULT_MAX_ITEMS,
}));

const createCustomItem = (sortOrder = 0) => ({
  id: createId(),
  slug: 'custom',
  title: '',
  description: '',
  sortOrder,
  enabled: true,
  isDefault: false,
  maxItems: DEFAULT_MAX_ITEMS,
});

/**
 * Normalize stored product sections into editable draft shape.
 * Seeds Featured / New arrivals / Weekend sales when empty.
 * @param {unknown} value
 * @returns {{ enabled: boolean, items: object[] }}
 */
const normalizeDraft = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.length
    ? rawItems.map((item, index) => ({
      id: item?.id || createId(),
      slug: String(item?.slug || 'custom'),
      title: String(item?.title || ''),
      description: item?.description == null ? '' : String(item.description),
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
      enabled: item?.enabled === true,
      isDefault: item?.isDefault === true,
      maxItems: Number.isFinite(Number(item?.maxItems))
        ? Math.max(1, Math.trunc(Number(item.maxItems)))
        : DEFAULT_MAX_ITEMS,
    }))
    : createDefaultItems();

  return {
    enabled: source.enabled !== false,
    items: items.sort((a, b) => a.sortOrder - b.sortOrder),
  };
};

/**
 * Merchant panel for Online Store home product listing sections (merchandising shelves).
 * @param {{
 *   value?: { enabled?: boolean, items?: object[] } | null,
 *   onSave: (productSections: { enabled: boolean, items: object[] }) => void | Promise<void>,
 *   saving?: boolean,
 * }} props
 */
export default function StoreProductSectionsPanel({ value, onSave, saving = false }) {
  const [draft, setDraft] = useState(() => normalizeDraft(value));

  useEffect(() => {
    setDraft(normalizeDraft(value));
  }, [value]);

  const items = draft.items;
  const canAdd = items.length < MAX_PRODUCT_SECTIONS;

  const validationError = useMemo(() => {
    if (!draft.enabled) return null;
    const incomplete = items.find((item) => !String(item.title || '').trim());
    if (incomplete) return 'Each section needs a title.';
    return null;
  }, [draft.enabled, items]);

  const updateItem = useCallback((id, patch) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, []);

  const addItem = useCallback(() => {
    if (!canAdd) {
      showError(`You can add up to ${MAX_PRODUCT_SECTIONS} sections`);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      items: [...prev.items, createCustomItem(prev.items.length)],
    }));
  }, [canAdd]);

  const removeItem = useCallback((id) => {
    setDraft((prev) => {
      const target = prev.items.find((item) => item.id === id);
      if (target?.isDefault) {
        showError('Default sections can be hidden, not removed');
        return prev;
      }
      return {
        ...prev,
        items: prev.items
          .filter((item) => item.id !== id)
          .map((item, index) => ({ ...item, sortOrder: index })),
      };
    });
  }, []);

  const moveItem = useCallback((id, direction) => {
    setDraft((prev) => {
      const next = [...prev.items];
      const index = next.findIndex((item) => item.id === id);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return {
        ...prev,
        items: next.map((item, sortOrder) => ({ ...item, sortOrder })),
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (validationError) {
      showError(validationError);
      return;
    }
    const payload = {
      enabled: draft.enabled === true,
      items: draft.items.map((item, index) => ({
        id: item.id,
        slug: item.isDefault ? item.slug : 'custom',
        title: String(item.title || '').trim(),
        description: String(item.description || '').trim() || null,
        sortOrder: index,
        enabled: item.enabled === true,
        isDefault: item.isDefault === true,
        maxItems: Number.isFinite(Number(item.maxItems))
          ? Math.max(1, Math.trunc(Number(item.maxItems)))
          : DEFAULT_MAX_ITEMS,
      })).filter((item) => item.title),
    };
    await onSave(payload);
  }, [draft, onSave, validationError]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">Show product sections on storefront</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Home shelves for featured, new, sales, or custom collections. Assign products when publishing.
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            aria-label="Enable product sections"
          />
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">No sections yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add up to {MAX_PRODUCT_SECTIONS} home shelves.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {item.isDefault ? item.title || `Section ${index + 1}` : `Custom section ${index + 1}`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`section-enabled-${item.id}`} className="text-xs text-muted-foreground">
                      Visible
                    </Label>
                    <Switch
                      id={`section-enabled-${item.id}`}
                      checked={item.enabled}
                      onCheckedChange={(checked) => updateItem(item.id, { enabled: checked })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  {!item.isDefault ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`section-title-${item.id}`}>Title</Label>
                  <Input
                    id={`section-title-${item.id}`}
                    value={item.title}
                    onChange={(event) => updateItem(item.id, { title: event.target.value })}
                    placeholder="Featured products"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`section-desc-${item.id}`}>Description (optional)</Label>
                  <Textarea
                    id={`section-desc-${item.id}`}
                    rows={2}
                    value={item.description}
                    onChange={(event) => updateItem(item.id, { description: event.target.value })}
                    placeholder="Short line under the title"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`section-max-${item.id}`}>Max products</Label>
                  <Input
                    id={`section-max-${item.id}`}
                    type="number"
                    min={1}
                    max={24}
                    value={item.maxItems}
                    onChange={(event) => updateItem(item.id, {
                      maxItems: Math.max(1, Math.trunc(Number(event.target.value) || DEFAULT_MAX_ITEMS)),
                    })}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          disabled={!canAdd || saving}
          className="h-11 rounded-xl"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add section
          <span className="ml-2 text-muted-foreground">
            ({items.length}/{MAX_PRODUCT_SECTIONS})
          </span>
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || Boolean(validationError)}
          className="h-11 rounded-xl bg-[#166534] text-white hover:bg-[#14532d]"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save sections
        </Button>
      </div>
    </div>
  );
}
