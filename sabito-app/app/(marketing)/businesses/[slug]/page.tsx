import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESSES, getBusinessBySlug } from "@/lib/mock-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return BUSINESSES.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = getBusinessBySlug(slug);
  if (!business) return { title: "Business not found" };
  return {
    title: business.name,
    description: business.description,
  };
}

export default async function BusinessDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const business = getBusinessBySlug(slug);
  if (!business) notFound();

  return (
    <main className="bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <Link
          href="/businesses"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          All businesses
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-mint">
            <Image
              src={business.imageUrl}
              alt={business.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                <Star className="h-3.5 w-3.5 fill-white" aria-hidden />
                {business.rating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                {business.category}
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {business.name}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              {business.location}
            </p>
            <p className="mt-6 text-foreground leading-relaxed">
              {business.description}
            </p>
            <p className="mt-6 text-lg">
              Commission from{" "}
              <span className="font-bold text-primary">
                {business.commissionFrom}%
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg">Apply to partner</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Sign in to apply
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Application API is stubbed in v1 — create an account to get ready.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
