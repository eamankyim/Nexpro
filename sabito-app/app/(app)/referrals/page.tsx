"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createReferral,
  listMyPartnerships,
  listMyReferrals,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AnyRow = Record<string, unknown>;

export default function ReferralsPage() {
  const [partnerships, setPartnerships] = useState<AnyRow[]>([]);
  const [referrals, setReferrals] = useState<AnyRow[]>([]);
  const [partnershipId, setPartnershipId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [partners, refs] = await Promise.all([listMyPartnerships(), listMyReferrals()]);
    const partnerRows = (partners.data || []) as AnyRow[];
    setPartnerships(partnerRows);
    setReferrals((refs.data || []) as AnyRow[]);
    setPartnershipId((prev) => prev || (partnerRows[0] ? String(partnerRows[0].id) : ""));
  };

  useEffect(() => {
    load().catch((err) => setMessage(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const submit = async () => {
    setMessage("");
    if (!partnershipId || !clientName.trim()) {
      setMessage("Select a partnership and enter the client name.");
      return;
    }
    if (!clientEmail.trim() && !clientPhone.trim()) {
      setMessage("Add client email or phone so the business can match the customer.");
      return;
    }
    setSaving(true);
    try {
      await createReferral({
        partnershipId,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientPhone: clientPhone.trim() || undefined,
        location: location.trim() || undefined,
        note: note.trim() || undefined,
      });
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setLocation("");
      setNote("");
      setMessage("Referral submitted.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create referral");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Referrals</h1>
        <p className="text-sm text-slate-500">
          Match uses normalized email or phone when the business has that customer in ABS.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">Add referral</h2>
        {partnerships.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No active partnerships yet.{" "}
            <Link href="/businesses" className="text-[var(--sabito-green)]">
              Browse businesses
            </Link>{" "}
            and apply first.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Partnership
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={partnershipId}
                onChange={(e) => setPartnershipId(e.target.value)}
              >
                {partnerships.map((p) => {
                  const tenant = p.tenant as AnyRow | undefined;
                  const settings = tenant?.partnerProgramSettings as AnyRow | undefined;
                  return (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(settings?.displayName || tenant?.name || p.referralCode || p.id)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Client name *
              <Input className="mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </label>
            <label className="text-sm text-slate-600">
              Client email (or phone)
              <Input className="mt-1" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </label>
            <label className="text-sm text-slate-600">
              Client phone (or email)
              <Input className="mt-1" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
            </label>
            <label className="text-sm text-slate-600">
              Location (optional)
              <Input className="mt-1" value={location} onChange={(e) => setLocation(e.target.value)} />
            </label>
            <label className="text-sm text-slate-600">
              Note (optional)
              <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" disabled={saving || partnerships.length === 0} onClick={submit}>
            {saving ? "Submitting…" : "Submit referral"}
          </Button>
          {message ? <p className="text-sm text-slate-500">{message}</p> : null}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-slate-900">Your referrals</h2>
        <div className="mt-3 space-y-2">
          {referrals.length === 0 ? (
            <p className="text-sm text-slate-500">No referrals yet.</p>
          ) : (
            referrals.map((r) => (
              <Link
                key={String(r.id)}
                href={`/referrals/${r.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-3 text-sm hover:border-[var(--sabito-green)]"
              >
                <p className="font-medium">{String(r.clientName || "Client")}</p>
                <p className="text-slate-500">
                  {String(r.status)}
                  {r.email ? ` · ${String(r.email)}` : ""}
                  {r.phone ? ` · ${String(r.phone)}` : ""}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
