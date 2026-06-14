import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ImageIcon, Loader2, UploadCloud } from 'lucide-react';
import storeService from '../services/storeService';
import { resolveImageUrl } from '../utils/fileUtils';
import { getErrorMessage, showError, showSuccess } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const serviceSchema = z.object({
  title: z.string().trim().min(1, 'Service title is required'),
  shortDescription: z.string().trim().min(1, 'Short description is required').max(280),
  description: z.string().optional(),
  category: z.string().trim().min(1, 'Category is required'),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  ctaType: z.enum(['request_quote', 'book_service', 'fixed_price']),
  priceType: z.enum(['starting_from', 'fixed', 'quote_only']),
  startingPrice: z.preprocess(
    (value) => (value === '' || value === null ? '' : value),
    z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  ),
  compareAtPrice: z.preprocess(
    (value) => (value === '' || value === null ? '' : value),
    z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  ),
  durationMinutes: z.preprocess(
    (value) => (value === '' || value === null ? '' : value),
    z.union([z.coerce.number().int().min(1), z.literal('')]).optional(),
  ),
  turnaroundLabel: z.string().optional(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  status: z.enum(['draft', 'published', 'hidden']),
  images: z.array(z.string()).max(5),
}).superRefine((data, ctx) => {
  if (data.status === 'published' && data.images.length < 1) {
    ctx.addIssue({ code: 'custom', path: ['images'], message: 'Published services need 1 to 5 images' });
  }
  if (data.priceType !== 'quote_only' && data.status === 'published' && Number(data.startingPrice || 0) <= 0) {
    ctx.addIssue({ code: 'custom', path: ['startingPrice'], message: 'Starting price is required for published services' });
  }
});

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const minutesToHoursInput = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  return Number((minutes / 60).toFixed(2));
};

const hoursInputToMinutes = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return '';
  return Math.round(hours * 60);
};

const unwrapData = (response) => response?.data?.data || response?.data || response;

const StoreServiceEditor = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = serviceId === 'new';

  const { data: listingResponse, isLoading } = useQuery({
    queryKey: ['store', 'service-listing', serviceId],
    queryFn: async () => {
      const response = await storeService.getServiceListings({ limit: 100 });
      const body = response?.data ? response : response || {};
      const listings = Array.isArray(body.data) ? body.data : [];
      return listings.find((item) => item.id === serviceId) || null;
    },
    enabled: !isNew && Boolean(serviceId),
  });

  const listing = useMemo(() => unwrapData(listingResponse), [listingResponse]);

  const form = useForm({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: '',
      shortDescription: '',
      description: '',
      category: '',
      slug: 'service',
      ctaType: 'request_quote',
      priceType: 'starting_from',
      startingPrice: '',
      compareAtPrice: '',
      durationMinutes: '',
      turnaroundLabel: '',
      pickupEnabled: true,
      deliveryEnabled: false,
      status: 'draft',
      images: [],
    },
  });

  useEffect(() => {
    if (!listing) return;
    form.reset({
      title: listing.title || '',
      shortDescription: listing.shortDescription || '',
      description: listing.description || '',
      category: listing.category || '',
      slug: listing.slug || normalizeSlug(listing.title),
      ctaType: listing.ctaType || 'request_quote',
      priceType: listing.priceType || 'starting_from',
      startingPrice: listing.startingPrice ?? '',
      compareAtPrice: listing.compareAtPrice ?? '',
      durationMinutes: listing.durationMinutes ?? '',
      turnaroundLabel: listing.turnaroundLabel || '',
      pickupEnabled: listing.pickupEnabled !== false,
      deliveryEnabled: listing.deliveryEnabled === true,
      status: listing.status || 'draft',
      images: Array.isArray(listing.images) ? listing.images.slice(0, 5) : [],
    });
  }, [listing, form]);

  const images = form.watch('images');
  const priceType = form.watch('priceType');

  const handleUploadImages = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const result = await storeService.uploadServiceListingImages(files);
      const imageUrls = result?.data?.imageUrls || result?.imageUrls || [];
      const nextImages = [...new Set([...(form.getValues('images') || []), ...imageUrls])].slice(0, 5);
      form.setValue('images', nextImages, { shouldValidate: true });
      showSuccess('Images uploaded');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to upload images'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [form]);

  const handleSubmit = useCallback(async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        startingPrice: values.priceType === 'quote_only' ? null : values.startingPrice,
        compareAtPrice: values.compareAtPrice === '' ? null : values.compareAtPrice,
        durationMinutes: values.durationMinutes === '' ? null : values.durationMinutes,
        turnaroundLabel: values.turnaroundLabel || null,
      };
      if (isNew) {
        const response = await storeService.createServiceListing(payload);
        const created = unwrapData(response);
        showSuccess('Service created');
        navigate(`/store/services/${created.id}/edit`, { replace: true });
      } else {
        await storeService.updateServiceListing(serviceId, payload);
        showSuccess('Service updated');
      }
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to save service'));
    } finally {
      setSaving(false);
    }
  }, [form, isNew, navigate, serviceId]);

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading service...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate('/store/services')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{isNew ? 'New studio service' : 'Edit studio service'}</h1>
          <p className="text-muted-foreground">Prepare a service for your public Sabito studio storefront.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service title</FormLabel>
                    <FormControl><Input {...field} onChange={(event) => {
                      field.onChange(event);
                      if (isNew) form.setValue('slug', normalizeSlug(event.target.value));
                    }}
                    />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shortDescription" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short description</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full description (optional)</FormLabel>
                    <FormControl><Textarea rows={5} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Haircuts, Printing, Repairs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="slug" render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL slug</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing and booking</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="ctaType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer action</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="request_quote">Request quote</SelectItem>
                        <SelectItem value="book_service">Book service</SelectItem>
                        <SelectItem value="fixed_price">Fixed price</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="priceType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price display</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="starting_from">Starting from</SelectItem>
                        <SelectItem value="fixed">Fixed price</SelectItem>
                        <SelectItem value="quote_only">Quote only</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                {priceType !== 'quote_only' && (
                  <>
                    <FormField control={form.control} name="startingPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{priceType === 'fixed' ? 'Price' : 'Starting price'}</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="compareAtPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compare-at price (optional)</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}
                <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration in hours (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={minutesToHoursInput(field.value)}
                        onChange={(event) => field.onChange(hoursInputToMinutes(event.target.value))}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        placeholder="e.g. 1.5"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="turnaroundLabel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Turnaround label (optional)</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 2-3 business days" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image) => (
                    <img key={image} src={resolveImageUrl(image)} alt="" className="h-24 w-full rounded-lg border border-border object-cover" />
                  ))}
                  {images.length === 0 && (
                    <div className="col-span-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Add service images
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUploadImages} />
                <Button type="button" variant="outline" disabled={uploading || images.length >= 5} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                  Upload images
                </Button>
                <FormField control={form.control} name="images" render={() => <FormMessage />} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibility</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Published services appear on your Sabito studio storefront.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isNew ? 'Create service' : 'Save changes'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default StoreServiceEditor;
