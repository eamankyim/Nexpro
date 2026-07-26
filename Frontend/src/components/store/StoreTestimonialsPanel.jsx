import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Quote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import storeService from '../../services/storeService';
import { API_BASE_URL } from '../../services/api';
import { showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const MAX_TESTIMONIALS = 8;

const resolveUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL || ''}${url}`;
  return url;
};

const createEmptyItem = () => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  quote: '',
  authorName: '',
  role: '',
  company: '',
  photoUrl: null,
  sortOrder: 0,
  enabled: true,
});

/**
 * Normalize stored testimonials into editable draft shape.
 * @param {unknown} value
 * @returns {{ enabled: boolean, items: object[] }}
 */
const normalizeDraft = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const items = Array.isArray(source.items)
    ? source.items.map((item, index) => ({
      id: item?.id || createEmptyItem().id,
      quote: String(item?.quote || ''),
      authorName: String(item?.authorName || ''),
      role: String(item?.role || ''),
      company: String(item?.company || ''),
      photoUrl: item?.photoUrl || null,
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
      enabled: item?.enabled !== false,
    }))
    : [];
  return {
    enabled: source.enabled === true,
    items: items.sort((a, b) => a.sortOrder - b.sortOrder),
  };
};

/**
 * Merchant panel for Online Store curated testimonials (not Verified reviews).
 * @param {{
 *   value?: { enabled?: boolean, items?: object[] } | null,
 *   onSave: (testimonials: { enabled: boolean, items: object[] }) => void | Promise<void>,
 *   saving?: boolean,
 * }} props
 */
export default function StoreTestimonialsPanel({ value, onSave, saving = false }) {
  const [draft, setDraft] = useState(() => normalizeDraft(value));
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    setDraft(normalizeDraft(value));
  }, [value]);

  const items = draft.items;
  const canAdd = items.length < MAX_TESTIMONIALS;

  const validationError = useMemo(() => {
    if (!draft.enabled) return null;
    const incomplete = items.find((item) => {
      const quote = String(item.quote || '').trim();
      const authorName = String(item.authorName || '').trim();
      return (quote && !authorName) || (!quote && authorName);
    });
    if (incomplete) return 'Each testimonial needs both a quote and an author name.';
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
      showError(`You can add up to ${MAX_TESTIMONIALS} testimonials`);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      items: [...prev.items, { ...createEmptyItem(), sortOrder: prev.items.length }],
    }));
  }, [canAdd]);

  const removeItem = useCallback((id) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index })),
    }));
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

  const handlePhotoUpload = useCallback(async (id, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingId(id);
    try {
      const res = await storeService.uploadHeroImages([file]);
      const urls = res?.data?.imageUrls || res?.imageUrls || [];
      const photoUrl = urls[0] || null;
      if (!photoUrl) throw new Error('Upload returned no URL');
      updateItem(id, { photoUrl });
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to upload photo');
    } finally {
      setUploadingId(null);
    }
  }, [updateItem]);

  const handleSave = useCallback(async () => {
    if (validationError) {
      showError(validationError);
      return;
    }
    const payload = {
      enabled: draft.enabled === true,
      items: draft.items
        .map((item, index) => ({
          id: item.id,
          quote: String(item.quote || '').trim(),
          authorName: String(item.authorName || '').trim(),
          role: String(item.role || '').trim() || null,
          company: String(item.company || '').trim() || null,
          photoUrl: item.photoUrl || null,
          sortOrder: index,
          enabled: item.enabled === true,
        }))
        .filter((item) => item.quote && item.authorName),
    };
    await onSave(payload);
  }, [draft, onSave, validationError]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">Show testimonials on storefront</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Curated quotes from your customers. Separate from Verified reviews. Leave empty or
              disabled to hide the section.
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            aria-label="Enable testimonials section"
          />
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Quote className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">No testimonials yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add up to {MAX_TESTIMONIALS} quotes. They appear on your shop home when enabled.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  Testimonial {index + 1}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`testimonial-enabled-${item.id}`} className="text-xs text-muted-foreground">
                      Visible
                    </Label>
                    <Switch
                      id={`testimonial-enabled-${item.id}`}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove testimonial"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`testimonial-quote-${item.id}`}>Quote</Label>
                <Textarea
                  id={`testimonial-quote-${item.id}`}
                  rows={3}
                  value={item.quote}
                  onChange={(event) => updateItem(item.id, { quote: event.target.value })}
                  placeholder="What did they say about your store?"
                  className="rounded-xl"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`testimonial-author-${item.id}`}>Author name</Label>
                  <Input
                    id={`testimonial-author-${item.id}`}
                    value={item.authorName}
                    onChange={(event) => updateItem(item.id, { authorName: event.target.value })}
                    placeholder="Ama Mensah"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`testimonial-role-${item.id}`}>Role (optional)</Label>
                  <Input
                    id={`testimonial-role-${item.id}`}
                    value={item.role}
                    onChange={(event) => updateItem(item.id, { role: event.target.value })}
                    placeholder="Customer"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`testimonial-company-${item.id}`}>Company (optional)</Label>
                  <Input
                    id={`testimonial-company-${item.id}`}
                    value={item.company}
                    onChange={(event) => updateItem(item.id, { company: event.target.value })}
                    placeholder="Acme Ltd"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photo (optional)</Label>
                  <div className="flex items-center gap-3">
                    {item.photoUrl ? (
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border">
                        <img
                          src={resolveUrl(item.photoUrl)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-muted-foreground"
                          onClick={() => updateItem(item.id, { photoUrl: null })}
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                    <input
                      id={`testimonial-photo-${item.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => handlePhotoUpload(item.id, event)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 rounded-xl"
                      disabled={uploadingId === item.id}
                      onClick={() => document.getElementById(`testimonial-photo-${item.id}`)?.click()}
                    >
                      {uploadingId === item.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {item.photoUrl ? 'Replace' : 'Upload'}
                    </Button>
                  </div>
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
          Add testimonial
          <span className="ml-2 text-muted-foreground">
            ({items.length}/{MAX_TESTIMONIALS})
          </span>
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || Boolean(validationError)}
          className="h-11 rounded-xl bg-[#166534] text-white hover:bg-[#14532d]"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save testimonials
        </Button>
      </div>
    </div>
  );
}
