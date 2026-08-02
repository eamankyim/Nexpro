"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCashout,
  getMarketerSession,
  listMyEarnings,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AnyRow = Record<string, unknown>;

export default function CashoutPage() {
  const router = useRouter();
  const [due, setDue] = useState<AnyRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasMomo, setHasMomo] = useState(true);

  useEffect(() => {
    (async () => {
      const [earn, me] = await Promise.all([listMyEarnings("due"), getMarketerSession()]);
      const rows = (earn.data || []) as AnyRow[];
      setDue(rows);
      setSelected(new Set(rows.map((r) => String(r.id))));
      setHasMomo(Boolean(me.data.marketer.momoNumber));
    })().catch((err) => setMessage(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const total = due
    .filter((e) => selected.has(String(e.id)))
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setMessage("");
    if (!hasMomo) {
      setMessage("Save a MoMo number in Account first.");
      return;
    }
    if (selected.size === 0) {
      setMessage("Select at least one due commission.");
      return;
    }
    setSaving(true);
    try {
      await createCashout({
        commissionIds: Array.from(selected),
        notes: notes.trim() || undefined,
      });
      router.push("/earnings");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cashout failed");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/earnings">
        <Button variant="ghost">← Back to earnings</Button>
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Request cashout</h1>
      <p className="mt-1 text-sm text-slate-500">
        Select due commissions. The business pays you outside ABS, then marks paid in Settings →
        Sabito Partners.
      </p>

      {!hasMomo ? (
        <p className="mt-4 text-sm text-amber-700">
          <Link href="/account" className="underline">
            Add MoMo details
          </Link>{" "}
          before cashout.
        </p>
      ) : null}

      <div className="mt-6 space-y-2">
        {due.length === 0 ? (
          <p className="text-sm text-slate-500">No due commissions.</p>
        ) : (
          due.map((e) => {
            const id = String(e.id);
            return (
              <label
                key={id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                />
                <span className="flex-1">
                  GHS {Number(e.amount || 0).toFixed(2)} · {String(e.rateType || "commission")}
                </span>
              </label>
            );
          })
        )}
      </div>

      <label className="mt-4 block text-sm text-slate-600">
        Notes (optional)
        <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={saving || selected.size === 0} onClick={submit}>
          {saving ? "Submitting…" : `Request GHS ${total.toFixed(2)}`}
        </Button>
        {message ? <p className="text-sm text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}
