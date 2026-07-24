import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { MarketplaceBusiness } from "@/lib/mock-data";

export function BusinessCard({ business }: { business: MarketplaceBusiness }) {
  return (
    <Link
      href={`/businesses/${business.slug}`}
      className="group block rounded-2xl border border-border bg-white overflow-hidden hover:border-primary/40 transition-colors"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mint">
        <Image
          src={business.imageUrl}
          alt={business.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            <Star className="h-3 w-3 fill-white" aria-hidden />
            {business.rating.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">{business.category}</span>
        </div>
        <h3 className="font-semibold text-foreground leading-snug group-hover:text-primary">
          {business.name}
        </h3>
        <p className="text-sm text-muted-foreground">{business.location}</p>
        <p className="text-sm text-muted-foreground pt-1">
          Commission from{" "}
          <span className="font-semibold text-foreground">
            {business.commissionFrom}%
          </span>
        </p>
      </div>
    </Link>
  );
}
