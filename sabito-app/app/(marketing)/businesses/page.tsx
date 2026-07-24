import type { Metadata } from "next";
import { MarketplaceSection } from "@/components/sections/MarketplaceSection";

export const metadata: Metadata = {
  title: "Businesses",
  description:
    "Browse businesses with Partner Program enabled and apply to earn commission on Sabito App.",
};

export default function BusinessesPage() {
  return (
    <main>
      <div className="bg-mint border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-primary-dark">
            Partner businesses
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl">
            These businesses enabled Partner Program in ABS. Filter by category
            and apply to partner.
          </p>
        </div>
      </div>
      <MarketplaceSection showSeeAll={false} />
    </main>
  );
}
