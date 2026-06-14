import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Plus, Trash2, X } from 'lucide-react';

import AccountLayout from '../components/storefront/AccountLayout';
import { EmptyState } from '../components/storefront/StorefrontLayout';
import storeService from '../services/storeService';
import { DEFAULT_DELIVERY_COUNTRY, GHANA_REGIONS } from '../constants';
import { showError, showSuccess } from '../utils/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = {
  id: null,
  label: '',
  recipientName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  country: DEFAULT_DELIVERY_COUNTRY,
  deliveryNotes: '',
  isDefault: false,
};

const EMPTY_REGION_VALUE = 'none';

const buildDeliveryAddressPayload = (address = {}) => ({
  ...address,
  country: DEFAULT_DELIVERY_COUNTRY,
});

const formatDeliveryAddress = (address = {}) => (
  [address.line1, address.line2, address.city, address.region].filter(Boolean).join(', ')
);

const ShopperAddressesPage = () => {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const loadAddresses = useCallback(async () => {
    const response = await storeService.getDeliveryAddresses();
    setAddresses(response?.data?.addresses || response?.addresses || []);
  }, [form.id]);

  useEffect(() => {
    let mounted = true;
    loadAddresses()
      .catch((error) => {
        if (mounted) showError(error, 'Could not load delivery addresses.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadAddresses]);

  useEffect(() => {
    if (!isAddressModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAddressModalOpen(false);
        setForm(emptyForm);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddressModalOpen]);

  const handleOpenNewAddress = useCallback(() => {
    setForm(emptyForm);
    setIsAddressModalOpen(true);
  }, []);

  const handleCloseAddressModal = useCallback(() => {
    setForm(emptyForm);
    setIsAddressModalOpen(false);
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = buildDeliveryAddressPayload(form);
      const response = form.id
        ? await storeService.updateDeliveryAddress(form.id, payload)
        : await storeService.createDeliveryAddress(payload);
      setAddresses(response?.data?.addresses || response?.addresses || []);
      setForm(emptyForm);
      setIsAddressModalOpen(false);
      showSuccess(form.id ? 'Delivery address updated.' : 'Delivery address saved.');
    } catch (error) {
      showError(error, 'Could not save delivery address.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form]);

  const handleEdit = useCallback((address) => {
    setForm(buildDeliveryAddressPayload({ ...emptyForm, ...address }));
    setIsAddressModalOpen(true);
  }, []);

  const handleSetDefault = useCallback(async (addressId) => {
    try {
      const response = await storeService.setDefaultDeliveryAddress(addressId);
      setAddresses(response?.data?.addresses || response?.addresses || []);
      showSuccess('Default delivery address updated.');
    } catch (error) {
      showError(error, 'Could not update default address.');
    }
  }, []);

  const handleDelete = useCallback(async (addressId) => {
    try {
      const response = await storeService.deleteDeliveryAddress(addressId);
      setAddresses(response?.data?.addresses || response?.addresses || []);
      setForm((current) => (current.id === addressId ? emptyForm : current));
      setIsAddressModalOpen((current) => (form.id === addressId ? false : current));
      showSuccess('Delivery address deleted.');
    } catch (error) {
      showError(error, 'Could not delete delivery address.');
    }
  }, [form.id]);

  return (
    <AccountLayout
      title="Delivery addresses"
      description="Save delivery locations and choose a default address for future checkout."
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-[2rem]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Address book</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Saved delivery addresses</h2>
            </div>
            <Button type="button" className="rounded-full bg-green-700 hover:bg-green-800" onClick={handleOpenNewAddress}>
              <Plus className="mr-2 h-4 w-4" />
              New address
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-6 flex min-h-56 items-center justify-center text-sm font-semibold text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading addresses...
            </div>
          ) : addresses.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={MapPin}
                title="No saved addresses"
                description="Add a delivery address to make future checkout faster."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {addresses.map((address) => (
                <article key={address.id} className="rounded-2xl border border-slate-200 p-4 sm:rounded-3xl">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-950">{address.label || 'Delivery address'}</h3>
                        {address.isDefault ? <Badge className="border-0 bg-green-700 text-white hover:bg-green-700">Default</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-700">{address.recipientName} - {address.phone}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {formatDeliveryAddress(address)}
                      </p>
                      {address.deliveryNotes ? <p className="mt-2 text-sm text-slate-500">{address.deliveryNotes}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => handleEdit(address)}>
                        Edit
                      </Button>
                      {!address.isDefault ? (
                        <Button type="button" variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" onClick={() => handleSetDefault(address.id)}>
                          Make default
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" className="rounded-full border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(address.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isAddressModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-3 py-4 sm:items-center sm:px-6" role="dialog" aria-modal="true" aria-labelledby="delivery-address-modal-title">
          <form onSubmit={handleSubmit} className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-green-200 bg-white p-5 sm:rounded-[2rem] sm:p-6">
            <button
              type="button"
              onClick={handleCloseAddressModal}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Close delivery address form"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-3 pr-12">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-800">
                <Plus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">{form.id ? 'Edit address' : 'New address'}</p>
                <h2 id="delivery-address-modal-title" className="mt-1 text-xl font-black text-slate-950">{form.id ? 'Update delivery details' : 'Add delivery details'}</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <Field label="Label (optional)" value={form.label} onChange={(value) => setForm((current) => ({ ...current, label: value }))} placeholder="Home, work, campus..." />
              <Field label="Recipient name" value={form.recipientName} onChange={(value) => setForm((current) => ({ ...current, recipientName: value }))} required />
              <Field label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} required />
              <Field label="Address line 1" value={form.line1} onChange={(value) => setForm((current) => ({ ...current, line1: value }))} required />
              <Field label="Address line 2 (optional)" value={form.line2} onChange={(value) => setForm((current) => ({ ...current, line2: value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} required />
                <RegionSelect value={form.region} onChange={(value) => setForm((current) => ({ ...current, region: value }))} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-slate-700" htmlFor="deliveryNotes">Delivery notes (optional)</label>
                <textarea
                  id="deliveryNotes"
                  value={form.deliveryNotes}
                  onChange={(event) => setForm((current) => ({ ...current, deliveryNotes: event.target.value }))}
                  className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-400"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-green-700"
                />
                Make this my default delivery address
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-full border-slate-200 text-slate-700 hover:bg-slate-50" onClick={handleCloseAddressModal}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-full bg-green-700 hover:bg-green-800" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {form.id ? 'Update address' : 'Save address'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </AccountLayout>
  );
};

const RegionSelect = ({ value, onChange }) => (
  <div className="grid gap-2">
    <label className="text-sm font-semibold text-slate-700" htmlFor="address-region-optional">Region (optional)</label>
    <Select value={value || EMPTY_REGION_VALUE} onValueChange={(nextValue) => onChange(nextValue === EMPTY_REGION_VALUE ? '' : nextValue)}>
      <SelectTrigger id="address-region-optional" className="min-h-10 rounded-2xl border-slate-200 bg-white focus:ring-green-700">
        <SelectValue placeholder="Select region" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_REGION_VALUE}>No region selected</SelectItem>
        {GHANA_REGIONS.map((region) => (
          <SelectItem key={region} value={region}>{region}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const Field = ({ label, value, onChange, required = false, placeholder = '' }) => {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-slate-700" htmlFor={id}>{label}</label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
};

export default ShopperAddressesPage;
