"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryFilter } from "@/components/sections/CategoryFilter";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { Button } from "@/components/ui/button";
import {
  filterBusinesses,
  type BusinessCategory,
} from "@/lib/mock-data";

export function MarketplaceSection({
  limit,
  showSeeAll = true,
}: {
  limit?: number;
  showSeeAll?: boolean;
}) {
  const [category, setCategory] = useState<BusinessCategory>("All categories");

  const businesses = useMemo(() => {
    const list = filterBusinesses(category);
    return typeof limit === "number" ? list.slice(0, limit) : list;
  }, [category, limit]);

  return (
    <section id="businesses" className="bg-white">
      <CategoryFilter active={category} onChange={setCategory} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
        {businesses.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            No partner businesses in this category yet.
          </p>
        )}
        {showSeeAll && (
          <div className="mt-10 flex justify-center">
            <Link href="/businesses">
              <Button size="lg">
                See all businesses
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
