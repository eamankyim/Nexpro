"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listPartners, type MarketplaceBusiness } from "@/lib/api";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { Button } from "@/components/ui/button";
import { ABS_BUSINESS_SIGNUP_URL } from "@/lib/constants";

const CATEGORIES = [
  "All categories",
  "Studio/Services",
  "Retail/Shop",
  "Pharmacy",
  "Beauty/Spa",
  "Printing",
];

const CHIPS = [
  {
    title: "Commission paid",
    body: "A commission of GHS 800 has been paid to your wallet.",
    time: "Today",
    color: "#22c55e",
  },
  {
    title: "Referral matched",
    body: "Your client matched a customer at Print Studio Accra.",
    time: "Yesterday",
    color: "#1ca700",
  },
  {
    title: "Cashout approved",
    body: "The business approved your GHS 1,200 cashout request.",
    time: "This week",
    color: "#f59e0b",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Join Sabito",
    body: "Create your marketer account with email and password — free to start.",
  },
  {
    n: "02",
    title: "Apply to partners",
    body: "Browse ABS businesses that enabled Sabito Partners and send an application.",
  },
  {
    n: "03",
    title: "Refer by email or phone",
    body: "Submit the client’s email and/or phone. ABS matches them to the business’s customers.",
  },
  {
    n: "04",
    title: "Earn, then cash out",
    body: "Commission accrues when payment is collected. Request cashout when you’re ready.",
  },
];

export default function HomePage() {
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [category, setCategory] = useState("All categories");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setBusinesses([]);
        setLoading(false);
      }
    }, 8000);

    (async () => {
      setLoading(true);
      try {
        const data = await listPartners({ category });
        if (!cancelled) setBusinesses(data);
      } catch {
        if (!cancelled) setBusinesses([]);
      } finally {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [category]);

  const preview = useMemo(() => businesses.slice(0, 8), [businesses]);

  return (
    <div>
      {/* Full Sabito hero — mirrors original green marketing pane */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          backgroundColor: "#1ca700",
          backgroundImage: "url(/brand/bg-pattern.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[#1ca700]/85" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <div className="mb-6 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/sabito-icon.png" alt="" className="h-12 w-12 rounded-xl" />
              <span className="text-2xl font-bold tracking-tight">Sabito</span>
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Make money with referrals
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/90">
              Connect businesses with clients and earn commissions. Track referrals and cashouts —
              all in one place, powered by African Business Suite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={ABS_BUSINESS_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
                <Button variant="onBrandOutline" className="px-7 py-3 text-base">
                  Sign up as business
                </Button>
              </a>
              <Link href="/signup">
                <Button variant="onBrand" className="px-7 py-3 text-base">
                  Join as marketer
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/75">
              Businesses sign up on ABS (absghana.com), then enable Sabito Partners in Settings.
            </p>
          </div>

          <div className="space-y-3">
            {CHIPS.map((chip) => (
              <div
                key={chip.title}
                className="rounded-2xl border border-white/20 bg-white p-4 text-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: chip.color }}
                  >
                    ✓
                  </span>
                  <p className="font-semibold">{chip.title}</p>
                  <span className="ml-auto text-xs text-slate-400">{chip.time}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{chip.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dual audience */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">Who is Sabito for?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Marketers earn on Sabito. Businesses run on ABS and open their doors to partners.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-[var(--sabito-mint)] p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--sabito-green)]">
              Marketers
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Earn with every referral</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• Apply to partner businesses</li>
              <li>• Refer clients by email or phone</li>
              <li>• Earn when payment is collected</li>
              <li>• Request cashout when you&apos;re ready</li>
            </ul>
            <Link href="/signup" className="mt-6 inline-block">
              <Button>Create marketer account</Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Businesses
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Grow with trusted marketers</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              <li>• Sign up on African Business Suite</li>
              <li>• Enable Sabito Partners in Settings</li>
              <li>• Approve marketers and track referrals</li>
              <li>• Pay cashouts and mark them paid in ABS</li>
            </ul>
            <a
              href={ABS_BUSINESS_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block"
            >
              <Button variant="outline">Go to ABS (absghana.com)</Button>
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Same journey on web and mobile — apply, refer, earn, cash out.
              </p>
            </div>
            <Link href="/how-it-works" className="text-sm font-semibold text-[var(--sabito-green)]">
              Full guide →
            </Link>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t-2 border-[var(--sabito-green)] pt-4">
                <p className="text-xs font-semibold tracking-widest text-[var(--sabito-green)]">
                  {step.n}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Partner businesses</h2>
            <p className="mt-2 text-slate-600">
              Businesses that enabled Sabito Partners in ABS Settings.
            </p>
          </div>
          <Link href="/businesses" className="text-sm font-semibold text-[var(--sabito-green)]">
            See all →
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                category === c
                  ? "border-[var(--sabito-green)] bg-[var(--sabito-green)] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <p className="col-span-full text-sm text-slate-500">Loading partners…</p>
          ) : preview.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-[var(--sabito-mint)] px-6 py-14 text-center">
              <p className="text-xl font-semibold text-slate-900">Marketplace is warming up</p>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
                No partner businesses are listed yet. Create your marketer account now — when
                businesses enable Sabito Partners in ABS, you&apos;ll be ready to apply.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <a href={ABS_BUSINESS_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">I&apos;m a business — go to ABS</Button>
                </a>
                <Link href="/signup">
                  <Button>I&apos;m a marketer — join Sabito</Button>
                </Link>
              </div>
            </div>
          ) : (
            preview.map((b) => <BusinessCard key={b.id} business={b} />)
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-slate-200 bg-[var(--sabito-mint)]">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-bold text-slate-900">Why marketers choose Sabito</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              [
                "Email or phone match",
                "Referrals attribute to the right ABS customer — first touch wins.",
              ],
              [
                "Earn on collected payment",
                "Commission when the business actually gets paid, not on quotes alone.",
              ],
              [
                "Cashout on your schedule",
                "Request payout with MoMo on file. Businesses mark paid in ABS Settings.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="border-l-2 border-[var(--sabito-green)] pl-4">
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">Got questions?</h2>
        <div className="mt-8 space-y-3">
          {[
            [
              "What is Sabito?",
              "A marketer app where you partner with ABS businesses, refer customers by email or phone, and earn commission when payment is collected.",
            ],
            [
              "How do referrals match?",
              "You submit the client’s email and/or phone. ABS matches that to the business’s customer record (first touch wins).",
            ],
            [
              "When do I earn?",
              "When the customer’s payment is collected — not just when a quote is created.",
            ],
            [
              "How do I get paid?",
              "Request a cashout in Sabito. The business pays you by MoMo or bank, then marks the cashout paid in ABS Settings → Sabito Partners.",
            ],
            [
              "How do businesses join?",
              "Sign up on African Business Suite at absghana.com, then enable Sabito Partners in ABS Settings to list on this marketplace.",
            ],
          ].map(([q, a], i) => (
            <details key={q} className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold text-slate-900">
                {String(i + 1).padStart(2, "0")} · {q}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA band */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          backgroundColor: "#1ca700",
          backgroundImage: "url(/brand/bg-pattern.png)",
          backgroundSize: "cover",
        }}
      >
        <div className="absolute inset-0 bg-[#1ca700]/90" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold">Ready to earn with Sabito?</h2>
            <p className="mt-2 max-w-xl text-white/90">
              Marketers join here. Businesses start on ABS, then turn on Sabito Partners.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={ABS_BUSINESS_SIGNUP_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="onBrandOutline">Sign up as business</Button>
            </a>
            <Link href="/signup">
              <Button variant="onBrand">Join as marketer</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
