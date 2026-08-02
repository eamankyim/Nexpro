"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getMyReferral } from "@/lib/api";
import { Button } from "@/components/ui/button";

type AnyRow = Record<string, unknown>;

export default function ReferralDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [referral, setReferral] = useState<AnyRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getMyReferral(id)
      .then((res) => setReferral((res.data || null) as AnyRow | null))
      .catch((err) => setError(err instanceof Error ? err.message : "Not found"));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/referrals">
        <Button variant="ghost">← Back to referrals</Button>
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Referral details</h1>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!error && !referral ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : null}
      {referral ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <p>
            <span className="text-slate-500">Client</span>
            <br />
            <span className="font-semibold">{String(referral.clientName || "—")}</span>
          </p>
          <p>
            <span className="text-slate-500">Status</span>
            <br />
            <span className="font-semibold">{String(referral.status || "—")}</span>
          </p>
          <p>
            <span className="text-slate-500">Email</span>
            <br />
            {String(referral.email || "—")}
          </p>
          <p>
            <span className="text-slate-500">Phone</span>
            <br />
            {String(referral.phone || "—")}
          </p>
          {referral.location ? (
            <p>
              <span className="text-slate-500">Location</span>
              <br />
              {String(referral.location)}
            </p>
          ) : null}
          {referral.note ? (
            <p>
              <span className="text-slate-500">Note</span>
              <br />
              {String(referral.note)}
            </p>
          ) : null}
          {referral.createdAt ? (
            <p className="text-slate-500">
              Created {new Date(String(referral.createdAt)).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
