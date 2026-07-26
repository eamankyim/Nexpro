"use client";

import { useEffect, useState } from "react";
import { listPartners, type MarketplaceBusiness } from "@/lib/api";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { Input } from "@/components/ui/input";

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listPartners({ search: search || undefined });
        if (!cancelled) setBusinesses(data);
      } catch {
        if (!cancelled) setBusinesses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Partner businesses</h1>
      <p className="mt-2 text-slate-600">
        Apply to businesses that enabled Sabito Partners and earn commission on referred work.
      </p>
      <div className="mt-6 max-w-md">
        <Input
          placeholder="Search by name or location"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : businesses.length === 0 ? (
          <p className="col-span-full text-sm text-slate-500">No businesses match.</p>
        ) : (
          businesses.map((b) => <BusinessCard key={b.id} business={b} />)
        )}
      </div>
    </div>
  );
}
