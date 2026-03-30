/**
 * Public page: view and pay an invoice via payment link (no login).
 * Route: /pay-invoice/:token
 * API: GET /api/public/invoices/:token,
 *      POST .../mobile-money/initiate | .../mobile-money/poll (direct MoMo),
 *      POST .../initialize-paystack (Paystack: card + mobile_money),
 *      POST .../pay (manual recording if re-enabled)
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Loader2, CheckCircle, CreditCard, Printer, Download, Smartphone } from 'lucide-react';
import PrintableInvoice from '../components/PrintableInvoice';
import { generatePDF } from '../utils/pdfUtils';

function normalizeGhanaMoMoPhone(phone) {
  const raw = String(phone || '').replace(/\s/g, '');
  if (!raw) return '';
  if (raw.startsWith('+233')) return raw.slice(1);
  if (raw.startsWith('233')) return raw;
  if (raw.startsWith('0')) return `233${raw.slice(1)}`;
  if (/^\d{9}$/.test(raw)) return `233${raw}`;
  return raw.replace(/^\+/, '');
}

function detectMoMoProviderLocal(phone) {
  const n = normalizeGhanaMoMoPhone(phone);
  if (n.length < 12 || !n.startsWith('233')) return 'UNKNOWN';
  const prefix = n.substring(3, 5);
  if (['24', '54', '55', '59'].includes(prefix)) return 'MTN';
  if (['26', '27', '57'].includes(prefix)) return 'AIRTEL';
  if (['20', '50'].includes(prefix)) return 'VODAFONE';
  return 'UNKNOWN';
}

/** Avoid showing Cloudflare/HTML error bodies from bad upstream responses in the UI. */
function safeInvoiceApiMessage(raw, fallback) {
  if (raw == null) return fallback;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!s || s === '[object Object]') return fallback;
  const probe = s.slice(0, 200).toLowerCase();
  if (probe.includes('<!doctype') || probe.includes('<html') || probe.includes('just a moment')) return fallback;
  if (s.length > 900) return fallback;
  return s;
}

function isLikelyEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

