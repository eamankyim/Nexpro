import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  MousePointerClick,
} from 'lucide-react';

import {
  DEFAULT_PRODUCT_CARD_ACTIONS,
  getProductCardActionMeta,
  MAX_PRODUCT_CARD_ACTIONS,
  PRODUCT_CARD_ACTIONS,
  sanitizeProductCardActions,
} from '../../utils/productCardActions';
import { showError } from '../../utils/toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/**
 * Merchant picker for Online Store product card CTAs (max 2, ordered).
 * @param {{
 *   value?: string[] | null,
 *   saving?: boolean,
 *   whatsappNumber?: string | null,
 *   contactPhone?: string | null,
 *   accentColor?: string,
 *   onSave: (actions: string[]) => void | Promise<void>,
 * }} props
 */
const StoreProductCardActionsPanel = ({
  value = null,
  saving = false,
  whatsappNumber = null,
  contactPhone = null,
  accentColor = '#166534',
  onSave,
}) => {
  const [draft, setDraft] = useState(() => sanitizeProductCardActions(value));

  useEffect(() => {
    setDraft(sanitizeProductCardActions(value));
  }, [value]);

  const hasWhatsAppPhone = Boolean(
    String(whatsappNumber || '').trim() || String(contactPhone || '').trim(),
  );

  const needsPhoneWarning = useMemo(
    () => draft.some((id) => id === 'whatsapp' || id === 'contact_for_price') && !hasWhatsAppPhone,
    [draft, hasWhatsAppPhone],
  );

  const toggleAction = useCallback((id) => {
    setDraft((current) => {
      if (current.includes(id)) {
        const next = current.filter((entry) => entry !== id);
        return next.length ? next : [...DEFAULT_PRODUCT_CARD_ACTIONS];
      }
      if (current.length >= MAX_PRODUCT_CARD_ACTIONS) {
        showError(`Choose up to ${MAX_PRODUCT_CARD_ACTIONS} buttons`);
        return current;
      }
      return [...current, id];
    });
  }, []);

  const moveAction = useCallback((index, direction) => {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const next = sanitizeProductCardActions(draft);
    await onSave(next);
  }, [draft, onSave]);

  const accent = String(accentColor || '#166534').trim() || '#166534';

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-semibold text-slate-900">Product buttons</Label>
        <p className="mt-1 text-sm text-slate-500">
          Choose up to {MAX_PRODUCT_CARD_ACTIONS}. Last button is the primary (filled) action.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {PRODUCT_CARD_ACTIONS.map((action) => {
          const selected = draft.includes(action.id);
          const order = selected ? draft.indexOf(action.id) + 1 : null;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => toggleAction(action.id)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                selected
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
              aria-pressed={selected}
            >
              <span>{action.label}</span>
              {order != null ? (
                <span className="rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  {order}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {draft.length > 1 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order</p>
          <ul className="space-y-2">
            {draft.map((id, index) => {
              const meta = getProductCardActionMeta(id);
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {index + 1}. {meta?.label || id}
                    {index === draft.length - 1 ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">(primary)</span>
                    ) : null}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      onClick={() => moveAction(index, -1)}
                      aria-label={`Move ${meta?.label || id} up`}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === draft.length - 1}
                      onClick={() => moveAction(index, 1)}
                      aria-label={`Move ${meta?.label || id} down`}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {needsPhoneWarning ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription>
            Add a WhatsApp or contact phone in Store info so shoppers can reach you.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          Preview
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 h-16 rounded-xl border border-slate-200 bg-white" />
          <p className="text-sm font-bold text-slate-900">Sample product</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>GHS 120.00</p>
          <div className={`mt-3 grid gap-2 ${draft.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {draft.map((id, index) => {
              const meta = getProductCardActionMeta(id);
              const isPrimary = index === draft.length - 1;
              return (
                <span
                  key={id}
                  className={`inline-flex h-9 items-center justify-center rounded-full px-2 text-xs font-bold ${
                    isPrimary ? 'text-white' : 'border bg-white'
                  }`}
                  style={isPrimary
                    ? { backgroundColor: accent }
                    : { borderColor: `${accent}47`, color: accent }}
                >
                  {meta?.shortLabel || id}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          disabled={saving}
          className="bg-[#166534] text-white hover:bg-[#14532d]"
          onClick={handleSave}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save buttons
        </Button>
      </div>
    </div>
  );
};

export default StoreProductCardActionsPanel;
