"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearAuth,
  getMarketerSession,
  listMyApplications,
  listMyEarnings,
  listMyPartnerships,
  updateMarketerProfile,
  type Marketer,
} from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AnyRow = Record<string, unknown>;

export default function DashboardPage() {
  const router = useRouter();
  const [marketer, setMarketer] = useState<Marketer | null>(null);
  const [applications, setApplications] = useState<AnyRow[]>([]);
  const [partnerships, setPartnerships] = useState<AnyRow[]>([]);
  const [earnings, setEarnings] = useState<AnyRow[]>([]);
  const [error, setError] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMarketerSession();
        if (cancelled) return;
        setMarketer(me.data.marketer);
        setMomoNumber(me.data.marketer.momoNumber || "");
        const [apps, partners, earn] = await Promise.all([
          listMyApplications(),
          listMyPartnerships(),
          listMyEarnings(),
        ]);
        if (cancelled) return;
        setApplications((apps.data || []) as AnyRow[]);
        setPartnerships((partners.data || []) as AnyRow[]);
        setEarnings((earn.data || []) as AnyRow[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Session expired");
          clearAuth();
          router.replace("/login?next=/dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const dueTotal = earnings
    .filter((e) => e.status === "due")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  return (
    <>
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {marketer ? `Hi, ${marketer.name}` : "Dashboard"}
            </h1>
            <p className="text-sm text-slate-500">Applications, partnerships, and earnings</p>
          </div>
          <div className="flex gap-2">
            <Link href="/businesses">
              <Button variant="outline">Browse businesses</Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                clearAuth();
                router.push("/");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Applications</p>
            <p className="text-2xl font-bold">{applications.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Active partners</p>
            <p className="text-2xl font-bold">{partnerships.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Due earnings</p>
            <p className="text-2xl font-bold">GHS {dueTotal.toFixed(2)}</p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">Applications</h2>
          <div className="mt-3 space-y-2">
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">No applications yet.</p>
            ) : (
              applications.map((app) => {
                const tenant = app.tenant as AnyRow | undefined;
                const settings = tenant?.partnerProgramSettings as AnyRow | undefined;
                return (
                  <div key={String(app.id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-medium">
                      {String(settings?.displayName || tenant?.name || "Business")}
                    </p>
                    <p className="text-slate-500">Status: {String(app.status)}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">Active partnerships</h2>
          <div className="mt-3 space-y-2">
            {partnerships.length === 0 ? (
              <p className="text-sm text-slate-500">No partnerships yet.</p>
            ) : (
              partnerships.map((p) => {
                const tenant = p.tenant as AnyRow | undefined;
                const settings = tenant?.partnerProgramSettings as AnyRow | undefined;
                return (
                  <div key={String(p.id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-medium">
                      {String(settings?.displayName || tenant?.name || "Business")}
                    </p>
                    <p className="text-slate-500">
                      Referral code: <span className="font-mono">{String(p.referralCode)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Share this code when the business creates the customer (or ask staff to enter it).
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">Earnings</h2>
          <div className="mt-3 space-y-2">
            {earnings.length === 0 ? (
              <p className="text-sm text-slate-500">No earnings yet. Commission accrues when payment is collected.</p>
            ) : (
              earnings.map((e) => (
                <div key={String(e.id)} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-medium">
                    GHS {Number(e.amount).toFixed(2)} · {String(e.status)}
                  </p>
                  <p className="text-slate-500">
                    {String(e.rateType)} @ {String(e.ratePercent)}% of GHS{" "}
                    {Number(e.paymentAmount).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 p-4">
          <h2 className="font-semibold text-slate-900">Payout details</h2>
          <p className="mt-1 text-sm text-slate-500">
            MoMo number is shown to businesses so they can pay you outside ABS.
          </p>
          <div className="mt-3 flex max-w-md flex-col gap-2 sm:flex-row">
            <Input
              placeholder="MoMo number"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
            />
            <Button
              type="button"
              disabled={savingProfile}
              onClick={async () => {
                setSavingProfile(true);
                setProfileMessage("");
                try {
                  const res = await updateMarketerProfile({ momoNumber });
                  setMarketer(res.data.marketer);
                  setProfileMessage("Saved");
                } catch (err) {
                  setProfileMessage(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              {savingProfile ? "Saving…" : "Save"}
            </Button>
          </div>
          {profileMessage ? <p className="mt-2 text-sm text-slate-500">{profileMessage}</p> : null}
        </section>
      </div>
    </>
  );
}
