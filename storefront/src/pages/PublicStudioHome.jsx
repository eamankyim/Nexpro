import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Mail, MessageCircle, Phone, Scissors } from 'lucide-react';

import storeService from '../services/storeService';
import {
  BuyerLayoutFrame,
  Breadcrumbs,
  ServiceCard,
  StoreLogo,
  StorefrontFooter,
  StorefrontHeader,
  unwrapData,
} from '../components/storefront/StorefrontLayout';
import { ReviewList, ReviewSummaryLine } from '../components/storefront/VerifiedReviewSection';
import { resolveStoreBannerImageUrl } from '../utils/fileUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const PublicStudioHome = () => {
  const { studioSlug } = useParams();

  const studioQuery = useQuery({
    queryKey: ['marketplace', 'studio-home', studioSlug],
    queryFn: () => storeService.getMarketplaceStudioHome(studioSlug),
    enabled: Boolean(studioSlug),
    retry: false,
  });

  const payload = useMemo(() => unwrapData(studioQuery.data) || {}, [studioQuery.data]);
  const studio = payload.studio;
  const services = payload.services || payload.featuredServices || [];
  const reviews = payload.reviews || studio?.reviewSummary?.reviews || [];

  if (studioQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading studio...
      </div>
    );
  }

  if (studioQuery.isError || !studio) {
    return (
      <div className="min-h-screen bg-[#f4f7f2] p-8 text-center">
        <h1 className="text-2xl font-semibold">Studio not found</h1>
        <p className="mt-2 text-muted-foreground">This studio is not available on Sabito yet.</p>
        <Button className="mt-4" asChild><Link to="/studios">Browse studios</Link></Button>
      </div>
    );
  }

  const bannerUrl = resolveStoreBannerImageUrl(studio);

  return (
    <BuyerLayoutFrame>
      <StorefrontHeader activePath="/studios" />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Breadcrumbs items={[{ label: 'Studios', to: '/studios' }, { label: studio.displayName }]} />

        <section className="overflow-hidden rounded-3xl border border-border bg-white">
          <div className="relative min-h-[220px] bg-gradient-to-br from-green-900 via-green-800 to-emerald-500 p-6 sm:p-8">
            {bannerUrl ? <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
            {bannerUrl ? <div className="absolute inset-0 bg-black/25" /> : null}
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white">
                  <StoreLogo store={studio} />
                </div>
                <div className="text-white">
                  <Badge className="mb-2 border-0 bg-white/15 text-white hover:bg-white/15">{studio.category}</Badge>
                  <h1 className="text-3xl font-bold">{studio.displayName}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/90">{studio.description}</p>
                </div>
              </div>
              <ReviewSummaryLine summary={studio.reviewSummary} />
            </div>
          </div>

          <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
            {studio.contactPhone ? (
              <Card><CardContent className="flex items-center gap-3 p-4 text-sm"><Phone className="h-4 w-4 text-green-700" />{studio.contactPhone}</CardContent></Card>
            ) : null}
            {studio.contactEmail ? (
              <Card><CardContent className="flex items-center gap-3 p-4 text-sm"><Mail className="h-4 w-4 text-green-700" />{studio.contactEmail}</CardContent></Card>
            ) : null}
            {studio.whatsappNumber ? (
              <Card><CardContent className="flex items-center gap-3 p-4 text-sm"><MessageCircle className="h-4 w-4 text-green-700" />WhatsApp available</CardContent></Card>
            ) : null}
          </CardContent>
        </section>

        <section className="mt-8 space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Services</p>
            <h2 className="mt-1 text-2xl font-semibold">What this studio offers</h2>
          </div>
          {services.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <ServiceCard key={service.id} service={{ ...service, studio }} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              <Scissors className="mx-auto mb-3 h-8 w-8" />
              No published services yet.
            </div>
          )}
        </section>

        {reviews.length ? (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Customer reviews</h2>
            <div className="mt-4"><ReviewList reviews={reviews} /></div>
          </section>
        ) : null}
      </div>
      <StorefrontFooter />
    </BuyerLayoutFrame>
  );
};

export default PublicStudioHome;
