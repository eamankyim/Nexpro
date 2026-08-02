import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ExternalLink,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import adminService from '../../services/adminService';
import OnlineStoreAdminChrome from '../../components/admin/OnlineStoreAdminChrome';
import { useDebounce } from '../../hooks/useDebounce';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import { STORE_TEMPLATES } from '../../constants/storeTemplates';
import { DEBOUNCE_DELAYS } from '../../constants';
import { buildOnlineStoreUrl } from '../../utils/storefrontUrl';
import { API_BASE_URL } from '../../services/api';
import { showError, showSuccess } from '../../utils/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const MAX_HERO_SLIDES = 5;
const EMPTY_PRODUCT_FORM = {
  title: '',
  publicPrice: '',
  compareAtPrice: '',
  shortDescription: '',
  quantityOnHand: '10',
  trackStock: true,
  images: [],
};

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL || ''}${url}`;
  return url;
};

const slugify = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

/**
 * Platform admin wizard to provision a tenant Online Store.
 */
const AdminOnlineStoreSetup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const canManage = !permissionsLoading && hasPermission('tenants.update');

  const tenantIdFromUrl = searchParams.get('tenantId') || '';

  const [tenantSearch, setTenantSearch] = useState('');
  const debouncedTenantSearch = useDebounce(tenantSearch, DEBOUNCE_DELAYS.SEARCH);
  const [tenantResults, setTenantResults] = useState([]);
  const [searchingTenants, setSearchingTenants] = useState(false);

  const [selectedTenantId, setSelectedTenantId] = useState(tenantIdFromUrl);
  const [loadingStore, setLoadingStore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seedingSamples, setSeedingSamples] = useState(false);
  const [clearingSamples, setClearingSamples] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [tenant, setTenant] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sampleCatalog, setSampleCatalog] = useState([]);
  const [sampleListings, setSampleListings] = useState([]);
  const [clientListings, setClientListings] = useState([]);
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);

  const [form, setForm] = useState({
    displayName: '',
    slug: '',
    description: '',
    contactPhone: '',
    whatsappNumber: '',
    contactEmail: '',
    templateId: 'classic',
    primaryColor: '#166534',
    secondaryColor: '',
    tertiaryColor: '',
    heroSlides: [],
    enabled: false,
    pickupEnabled: true,
    deliveryEnabled: false,
  });

  const [heroLibrary, setHeroLibrary] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);

  const seededSampleIds = useMemo(
    () => new Set(sampleListings.map((item) => item.sampleCatalogId).filter(Boolean)),
    [sampleListings],
  );

  const storeUrl = useMemo(
    () => (form.slug ? buildOnlineStoreUrl(form.slug, { preview: !form.enabled }) : ''),
    [form.enabled, form.slug],
  );

  const loadHeroLibrary = useCallback(async () => {
    try {
      const res = await adminService.getOnlineStoreHeroLibrary();
      const categories = Array.isArray(res?.data) ? res.data : [];
      setHeroLibrary(categories);
    } catch {
      setHeroLibrary([]);
    }
  }, []);

  const applyStorePayload = useCallback((data) => {
    const nextSettings = data?.settings || {};
    setTenant(data?.tenant || null);
    setSettings(nextSettings);
    setSampleCatalog(Array.isArray(data?.sampleCatalog) ? data.sampleCatalog : []);
    setSampleListings(Array.isArray(data?.sampleListings) ? data.sampleListings : []);
    setClientListings(Array.isArray(data?.clientListings) ? data.clientListings : []);
    setSelectedSampleIds([]);
    setForm({
      displayName: nextSettings.displayName || data?.tenant?.name || '',
      slug: nextSettings.slug || '',
      description: nextSettings.description || '',
      contactPhone: nextSettings.contactPhone || '',
      whatsappNumber: nextSettings.whatsappNumber || '',
      contactEmail: nextSettings.contactEmail || '',
      templateId: nextSettings.templateId || 'classic',
      primaryColor: nextSettings.primaryColor || '#166534',
      secondaryColor: nextSettings.secondaryColor || '',
      tertiaryColor: nextSettings.tertiaryColor || '',
      heroSlides: Array.isArray(nextSettings.heroSlides) ? nextSettings.heroSlides : [],
      enabled: Boolean(nextSettings.enabled),
      pickupEnabled: nextSettings.pickupEnabled !== false,
      deliveryEnabled: nextSettings.deliveryEnabled === true,
    });
  }, []);

  const loadTenantStore = useCallback(async (tenantId) => {
    if (!tenantId) return;
    setLoadingStore(true);
    try {
      const res = await adminService.getTenantOnlineStore(tenantId);
      if (res?.success) {
        applyStorePayload(res.data);
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to load tenant store');
      setTenant(null);
      setSettings(null);
    } finally {
      setLoadingStore(false);
    }
  }, [applyStorePayload]);

  useEffect(() => {
    loadHeroLibrary();
  }, [loadHeroLibrary]);

  useEffect(() => {
    if (tenantIdFromUrl && tenantIdFromUrl !== selectedTenantId) {
      setSelectedTenantId(tenantIdFromUrl);
    }
  }, [selectedTenantId, tenantIdFromUrl]);

  useEffect(() => {
    if (!selectedTenantId || !canManage) return;
    loadTenantStore(selectedTenantId);
  }, [canManage, loadTenantStore, selectedTenantId]);

  useEffect(() => {
    if (!canManage || !debouncedTenantSearch.trim()) {
      setTenantResults([]);
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      setSearchingTenants(true);
      try {
        const res = await adminService.getTenants({
          search: debouncedTenantSearch.trim(),
          limit: 12,
          page: 1,
        });
        if (!cancelled) {
          const rows = res?.data || res?.tenants || [];
          setTenantResults(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) setTenantResults([]);
      } finally {
        if (!cancelled) setSearchingTenants(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [canManage, debouncedTenantSearch]);

  const selectTenant = useCallback((nextTenant) => {
    const id = nextTenant?.id;
    if (!id) return;
    setSelectedTenantId(id);
    setTenantSearch('');
    setTenantResults([]);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tenantId', id);
      return next;
    });
  }, [setSearchParams]);

  const updateFormField = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'displayName' && !prev.slug) {
        next.slug = slugify(value);
      }
      return next;
    });
  }, []);

  const heroDesigns = useMemo(
    () => heroLibrary.flatMap((category) => (
      (category.designs || []).map((design) => ({
        ...design,
        categoryName: category.name,
      }))
    )),
    [heroLibrary],
  );

  const selectedHeroDesignIds = useMemo(
    () => new Set(
      (form.heroSlides || [])
        .filter((slide) => slide.type === 'library' && slide.designId)
        .map((slide) => slide.designId)
    ),
    [form.heroSlides],
  );

  const toggleHeroDesign = useCallback((design) => {
    setForm((prev) => {
      const slides = Array.isArray(prev.heroSlides) ? [...prev.heroSlides] : [];
      const existingIndex = slides.findIndex(
        (slide) => slide.type === 'library' && slide.designId === design.id
      );
      if (existingIndex >= 0) {
        slides.splice(existingIndex, 1);
        return { ...prev, heroSlides: slides };
      }
      if (slides.length >= MAX_HERO_SLIDES) {
        showError(`You can select up to ${MAX_HERO_SLIDES} hero slides`);
        return prev;
      }
      const colorway = (design.colorways || [])[0] || null;
      slides.push({
        type: 'library',
        designId: design.id,
        colorwayId: colorway?.id || null,
        imageUrl: colorway?.imageUrl || design.thumbnailUrl || null,
        sortOrder: slides.length,
      });
      return { ...prev, heroSlides: slides };
    });
  }, []);

  const handleSaveSettings = useCallback(async () => {
    if (!selectedTenantId) {
      showError('Select a tenant first');
      return;
    }
    if (!form.displayName.trim() || !form.slug.trim()) {
      showError('Store name and slug are required');
      return;
    }
    setSaving(true);
    try {
      const res = await adminService.upsertTenantOnlineStore(selectedTenantId, {
        displayName: form.displayName.trim(),
        slug: slugify(form.slug),
        description: form.description.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        whatsappNumber: form.whatsappNumber.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        templateId: form.templateId,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor || null,
        tertiaryColor: form.tertiaryColor || null,
        heroSlides: form.heroSlides,
        enabled: form.enabled,
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        markSetupComplete: form.enabled,
      });
      if (res?.success) {
        showSuccess('Store settings saved');
        await loadTenantStore(selectedTenantId);
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to save store settings');
    } finally {
      setSaving(false);
    }
  }, [form, loadTenantStore, selectedTenantId]);

  const toggleSampleId = useCallback((sampleId) => {
    if (seededSampleIds.has(sampleId)) return;
    setSelectedSampleIds((prev) => (
      prev.includes(sampleId)
        ? prev.filter((id) => id !== sampleId)
        : [...prev, sampleId]
    ));
  }, [seededSampleIds]);

  const handleSeedSamples = useCallback(async () => {
    if (!selectedTenantId) return;
    if (!settings?.id) {
      showError('Save store settings before seeding samples');
      return;
    }
    if (!selectedSampleIds.length) {
      showError('Select at least one sample product');
      return;
    }
    setSeedingSamples(true);
    try {
      const res = await adminService.seedTenantSampleProducts(selectedTenantId, selectedSampleIds);
      if (res?.success) {
        const createdCount = res.data?.created?.length || 0;
        showSuccess(createdCount ? `Seeded ${createdCount} sample product(s)` : 'No new samples to seed');
        await loadTenantStore(selectedTenantId);
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to seed sample products');
    } finally {
      setSeedingSamples(false);
    }
  }, [loadTenantStore, selectedSampleIds, selectedTenantId, settings?.id]);

  const handleClearSamples = useCallback(async () => {
    if (!selectedTenantId || !sampleListings.length) return;
    if (!window.confirm('Remove all sample products from this store?')) return;
    setClearingSamples(true);
    try {
      await adminService.clearTenantSampleProducts(selectedTenantId);
      showSuccess('Sample products cleared');
      await loadTenantStore(selectedTenantId);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to clear samples');
    } finally {
      setClearingSamples(false);
    }
  }, [loadTenantStore, sampleListings.length, selectedTenantId]);

  const handleUploadProductImages = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !selectedTenantId) return;
    setUploadingImages(true);
    try {
      const formData = new FormData();
      files.slice(0, 5).forEach((file) => formData.append('images', file));
      const res = await adminService.uploadTenantStoreProductImages(selectedTenantId, formData);
      const urls = res?.data?.imageUrls || [];
      setProductForm((prev) => ({
        ...prev,
        images: [...prev.images, ...urls].slice(0, 5),
      }));
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  }, [selectedTenantId]);

  const handleCreateProduct = useCallback(async () => {
    if (!selectedTenantId) return;
    if (!settings?.id) {
      showError('Save store settings before adding products');
      return;
    }
    if (!productForm.title.trim()) {
      showError('Product name is required');
      return;
    }
    if (!productForm.images.length) {
      showError('Add at least one product image');
      return;
    }
    setSavingProduct(true);
    try {
      const res = await adminService.createTenantStoreProduct(selectedTenantId, {
        title: productForm.title.trim(),
        publicPrice: Number.parseFloat(productForm.publicPrice) || 0,
        compareAtPrice: productForm.compareAtPrice === ''
          ? null
          : Number.parseFloat(productForm.compareAtPrice),
        shortDescription: productForm.shortDescription.trim() || null,
        images: productForm.images,
        quantityOnHand: Number.parseFloat(productForm.quantityOnHand) || 0,
        trackStock: productForm.trackStock,
      });
      if (res?.success) {
        showSuccess('Client product published');
        setProductForm(EMPTY_PRODUCT_FORM);
        await loadTenantStore(selectedTenantId);
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to create product');
    } finally {
      setSavingProduct(false);
    }
  }, [loadTenantStore, productForm, selectedTenantId, settings?.id]);

  const handleDeleteClientProduct = useCallback(async (listingId) => {
    if (!selectedTenantId || !listingId) return;
    if (!window.confirm('Remove this product from the store?')) return;
    try {
      await adminService.deleteTenantStoreProduct(selectedTenantId, listingId);
      showSuccess('Product removed');
      await loadTenantStore(selectedTenantId);
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to remove product');
    }
  }, [loadTenantStore, selectedTenantId]);

  if (permissionsLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <OnlineStoreAdminChrome section="setup">
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          You need the tenants.update permission to provision online stores.
        </p>
      </OnlineStoreAdminChrome>
    );
  }

  return (
    <OnlineStoreAdminChrome
      section="setup"
      actions={storeUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href={storeUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open storefront
          </a>
        </Button>
      ) : null}
    >
      <div className="space-y-8">
        <section className="rounded-xl border border-border p-4 space-y-3">
          <div>
            <h3 className="text-base font-semibold">1. Select tenant</h3>
            <p className="text-sm text-muted-foreground">
              The tenant must already have an account. Search by name or slug.
            </p>
          </div>
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tenants…"
              value={tenantSearch}
              onChange={(event) => setTenantSearch(event.target.value)}
            />
            {searchingTenants ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {tenantResults.length > 0 ? (
            <div className="max-w-xl divide-y divide-border rounded-lg border border-border">
              {tenantResults.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => selectTenant(row)}
                >
                  <span>
                    <span className="block font-medium">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.slug}</span>
                  </span>
                  <Badge variant="outline">{row.plan || 'trial'}</Badge>
                </button>
              ))}
            </div>
          ) : null}
          {tenant ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <span className="font-medium">{tenant.name}</span>
              <span className="text-emerald-700/80">· {tenant.businessType || 'business'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7"
                onClick={() => {
                  setSelectedTenantId('');
                  setTenant(null);
                  setSettings(null);
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('tenantId');
                    return next;
                  });
                }}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          ) : null}
        </section>

        {loadingStore ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedTenantId && tenant ? (
          <>
            <section className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">2. Store info</h3>
                <p className="text-sm text-muted-foreground">
                  Name, URL slug, contact, template, and brand colors.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Store name</Label>
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={(event) => updateFormField('displayName', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Store slug</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(event) => updateFormField('slug', slugify(event.target.value))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={form.description}
                    onChange={(event) => updateFormField('description', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone (optional)</Label>
                  <Input
                    id="contactPhone"
                    value={form.contactPhone}
                    onChange={(event) => updateFormField('contactPhone', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp (optional)</Label>
                  <Input
                    id="whatsappNumber"
                    value={form.whatsappNumber}
                    onChange={(event) => updateFormField('whatsappNumber', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email (optional)</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => updateFormField('contactEmail', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select
                    value={form.templateId}
                    onValueChange={(value) => updateFormField('templateId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORE_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary color</Label>
                  <Input
                    id="primaryColor"
                    type="color"
                    className="h-10 w-24 p-1"
                    value={form.primaryColor || '#166534'}
                    onChange={(event) => updateFormField('primaryColor', event.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">3. Heroes / banners</h3>
                <p className="text-sm text-muted-foreground">
                  Pick up to {MAX_HERO_SLIDES} designs from the platform hero library.
                </p>
              </div>
              {heroDesigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hero designs yet.{' '}
                  <Link className="text-brand underline" to="/admin/online-store/heroes">
                    Manage hero library
                  </Link>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {heroDesigns.map((design) => {
                    const selected = selectedHeroDesignIds.has(design.id);
                    const preview = design.thumbnailUrl
                      || design.colorways?.[0]?.imageUrl
                      || '';
                    return (
                      <button
                        key={design.id}
                        type="button"
                        onClick={() => toggleHeroDesign(design)}
                        className={cn(
                          'overflow-hidden rounded-lg border text-left transition-colors',
                          selected ? 'border-brand bg-brand/5' : 'border-border hover:border-brand/40'
                        )}
                      >
                        <div className="aspect-[16/6] bg-muted">
                          {preview ? (
                            <img
                              src={resolveMediaUrl(preview)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-sm font-medium">{design.name}</span>
                          {selected ? <Badge>Selected</Badge> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold">4. Sample products</h3>
                  <p className="text-sm text-muted-foreground">
                    Demo catalog only — shown with a Sample badge and not for sale.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!sampleListings.length || clearingSamples}
                    onClick={handleClearSamples}
                  >
                    {clearingSamples ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Clear samples
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#166534] text-white hover:bg-[#14532d]"
                    disabled={!selectedSampleIds.length || seedingSamples}
                    onClick={handleSeedSamples}
                  >
                    {seedingSamples ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Seed selected
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sampleCatalog.map((sample) => {
                  const seeded = seededSampleIds.has(sample.id);
                  const selected = selectedSampleIds.includes(sample.id);
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      disabled={seeded}
                      onClick={() => toggleSampleId(sample.id)}
                      className={cn(
                        'rounded-lg border p-3 text-left',
                        seeded
                          ? 'border-emerald-200 bg-emerald-50/60 opacity-80'
                          : selected
                            ? 'border-brand bg-brand/5'
                            : 'border-border hover:border-brand/40'
                      )}
                    >
                      <div className="mb-2 aspect-square overflow-hidden rounded-md bg-muted">
                        {sample.images?.[0] ? (
                          <img src={sample.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{sample.title}</p>
                          <p className="text-sm text-muted-foreground">GHS {sample.publicPrice}</p>
                        </div>
                        <Badge variant="outline">{seeded ? 'Seeded' : selected ? 'Selected' : 'Sample'}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">5. Client products</h3>
                <p className="text-sm text-muted-foreground">
                  Real products for this tenant — buyable on the storefront and visible in their inventory.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="productTitle">Name</Label>
                  <Input
                    id="productTitle"
                    value={productForm.title}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productPrice">Price</Label>
                  <Input
                    id="productPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.publicPrice}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, publicPrice: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productCompare">Compare-at (optional)</Label>
                  <Input
                    id="productCompare"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.compareAtPrice}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, compareAtPrice: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="productQty">Stock quantity</Label>
                  <Input
                    id="productQty"
                    type="number"
                    min="0"
                    value={productForm.quantityOnHand}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, quantityOnHand: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="productDesc">Short description (optional)</Label>
                  <Textarea
                    id="productDesc"
                    rows={2}
                    value={productForm.shortDescription}
                    onChange={(event) => setProductForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Images</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    {productForm.images.map((imageUrl) => (
                      <div key={imageUrl} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                        <img src={resolveMediaUrl(imageUrl)} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded bg-white/90 p-0.5"
                          onClick={() => setProductForm((prev) => ({
                            ...prev,
                            images: prev.images.filter((url) => url !== imageUrl),
                          }))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm">
                      {uploadingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUploadProductImages}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="bg-[#166534] text-white hover:bg-[#14532d]"
                  disabled={savingProduct}
                  onClick={handleCreateProduct}
                >
                  {savingProduct ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Publish product
                </Button>
              </div>
              {clientListings.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {clientListings.map((listing) => (
                    <div key={listing.id} className="flex items-center gap-3 p-3">
                      <div className="h-12 w-12 overflow-hidden rounded-md border border-border bg-muted">
                        {listing.images?.[0] ? (
                          <img
                            src={resolveMediaUrl(listing.images[0])}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{listing.title}</p>
                        <p className="text-sm text-muted-foreground">GHS {listing.publicPrice}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClientProduct(listing.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No client products yet.</p>
              )}
            </section>

            <section className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h3 className="text-base font-semibold">6. Publish</h3>
                <p className="text-sm text-muted-foreground">
                  Save settings and optionally enable the live storefront.
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(checked) => updateFormField('enabled', checked)}
                    id="enabled"
                  />
                  <Label htmlFor="enabled">Enable / go live</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {storeUrl ? (
                    <Button asChild variant="outline">
                      <a href={storeUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Preview
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="bg-[#166534] text-white hover:bg-[#14532d]"
                    disabled={saving}
                    onClick={handleSaveSettings}
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save store
                  </Button>
                </div>
              </div>
            </section>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Select a tenant to begin store setup.
          </p>
        )}
      </div>
    </OnlineStoreAdminChrome>
  );
};

export default AdminOnlineStoreSetup;
