"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getMarketerDashboard,
  getMarketerSession,
  listMyApplications,
  listMyCashouts,
  listMyEarnings,
  listMyPartnerships,
  listMyReferrals,
  type Marketer,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

type AnyRow = Record<string, unknown>;

export default function DashboardPage() {
  const [marketer, setMarketer] = useState<Marketer | null>(null);
  const [stats, setStats] = useState({ partners: 0, referrals: 0, due: 0, apps: 0 });
  const [recent, setRecent] = useState<AnyRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMarketerSession();
        if (cancelled) return;
        setMarketer(me.data.marketer);
        const [partners, refs, earn, apps, dash, cashouts] = await Promise.all([
          listMyPartnerships(),
          listMyReferrals(),
          listMyEarnings("due"),
          listMyApplications(),
          getMarketerDashboard().catch(() => ({ data: {} })),
          listMyCashouts().catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const due = ((earn.data || []) as AnyRow[]).reduce(
          (s: number, e) => s + Number(e.amount || 0),
          0
        );
        const dashData = (dash.data || {}) as Record<string, unknown>;
        setStats({
          partners: (partners.data || []).length,
          referrals: (refs.data || []).length,
          due: Number(dashData.dueBalance ?? due),
          apps: (apps.data || []).length,
        });
        const activities: AnyRow[] = [
          ...(refs.data || []).slice(0, 5).map((r) => ({
            ...(r as AnyRow),
            _kind: "referral",
          })),
          ...(cashouts.data || []).slice(0, 3).map((c) => ({
            ...(c as AnyRow),
            _kind: "cashout",
          })),
        ];
        setRecent(activities.slice(0, 6));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {marketer ? `Hi, ${marketer.name}` : "Home"}
          </h1>
          <p className="text-sm text-slate-500">
            Partners, referrals, earnings — same journey as the Sabito mobile app
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/referrals">
            <Button>Add referral</Button>
          </Link>
          <Link href="/cashout">
            <Button variant="outline">Request cashout</Button>
          </Link>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Applications", stats.apps],
          ["Active partners", stats.partners],
          ["Referrals", stats.referrals],
          ["Due (GHS)", stats.due.toFixed(2)],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent activity</h2>
          <Link href="/activities" className="text-sm text-[var(--sabito-green)]">
            See all
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet. Browse businesses and apply.</p>
          ) : (
            recent.map((row) => (
              <div
                key={String(row.id) + String(row._kind)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                {row._kind === "cashout" ? (
                  <p className="font-medium">
                    Cashout GHS {Number(row.amount || 0).toFixed(2)} · {String(row.status)}
                  </p>
                ) : (
                  <p className="font-medium">
                    Referral: {String(row.clientName || "Client")} · {String(row.status)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