export default function PayInvoice() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const fromPaystack = searchParams.get('paystack') === '1';
  /** Paystack appends reference or trxref to the callback URL after payment. */
  const paystackReturnReference = useMemo(
    () => (searchParams.get('reference') || searchParams.get('trxref') || '').trim(),
    [searchParams]
  );

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [momoLoading, setMomoLoading] = useState(false);
  const [momoWaiting, setMomoWaiting] = useState(false);
  const [momoProvider, setMomoProvider] = useState('MTN');
  const [downloading, setDownloading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [momoPayModalOpen, setMomoPayModalOpen] = useState(false);
  /** Paystack redirect: webhook can be slow; after max polls we show “check again” instead of infinite spinner. */
  const [paystackConfirmTimedOut, setPaystackConfirmTimedOut] = useState(false);
  const printRef = useRef(null);
  const paySectionRef = useRef(null);
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'mobile_money',
    referenceNumber: '',
    customerEmail: '',
    customerName: '',
    mobileNumber: ''
  });

  /**
   * Load invoice from public link. Returns the invoice payload when successful (for polling).
   * @param {{ silent?: boolean }} [opts] - silent: do not set page-level error on failure (used while polling after Paystack)
   */
  const fetchInvoice = useCallback(
    (opts = {}) => {
      const { silent } = opts;
      if (!token) return Promise.resolve(null);
      const url = `${API_BASE_URL}/api/public/invoices/${token}?_=${Date.now()}`;
      return fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
        .then((res) => {
          if (!res.ok) {
            throw new Error(res.status === 404 ? 'Invoice not found or link expired' : 'Failed to load invoice');
          }
          return res.json();
        })
        .then((data) => {
          if (data.success && data.data) {
            setInvoice(data.data);
            const balance = parseFloat(data.data.balance ?? data.data.totalAmount ?? 0);
            const customerEmail = data.data.customer?.email || '';
            const customerPhone = (data.data.customer?.phone || '').trim();
            setForm((f) => ({
              ...f,
              amount: balance > 0 ? balance.toString() : '',
              customerEmail: f.customerEmail || customerEmail,
              mobileNumber: f.mobileNumber || customerPhone
            }));
            return data.data;
          }
          if (!silent) setError('Invoice not found');
          return null;
        })
        .catch((err) => {
          if (!silent) setError(err.message || 'Something went wrong');
          return null;
        });
    },
    [token]
  );

  const stripPaystackReturnQuery = useCallback(() => {
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has('paystack')) return;
      u.searchParams.delete('paystack');
      window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * Ask the server to verify this transaction with Paystack and apply it if the webhook was delayed (e.g. serverless).
   */
  const verifyPaystackWithBackend = useCallback(async () => {
    if (!token || !paystackReturnReference) return { skipped: true };
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/invoices/${token}/verify-paystack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ reference: paystackReturnReference })
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    } catch {
      return { ok: false, data: {} };
    }
  }, [token, paystackReturnReference]);

  useEffect(() => {
    if (!token) {
      setError('Invalid payment link');
      setLoading(false);
      return;
    }
    fetchInvoice().finally(() => setLoading(false));
  }, [token]);

  // After return from Paystack: poll until invoice shows paid (webhook may lag; does not rely on WebSocket).
  useEffect(() => {
    if (!fromPaystack || !token || loading) return undefined;

    let stopped = false;
    let polls = 0;
    const MAX_POLLS = 50;
    const INTERVAL_MS = 3000;
    const pendingRef = { id: null };

    const clearPending = () => {
      if (pendingRef.id != null) {
        clearTimeout(pendingRef.id);
        pendingRef.id = null;
      }
    };

    const invoiceLooksPaid = (inv) => {
      if (!inv) return false;
      const bal = parseFloat(inv.balance ?? inv.totalAmount ?? 0);
      return bal <= 0 || inv.status === 'paid';
    };

    const tick = async () => {
      if (stopped) return;
      if (polls === 0 && paystackReturnReference) {
        await verifyPaystackWithBackend();
      }
      if (stopped) return;
      const inv = await fetchInvoice({ silent: true });
      if (stopped) return;
      polls += 1;
      if (invoiceLooksPaid(inv)) {
        setPaystackConfirmTimedOut(false);
        stripPaystackReturnQuery();
        return;
      }
      if (polls >= MAX_POLLS) {
        setPaystackConfirmTimedOut(true);
        return;
      }
      pendingRef.id = setTimeout(tick, INTERVAL_MS);
    };

    pendingRef.id = setTimeout(tick, 500);
    return () => {
      stopped = true;
      clearPending();
    };
  }, [
    fromPaystack,
    token,
    loading,
    paystackReturnReference,
    fetchInvoice,
    stripPaystackReturnQuery,
    verifyPaystackWithBackend
  ]);

  useEffect(() => {
    const opts = invoice?.paymentOptions;
    if (!opts) return;
    if (opts.directAirtelMoMo && !opts.directMtnMoMo) setMomoProvider('AIRTEL');
    if (opts.directMtnMoMo && !opts.directAirtelMoMo) setMomoProvider('MTN');
  }, [invoice?.paymentOptions?.directAirtelMoMo, invoice?.paymentOptions?.directMtnMoMo]);

  useEffect(() => {
    if (paid) setMomoPayModalOpen(false);
  }, [paid]);

  const scrollToPaySection = () => {
    paySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /** Starts Paystack hosted checkout (card / Paystack MoMo). Email from form or invoice customer. */
  const runPaystackCheckout = async () => {
    const email = (form.customerEmail || invoice?.customer?.email || '').trim();
    if (!email) {
      setError('Email is required for Paystack. Enter it in the payment section below.');
      scrollToPaySection();
      return;
    }
    if (!isLikelyEmail(email)) {
      setError('Please enter a valid email address.');
      scrollToPaySection();
      return;
    }
    if (!invoice || !token) return;
    setPaystackLoading(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/public/invoices/${token}/initialize-paystack`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          mobileNumber: (form.mobileNumber || '').trim() || undefined
        })
      });
      let data;
      try {
        data = await res.json();
      } catch (_) {
        setError('Could not start payment. Please try again.');
        return;
      }
      const rawMsg = data?.message ?? data?.error;
      const msg = safeInvoiceApiMessage(
        typeof rawMsg === 'string' ? rawMsg : null,
        'Could not start payment. Please try again or contact the business.'
      );
      if (!res.ok) {
        setError(msg);
        return;
      }
      if (data.success && data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
        return;
      }
      setError(msg);
    } catch (err) {
      setError(err.message || 'Could not start payment');
    } finally {
      setPaystackLoading(false);
    }
  };

  const handleDirectMoMo = async (e) => {
    e.preventDefault();
    if (!invoice || !token) return;
    const raw = (form.mobileNumber || '').trim();
    const normalized = normalizeGhanaMoMoPhone(raw);
    if (!normalized || normalized.length < 12) {
      setError('Enter a valid mobile money number (e.g. 0XX XXX XXXX).');
      return;
    }
    let provider = (momoProvider || 'MTN').toUpperCase();
    if (provider === 'UNKNOWN' || !provider) {
      const d = detectMoMoProviderLocal(raw);
      if (d === 'VODAFONE') {
        setError('Vodafone Cash automated payment is not available yet. Use MTN or AirtelTigo, or pay by card.');
        return;
      }
      if (d !== 'UNKNOWN') provider = d;
    }
    if (provider === 'VODAFONE') {
      setError('Vodafone Cash automated payment is not available yet. Use MTN or AirtelTigo, or pay by card.');
      return;
    }

    setMomoLoading(true);
    setMomoWaiting(false);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/public/invoices/${token}/mobile-money/initiate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: normalized,
          provider
        })
      });
      let data;
      try {
        data = await res.json();
      } catch (_) {
        setError('Could not start mobile money payment. Please try again.');
        return;
      }
      if (!res.ok || !data.success) {
        const rawMoMo = data?.message || data?.error;
        setError(
          safeInvoiceApiMessage(
            typeof rawMoMo === 'string' ? rawMoMo : null,
            'Could not start mobile money payment.'
          )
        );
        return;
      }

      setMomoLoading(false);
      setMomoWaiting(true);
      const maxAttempts = 30;
      const delayMs = 2000;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        const pollRes = await fetch(
          `${API_BASE_URL}/api/public/invoices/${token}/mobile-money/poll`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } }
        );
        // eslint-disable-next-line no-await-in-loop
        const pollData = await pollRes.json().catch(() => ({}));
        if (pollData?.data?.invoice?.status === 'paid' || pollData?.data?.invoiceStatus === 'paid') {
          setPaid(true);
          if (pollData.data.invoice) setInvoice(pollData.data.invoice);
          else await fetchInvoice();
          setMomoWaiting(false);
          setMomoLoading(false);
          return;
        }
        if (pollData?.data?.paymentStatus === 'FAILED') {
          setError('Mobile money payment failed. Please try again or use card.');
          setMomoWaiting(false);
          setMomoLoading(false);
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, delayMs));
      }
      setError('Payment not confirmed yet. Approve on your phone or try again.');
      setMomoWaiting(false);
    } catch (err) {
      setError(err.message || 'Mobile money payment failed.');
    } finally {
      setMomoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Unable to load invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-500 mt-2">The link may be invalid or expired. Please contact the sender.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const balance = parseFloat(invoice?.balance ?? invoice?.totalAmount ?? 0);
  const isFullyPaid = balance <= 0 || invoice?.status === 'paid';
  const po = invoice?.paymentOptions;
  const paystackEnabled = po == null ? true : po.paystack === true;
  const directMtn = po == null ? true : po.directMtnMoMo === true;
  const directAirtel = po == null ? true : po.directAirtelMoMo === true;
  const directMoMo = po == null ? true : po.directMoMo === true;

  const paystackEmailCandidate = (form.customerEmail || invoice?.customer?.email || '').trim();
  /** Paystack-only flow with a known-good email: top “Pay” can skip scrolling and go straight to Paystack’s page. */
  const canTopBarInstantPaystack =
    paystackEnabled && !directMoMo && isLikelyEmail(paystackEmailCandidate);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!printRef.current || !invoice) return;
    setDownloading(true);
    try {
      await generatePDF(printRef.current, {
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        format: 'a4',
        orientation: 'portrait'
      });
    } catch (e) {
      console.error('PDF download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  const organization = invoice?.organization || { name: invoice?.tenant?.name };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .pay-invoice-document, .pay-invoice-document * { visibility: visible; }
          .pay-invoice-document { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="max-w-[210mm] mx-auto">
        <Dialog
          open={momoPayModalOpen}
          onOpenChange={(open) => {
            setMomoPayModalOpen(open);
            if (open) setError(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pay with mobile money</DialogTitle>
              <DialogDescription>
                Direct payment through your network (MTN / AirtelTigo). Approve the prompt on your phone; we confirm this
                invoice automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}
              <form onSubmit={handleDirectMoMo} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="momo-modal-phone" className="text-xs">
                    MoMo number
                  </Label>
                  <Input
                    id="momo-modal-phone"
                    type="tel"
                    inputMode="numeric"
                    value={form.mobileNumber}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, mobileNumber: v }));
                      const d = detectMoMoProviderLocal(v);
                      if (d === 'MTN' && directMtn) setMomoProvider('MTN');
                      if (d === 'AIRTEL' && directAirtel) setMomoProvider('AIRTEL');
                    }}
                    placeholder="0XX XXX XXXX"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="momo-modal-net" className="text-xs">
                    Network
                  </Label>
                  <select
                    id="momo-modal-net"
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={momoProvider}
                    onChange={(e) => setMomoProvider(e.target.value)}
                  >
                    {directMtn ? <option value="MTN">MTN Mobile Money</option> : null}
                    {directAirtel ? <option value="AIRTEL">AirtelTigo Money</option> : null}
                  </select>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setMomoPayModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={momoLoading || momoWaiting || balance <= 0}
                    className="bg-brand hover:bg-brand-dark"
                  >
                    {momoLoading || momoWaiting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {momoWaiting ? 'Waiting for approval…' : 'Starting…'}
                      </>
                    ) : (
                      `Pay ₵ ${balance.toFixed(2)} with MoMo`
                    )}
                  </Button>
                </div>
              </form>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Action bar: Print, Download, Pay */}
        <div className="no-print flex flex-wrap items-center justify-end gap-2 mb-4">
          <Button type="button" variant="outline" size="icon" onClick={handlePrint} title="Print" aria-label="Print">
            <Printer className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={handleDownload} disabled={downloading} title="Download PDF" aria-label="Download PDF">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
          {!(paid || isFullyPaid) && !fromPaystack && (
            <Button
              type="button"
              onClick={async () => {
                setError(null);
                if (directMoMo) {
                  setMomoPayModalOpen(true);
                  return;
                }
                if (canTopBarInstantPaystack) {
                  await runPaystackCheckout();
                  return;
                }
                scrollToPaySection();
              }}
              disabled={!directMoMo && paystackLoading}
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {!directMoMo && paystackLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : directMoMo ? (
                <Smartphone className="h-4 w-4 mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Pay ₵ {balance.toFixed(2)}
            </Button>
          )}
        </div>

        {/* Full invoice document (matches printable invoice layout) */}
        <div ref={printRef} className="pay-invoice-document rounded-lg border border-gray-200 overflow-hidden">
          <PrintableInvoice invoice={invoice} organization={organization} printConfig={{ format: 'a4' }} />
        </div>

        {/* Paid / confirming / pay form - below invoice */}
        <div className="no-print mt-6">
          {paid || isFullyPaid ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6 pb-6 flex flex-col items-center gap-2">
                <CheckCircle className="h-12 w-12 text-green-600" />
                <p className="font-semibold text-gray-900">Thank you. This invoice is paid.</p>
                <p className="text-sm text-gray-600">You can close this page.</p>
              </CardContent>
            </Card>
          ) : fromPaystack ? (
            <Card className="border-brand-30 bg-green-50/50">
              <CardContent className="pt-6 pb-6 flex flex-col items-center gap-4 text-center">
                {!paystackConfirmTimedOut ? (
                  <Loader2 className="h-10 w-10 animate-spin text-brand" />
                ) : (
                  <CheckCircle className="h-10 w-10 text-amber-600" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Payment submitted</p>
                  <p className="text-sm text-gray-600 max-w-md">
                    {paystackConfirmTimedOut
                      ? paystackReturnReference
                        ? 'We synced with Paystack from your receipt link, but this invoice still shows unpaid. Tap refresh to check again, or contact the business if Paystack confirmed success.'
                        : 'We could not confirm the update yet (this can take a minute). If Paystack showed success, your payment is likely complete — refresh below or check your email.'
                      : 'Confirming your payment with the business. We verify with Paystack using the reference in your URL when possible; this page will update automatically.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      setError(null);
                      if (paystackReturnReference) {
                        await verifyPaystackWithBackend();
                      }
                      const inv = await fetchInvoice({ silent: true });
                      const bal = parseFloat(inv?.balance ?? inv?.totalAmount ?? 0);
                      const done = bal <= 0 || inv?.status === 'paid';
                      if (done) {
                        setPaystackConfirmTimedOut(false);
                        stripPaystackReturnQuery();
                      } else {
                        setPaystackConfirmTimedOut(true);
                      }
                    }}
                  >
                    Refresh payment status
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : canTopBarInstantPaystack ? null : (
            <Card
              ref={paySectionRef}
              id="pay-invoice-options"
              className="border-gray-200 scroll-mt-24"
            >
              <CardHeader>
                <CardTitle className="text-lg">Pay this invoice</CardTitle>
                <CardDescription>
                  {paystackEnabled && directMoMo
                    ? 'Use the Pay button for mobile money, or pay with card / Paystack MoMo below. Paystack opens on their secure page.'
                    : paystackEnabled
                      ? 'You’ll complete card or mobile money on Paystack’s secure page (no card data is entered on this site).'
                      : directMoMo
                        ? 'Use the Pay button above to open mobile money payment.'
                        : 'Payment options for this invoice.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                {!paystackEnabled && !directMoMo && (
                  <p className="text-sm text-gray-600">
                    Online payment is not set up for this business yet. Please contact them to arrange payment.
                  </p>
                )}

                {directMoMo && paystackEnabled && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-brand-25 bg-brand-5">
                    <Smartphone className="h-8 w-8 text-brand shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Mobile money (direct)</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Same flow as the Pay button — open the MoMo dialog if you scrolled here first.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-brand-40"
                      onClick={() => {
                        setError(null);
                        setMomoPayModalOpen(true);
                      }}
                    >
                      Pay with MoMo
                    </Button>
                  </div>
                )}

                {directMoMo && !paystackEnabled && (
                  <p className="text-sm text-gray-600">
                    Tap <strong>Pay ₵ {balance.toFixed(2)}</strong> above to pay with mobile money.
                  </p>
                )}

                {paystackEnabled && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-gray-700" />
                      <span className="font-semibold text-gray-900">Paystack</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Card or Paystack mobile money — you’ll choose on Paystack’s page. We only collect email here so Paystack
                      can send your receipt; actual payment happens on checkout.paystack.com.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        runPaystackCheckout();
                      }}
                      className="flex flex-col gap-3"
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Label htmlFor="paystackEmail" className="text-xs">
                            Your email (required)
                          </Label>
                          <Input
                            id="paystackEmail"
                            type="email"
                            required
                            value={form.customerEmail}
                            onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                            placeholder="you@example.com"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="paystackMobile" className="text-xs">
                            Mobile for receipt (optional)
                          </Label>
                          <Input
                            id="paystackMobile"
                            type="tel"
                            inputMode="numeric"
                            value={form.mobileNumber}
                            onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                            placeholder="0XX XXX XXXX"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          disabled={paystackLoading || balance <= 0}
                          className="w-full sm:w-auto bg-brand hover:bg-brand-dark text-white"
                        >
                          {paystackLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Redirecting…
                            </>
                          ) : (
                            `Pay ₵ ${balance.toFixed(2)} with Paystack`
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
