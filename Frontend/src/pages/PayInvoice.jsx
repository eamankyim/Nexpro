/**
 * Public page: view and pay an invoice via payment link (no login).
 * Route: /pay-invoice/:token
 * API: GET /api/public/invoices/:token, POST /api/public/invoices/:token/pay,
 *      POST /api/public/invoices/:token/initialize-paystack (Paystack)
 */
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2, CheckCircle, CreditCard } from 'lucide-react';

export default function PayInvoice() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const fromPaystack = searchParams.get('paystack') === '1';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'mobile_money',
    referenceNumber: '',
    customerEmail: '',
    customerName: ''
  });

  const fetchInvoice = () => {
    if (!token) return Promise.resolve();
    const url = `${API_BASE_URL}/api/public/invoices/${token}?_=${Date.now()}`;
    return fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Invoice not found or link expired' : 'Failed to load invoice');
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data) {
          setInvoice(data.data);
          const balance = parseFloat(data.data.balance ?? data.data.totalAmount ?? 0);
          const customerEmail = data.data.customer?.email || '';
          setForm((f) => ({
            ...f,
            amount: balance > 0 ? balance.toString() : '',
            customerEmail: f.customerEmail || customerEmail
          }));
        } else {
          setError('Invoice not found');
        }
      })
      .catch((err) => setError(err.message || 'Something went wrong'));
  };

  useEffect(() => {
    if (!token) {
      setError('Invalid payment link');
      setLoading(false);
      return;
    }
    fetchInvoice().finally(() => setLoading(false));
  }, [token]);

  // After return from Paystack, refetch invoice to show updated status
  useEffect(() => {
    if (!fromPaystack || !invoice || loading) return;
    const t = setTimeout(() => fetchInvoice(), 2500);
    return () => clearTimeout(t);
  }, [fromPaystack, invoice?.id, loading]);

  const handlePaystack = async (e) => {
    e.preventDefault();
    const email = (form.customerEmail || '').trim();
    if (!email) {
      setError('Email is required to pay with card or mobile money.');
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
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not start payment');
      if (data.success && data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
        return;
      }
      throw new Error(data.message || 'Could not start payment');
    } catch (err) {
      setError(err.message || 'Could not start payment');
    } finally {
      setPaystackLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoice || !token || parseFloat(form.amount) <= 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const url = `${API_BASE_URL}/api/public/invoices/${token}/pay`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          paymentMethod: form.paymentMethod || 'mobile_money',
          referenceNumber: form.referenceNumber || undefined,
          customerEmail: form.customerEmail || undefined,
          customerName: form.customerName || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      if (data.success) {
        setPaid(true);
        setInvoice(data.data?.invoice || invoice);
      } else {
        throw new Error(data.message || 'Payment failed');
      }
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#166534] mx-auto mb-4" />
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-8 w-8 text-[#166534]" />
          <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{invoice?.tenant?.name || 'Invoice'}</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {invoice?.invoiceNumber} · Due {invoice?.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice?.items?.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                <ul className="space-y-1 text-sm text-gray-600">
                  {invoice.items.map((item, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{item.description || item.name || 'Item'}</span>
                      <span>₵ {parseFloat(item.amount ?? item.total ?? 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold border-t pt-4">
              <span>Total</span>
              <span>₵ {parseFloat(invoice?.totalAmount ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Amount paid</span>
              <span>₵ {parseFloat(invoice?.amountPaid ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-[#166534]">
              <span>Balance due</span>
              <span>₵ {balance.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {paid || isFullyPaid ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-2">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <p className="font-semibold text-gray-900">Thank you. This invoice is paid.</p>
              <p className="text-sm text-gray-600">You can close this page.</p>
            </CardContent>
          </Card>
        ) : fromPaystack ? (
          <Card className="border-[#166534]/30 bg-green-50/50">
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-[#166534]" />
              <p className="font-semibold text-gray-900">Payment submitted</p>
              <p className="text-sm text-gray-600">Confirming your payment. This page will update when the payment is confirmed.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pay this invoice</CardTitle>
              <p className="text-sm text-gray-500">Pay with card or mobile money (Paystack), or record a payment you already made.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
              )}

              {/* Pay with Paystack */}
              <div className="rounded-lg border border-[#166534]/30 bg-[#166534]/5 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#166534]" />
                  <span className="font-semibold text-gray-900">Pay with Card or Mobile Money</span>
                </div>
                <p className="text-sm text-gray-600">You will be redirected to a secure payment page. Card and mobile money (MoMo) accepted.</p>
                <form onSubmit={handlePaystack} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Label htmlFor="paystackEmail" className="text-xs">Your email (required)</Label>
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
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={paystackLoading || balance <= 0}
                      className="w-full sm:w-auto bg-[#166534] hover:bg-[#14532d]"
                    >
                      {paystackLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        'Pay ₵ ' + balance.toFixed(2)
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase text-gray-500">
                  <span className="bg-white px-2">Or record payment manually</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount (₵) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentMethod">Payment method</Label>
                  <select
                    id="paymentMethod"
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="mobile_money">Mobile Money</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="referenceNumber">Reference / transaction ID (optional)</Label>
                  <Input
                    id="referenceNumber"
                    value={form.referenceNumber}
                    onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                    placeholder="e.g. MTN ref or bank ref"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customerName">Your name (optional)</Label>
                  <Input
                    id="customerName"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Your email (optional)</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || parseFloat(form.amount) <= 0}
                  className="w-full bg-[#166534] hover:bg-[#14532d]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Confirm payment'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
