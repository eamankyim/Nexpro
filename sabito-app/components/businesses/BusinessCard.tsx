import Link from "next/link";
import type { MarketplaceBusiness } from "@/lib/api";

export function BusinessCard({ business }: { business: MarketplaceBusiness }) {
  return (
    <Link
      href={`/businesses/${business.slug}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-[var(--sabito-teal)]"
    >
      <div className="aspect-[4/3] bg-[var(--sabito-mint)]">
        {business.logoUrl || business.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logoUrl || business.imageUrl || ""}
            alt={business.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-bold text-[var(--sabito-teal)]/40">
            {business.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="text-xs font-medium text-[var(--sabito-teal)]">{business.category}</p>
        <h3 className="font-semibold text-slate-900 group-hover:text-[var(--sabito-teal-dark)]">
          {business.name}
        </h3>
        <p className="text-sm text-slate-500">{business.location}</p>
        <p className="text-sm font-semibold text-slate-900">
          Commission from {business.commissionFrom}%
        </p>
        {business.applicationsOpen === false ? (
          <p className="text-xs text-[var(--sabito-orange)]">Applications full</p>
        ) : null}
      </div>
    </Link>
  );
}
