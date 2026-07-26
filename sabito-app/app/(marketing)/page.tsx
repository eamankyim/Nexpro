"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPartners, type MarketplaceBusiness } from "@/lib/api";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "All categories",
  "Studio/Services",
  "Retail/Shop",
  "Pharmacy",
  "Beauty/Spa",
  "Printing",
];

export default function HomePage() {
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [category, setCategory] = useState("All categories");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listPartners({ category });
        if (!cancelled) setBusinesses(data);
      } catch {
        if (!cancelled) setBusinesses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const preview = useMemo(() => businesses.slice(0, 8), [businesses]);

  return (
    <div>
      <section className="bg-gradient-to-b from-[var(--sabito-mint)] to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Want to earn?{" "}
              <span className="text-[var(--sabito-orange)]">We&apos;ve got partners.</span>
            </h1>
            <p className="mt-4 max-w-lg text-slate-600">
              Browse businesses on African Business Suite that pay commission when you bring them
              customers. Apply, get approved, and track your earnings.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button>Join as marketer</Button>
              </Link>
              <Link href="/businesses">
                <Button variant="outline">See businesses</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-teal-100 bg-white p-6">
            <p className="text-sm font-semibold text-[var(--sabito-teal)]">How it works</p>
            <ol className="mt-4 space-y-3 text-sm text-slate-700">
              <li>1. Sign up as a Sabito marketer</li>
              <li>2. Apply to businesses that enabled Partner Program</li>
              <li>3. Bring customers with your referral code</li>
              <li>4. Earn when payment is collected — paid monthly by the business</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                category === c
                  ? "bg-[var(--sabito-teal)] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading partners…</p>
          ) : preview.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">
              No listed partner businesses yet. Businesses enable Sabito Partners in ABS Settings.
            </p>
          ) : (
            preview.map((b) => <BusinessCard key={b.id} business={b} />)
          )}
        </div>

        <div className="mt-10 flex justify-center">
          <Link href="/businesses">
            <Button>
              See all businesses →
            </Button>
          </Link>
        </div>
      </section>

      <section className="bg-[var(--sabito-mint)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--sabito-teal-dark)]">Built for real partners</h2>
            <p className="mt-2 text-[var(--sabito-teal)]">
              Commission on first and returning clients. Monthly payouts marked in ABS.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--sabito-orange)]">{businesses.length}+</p>
              <p className="text-xs text-slate-500">listed businesses</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--sabito-teal)]">1st + return</p>
              <p className="text-xs text-slate-500">commission rates</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-fuchsia-600">Monthly</p>
              <p className="text-xs text-slate-500">payout cycle</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sabito-orange)]">FAQ</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Got questions? We&apos;ve got answers.</h2>
        <div className="mt-8 space-y-3 text-left">
          {[
            ["What is Sabito App?", "A partner marketplace where marketers apply to ABS businesses and earn commission on referred customers."],
            ["When do I earn?", "When the customer’s payment is collected — not just when a quote is created."],
            ["How do I get paid?", "The business pays you by MoMo or bank, then marks commissions paid in ABS."],
            ["How do businesses join?", "In ABS: Settings → Sabito Partners → enable and list on marketplace."],
          ].map(([q, a], i) => (
            <details key={q} className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-semibold text-slate-900">
                {String(i + 1).padStart(2, "0")} · {q}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
