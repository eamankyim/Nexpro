/**
 * Public page: customers leave a review (rating + optional comment) for a tenant — no login.
 * Routes: /feedback/:tenantSlug and /review/:tenantSlug (same page).
 * API: GET /api/public/feedback/branding/:tenantSlug (organization, businessType, reviewCategories?),
 *      POST /api/public/feedback (optional category → stored as metadata.category)
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Loader2,
  Star,
  ShoppingBag,
  MessageCircle,
  User,
  Mail,
  Phone,
  Send,
  Heart,
  Lock,
} from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import { PublicTrackingBrandShell } from '../components/PublicTrackingBrandShell';
import { DEFAULT_APP_PRIMARY_HEX, PUBLIC_PAGE_HERO_GREEN, PUBLIC_PAGE_MINT } from '../utils/colors';
import { getReviewCategoryOptions } from '../constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const SKIP_CATEGORY = '__none__';
const COMMENT_MAX = 500;

const feedbackFormSchema = z
  .object({
    rating: z.number().int().min(0).max(5),
    comment: z.union([z.literal(''), z.string().max(COMMENT_MAX)]).optional(),
    name: z.union([z.literal(''), z.string().max(255)]).optional(),
    email: z.union([z.literal(''), z.string().email()]).optional(),
    phone: z.union([z.literal(''), z.string().max(50)]).optional(),
    category: z.union([z.literal(''), z.string().max(120)]).optional(),
  })
  .refine((data) => data.rating >= 1, {
    path: ['rating'],
    message: 'Choose a star rating',
  });

function IconCircle({ children, className }) {
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border sm:h-11 sm:w-11',
        className
      )}
      style={{
        backgroundColor: PUBLIC_PAGE_MINT,
        borderColor: `${PUBLIC_PAGE_HERO_GREEN}33`,
        color: PUBLIC_PAGE_HERO_GREEN,
      }}
    >
      {children}
    </div>
  );
}

function FieldRow({ icon, iconLabel, children }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <IconCircle>
        <span className="sr-only">{iconLabel}</span>
        {icon}
      </IconCircle>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

export default function PublicFeedback() {
  const { tenantSlug } = useParams();
  const [branding, setBranding] = useState(null);
  const [reviewCategoryOptions, setReviewCategoryOptions] = useState(() => getReviewCategoryOptions(null, null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      rating: 0,
      comment: '',
      name: '',
      email: '',
      phone: '',
      category: '',
    },
  });

  const ratingValue = form.watch('rating');
  const commentValue = form.watch('comment') || '';
  const commentLen = commentValue.length;

  const apiPrefix = useMemo(() => {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/$/, '').replace(/\/api$/i, '') : '';
    const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin}/api/public/feedback`;
  }, []);

  useEffect(() => {
    if (!tenantSlug) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const url = `${apiPrefix}/branding/${encodeURIComponent(tenantSlug)}?_=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          if (res.status === 404) {
            console.warn('[PublicFeedback 404] branding request', {
              url,
              status: res.status,
              serverMessage: json?.message,
              serverPath: json?.path,
              hint: url.includes('/api/api/')
                ? 'URL has /api/api/ — fix VITE_API_URL (no trailing /api) or app proxy.'
                : 'Confirm this URL is the API base + /api/public/feedback/branding/:slug (not the SPA host if API is separate).',
            });
          }
          setError(json?.message || 'This review page is not available.');
          return;
        }
        setBranding(json.data?.organization || null);
        setReviewCategoryOptions(
          getReviewCategoryOptions(json.data?.businessType, json.data?.reviewCategories)
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            e?.message === 'Failed to fetch'
              ? 'Cannot reach the server. Check your connection.'
              : 'Something went wrong'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, apiPrefix]);

  const primaryColor = branding?.primaryColor || DEFAULT_APP_PRIMARY_HEX;
  const organizationName = branding?.name || 'Business';

  const onSubmit = async (values) => {
    if (!tenantSlug || values.rating < 1) {
      form.setError('rating', { message: 'Choose a star rating' });
      return;
    }
    setSubmitting(true);
    try {
      const url = apiPrefix;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          tenantSlug,
          rating: values.rating,
          comment: values.comment?.trim() || undefined,
          name: values.name?.trim() || undefined,
          email: values.email?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          category: values.category?.trim() || undefined,
          source: 'direct',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 404) {
          console.warn('[PublicFeedback 404] submit request', {
            url,
            status: res.status,
            serverMessage: json?.message,
            serverPath: json?.path,
            hint: url.includes('/api/api/') ? 'URL has /api/api/ — fix VITE_API_URL (no trailing /api).' : undefined,
          });
        }
        throw new Error(json?.message || 'Unable to submit.');
      }
      setSubmitted(true);
    } catch (e) {
      form.setError('root', { message: e?.message || 'Unable to submit.' });
    } finally {
      setSubmitting(false);
    }
  };

  const preFooter = (
    <>
      <div
        className="rounded-2xl border border-[#006437]/15 px-4 py-4 sm:px-5"
        style={{ backgroundColor: PUBLIC_PAGE_MINT }}
      >
        <div className="flex gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white sm:h-11 sm:w-11"
            style={{ backgroundColor: PUBLIC_PAGE_HERO_GREEN }}
          >
            <Heart className="h-5 w-5 shrink-0" aria-hidden fill="currentColor" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold" style={{ color: PUBLIC_PAGE_HERO_GREEN }}>
              Your feedback matters 💚
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Thank you for helping us improve.</p>
          </div>
        </div>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Your feedback is private and secure
      </p>
    </>
  );

  if (loading) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Loading"
        heroTitle="Loading"
        heroTagline="One moment…"
        logoSize="md"
      >
        <div className="flex justify-center py-14">
          <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (error) {
    return (
      <PublicTrackingBrandShell
        variant="neutral"
        organizationName="Reviews"
        heroTitle="Reviews"
        heroTagline="This link is not available."
        logoSize="md"
      >
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  if (submitted) {
    return (
      <PublicTrackingBrandShell
        variant="brand"
        organizationName={organizationName}
        logoUrl={branding?.logoUrl}
        heroTitle="Thank you"
        heroTagline="We appreciate you taking the time."
      >
        <div className="p-6 text-center sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your review has been submitted successfully.
          </p>
        </div>
      </PublicTrackingBrandShell>
    );
  }

  return (
    <PublicTrackingBrandShell
      variant="brand"
      primaryColor={primaryColor}
      organizationName={organizationName}
      logoUrl={branding?.logoUrl}
      heroTitle="How was your experience?"
      heroTagline="We'd love your feedback."
      preFooter={preFooter}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 sm:p-6">
          <div className="space-y-6 sm:space-y-7">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow
                    icon={<Star className="h-5 w-5" strokeWidth={2} />}
                    iconLabel="Rating"
                  >
                    <div>
                      <FormLabel className="text-base font-semibold text-foreground">Rate your experience</FormLabel>
                      <p className="mt-0.5 text-xs text-muted-foreground">Select a rating below</p>
                    </div>
                    <FormControl>
                      <div className="flex flex-wrap items-center gap-1 pt-1" role="group" aria-label="Star rating 1 to 5">
                        {[1, 2, 3, 4, 5].map((n) => {
                          const active = n <= (ratingValue || 0);
                          return (
                            <button
                              key={n}
                              type="button"
                              className="rounded-md border border-transparent p-0.5 transition-colors hover:bg-muted/60"
                              onClick={() => field.onChange(n)}
                              aria-label={`${n} star${n === 1 ? '' : 's'}`}
                              aria-pressed={ratingValue === n}
                            >
                              <Star
                                className={cn(
                                  'h-9 w-9 sm:h-10 sm:w-10',
                                  active
                                    ? 'fill-[#006437] text-[#006437]'
                                    : 'fill-transparent text-[#006437] opacity-[0.38]'
                                )}
                                strokeWidth={active ? 0 : 1.75}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow icon={<ShoppingBag className="h-5 w-5" strokeWidth={2} />} iconLabel="Service category">
                    <FormLabel className="text-base font-semibold text-foreground">Service category (optional)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === SKIP_CATEGORY ? '' : v)}
                      value={field.value ? field.value : SKIP_CATEGORY}
                    >
                      <FormControl>
                        <SelectTrigger className="mt-1 rounded-lg border-border">
                          <SelectValue placeholder="No preference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={SKIP_CATEGORY}>No preference</SelectItem>
                        {reviewCategoryOptions.map((opt, idx) => (
                          <SelectItem key={`${opt}-${idx}`} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow icon={<MessageCircle className="h-5 w-5" strokeWidth={2} />} iconLabel="Comments">
                    <FormLabel className="text-base font-semibold text-foreground">Tell us more (optional)</FormLabel>
                    <FormControl>
                      <div className="relative mt-1">
                        <Textarea
                          placeholder="Share your experience or suggestions"
                          rows={4}
                          className="min-h-[120px] resize-y rounded-lg border-border pb-7"
                          maxLength={COMMENT_MAX}
                          {...field}
                        />
                        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-muted-foreground tabular-nums">
                          {commentLen}/{COMMENT_MAX}
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow icon={<User className="h-5 w-5" strokeWidth={2} />} iconLabel="Name">
                    <FormLabel className="text-base font-semibold text-foreground">Name (optional)</FormLabel>
                    <FormControl>
                      <Input className="mt-1 rounded-lg border-border" placeholder="Enter your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow icon={<Mail className="h-5 w-5" strokeWidth={2} />} iconLabel="Email">
                    <FormLabel className="text-base font-semibold text-foreground">Email (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        className="mt-1 rounded-lg border-border"
                        placeholder="Enter your email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FieldRow icon={<Phone className="h-5 w-5" strokeWidth={2} />} iconLabel="Phone">
                    <FormLabel className="text-base font-semibold text-foreground">Phone (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        className="mt-1 rounded-lg border-border"
                        placeholder="Enter your phone number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FieldRow>
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-lg border-0 text-base font-semibold text-white hover:opacity-95"
              style={{ backgroundColor: PUBLIC_PAGE_HERO_GREEN }}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              Send Feedback
            </Button>
          </div>
        </form>
      </Form>
    </PublicTrackingBrandShell>
  );
}
