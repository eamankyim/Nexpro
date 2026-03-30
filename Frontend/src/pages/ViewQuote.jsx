/**
 * Public page: view a quote via link (no login).
 * Route: /view-quote/:token
 * API: GET /api/public/quotes/view/:token
 * Customers can view, print, download PDF, and respond (Accept / Reject / Comment).
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import PrintableQuote from '../components/PrintableQuote';
import { FileText, Printer, Download, Loader2, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { generatePDF } from '../utils/pdfUtils';

export default function ViewQuote() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [customerResponseSummary, setCustomerResponseSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [respondAction, setRespondAction] = useState(null);
  const [respondComment, setRespondComment] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [respondError, setRespondError] = useState(null);
  const [respondSuccess, setRespondSuccess] = useState(null);
  const [showCommentField, setShowCommentField] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }
    const url = `${API_BASE_URL}/api/public/quotes/view/${token}?_=${Date.now()}`;
    fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache' } })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Quote not found or link has expired' : 'Failed to load quote');
        return res.json();
      })
      .then((data) => {
        if (data.success && data.data) {
          setQuote(data.data.quote);
          setOrganization(data.data.organization || {});
          setCustomerResponseSummary(data.data.customerResponseSummary || null);
        } else {
          setError('Quote not found');
        }
      })
      .catch((err) => setError(err.message || 'Something went wrong'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.querySelector('.printable-quote');
    if (!element) return;
    setDownloading(true);
    try {
      await generatePDF(element, {
        filename: `Quote-${quote?.quoteNumber || 'quote'}.pdf`,
        format: 'a4',
        orientation: 'portrait'
      });
    } catch (e) {
      console.error('PDF download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  const canRespond = quote && ['draft', 'sent'].includes(quote.status);
  const handleRespond = async (action) => {
    if (!token || respondLoading) return;
    setRespondError(null);
    setRespondLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/quotes/view/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: respondComment.trim() || undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRespondError(data.message || 'Something went wrong');
        setRespondLoading(false);
        return;
      }
      setRespondSuccess(data.data?.message || 'Thank you.');
      if (data.data?.quote) setQuote(data.data.quote);
      setCustomerResponseSummary({ responded: true, lastAction: action });
      setRespondAction(null);
      setRespondComment('');
      setShowCommentField(false);
    } catch (e) {
      setRespondError(e.message || 'Request failed');
    } finally {
      setRespondLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-4" />
          <p className="text-muted-foreground">Loading quote…</p>
        </div>
      </div>
    );
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-foreground">Quote not available</h1>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">The link may be invalid or expired. Please contact the sender.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-[210mm] mx-auto p-4 pb-8">
        <div className="flex items-center justify-center gap-2 mb-4 print:hidden">
          <Button type="button" variant="outline" size="icon" onClick={handlePrint} title="Print" aria-label="Print">
            <Printer className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={handleDownloadPDF} disabled={downloading} title="Download PDF" aria-label="Download PDF">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </Button>
        </div>

        {(respondSuccess || customerResponseSummary) && (
          <div className="mb-4 p-4 rounded-lg border border-brand bg-[#f0fdf4] print:hidden">
            <p className="text-sm font-medium text-brand">
              {respondSuccess || (customerResponseSummary?.lastAction === 'comment' ? 'Your comment has been sent to the team.' : 'Your response has been sent.')}
            </p>
          </div>
        )}

        {canRespond && (
          <div className="mb-4 p-4 rounded-lg border border-border bg-card print:hidden">
            <p className="text-sm font-medium text-foreground mb-3">Respond to this quote</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                type="button"
                onClick={() => handleRespond('accept')}
                disabled={respondLoading}
                className="bg-brand hover:bg-brand-dark text-white"
              >
                {respondLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Accept quote
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRespond('reject')}
                disabled={respondLoading}
              >
                {respondLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCommentField((v) => !v)}
                disabled={respondLoading}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Add comment
              </Button>
            </div>
            {showCommentField && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment or question (optional for Accept/Reject)"
                  value={respondComment}
                  onChange={(e) => setRespondComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRespond('comment')}
                  disabled={respondLoading}
                >
                  Send comment only
                </Button>
              </div>
            )}
            {respondError && <p className="text-sm text-destructive mt-2">{respondError}</p>}
          </div>
        )}

        {(quote?.status === 'accepted' || quote?.status === 'declined') && !respondSuccess && (
          <div className="mb-4 p-4 rounded-lg border border-border bg-card print:hidden">
            <p className="text-sm text-muted-foreground">
              This quote has been {quote.status === 'accepted' ? 'accepted' : 'declined'}.
            </p>
          </div>
        )}

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <PrintableQuote quote={quote} organization={organization} />
        </div>
      </div>
    </div>
  );
}
