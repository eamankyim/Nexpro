"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listMyApplications,
  listMyCashouts,
  listMyReferrals,
} from "@/lib/api";

type Item = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  createdAt?: string;
};

export default function ActivitiesPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const [refs, cashouts, apps] = await Promise.all([
        listMyReferrals(),
        listMyCashouts(),
        listMyApplications(),
      ]);
      const mapped: Item[] = [
        ...((refs.data || []) as Record<string, unknown>[]).map((r) => ({
          id: `ref-${r.id}`,
          title: `Referral: ${String(r.clientName || "Client")}`,
          subtitle: String(r.status || ""),
          href: `/referrals/${r.id}`,
          createdAt: r.createdAt ? String(r.createdAt) : undefined,
        })),
        ...((cashouts.data || []) as Record<string, unknown>[]).map((c) => ({
          id: `co-${c.id}`,
          title: `Cashout GHS ${Number(c.amount || 0).toFixed(2)}`,
          subtitle: String(c.status || ""),
          href: "/earnings",
          createdAt: c.createdAt ? String(c.createdAt) : undefined,
        })),
        ...((apps.data || []) as Record<string, unknown>[]).map((a) => ({
          id: `app-${a.id}`,
          title: "Partnership application",
          subtitle: String(a.status || ""),
          href: "/businesses",
          createdAt: a.createdAt ? String(a.createdAt) : undefined,
        })),
      ].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setItems(mapped);
    })().catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">All activities</h1>
      <div className="mt-6 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href || "/dashboard"}
              className="block rounded-xl border border-slate-200 bg-white p-3 text-sm hover:border-[var(--sabito-green)]"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-slate-500">
                {item.subtitle}
                {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ""}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
