import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Loader2, Mail, MapPin, PackageCheck, ShieldCheck, ShoppingBag, Star, Truck, X } from 'lucide-react';

import AccountLayout from '../components/storefront/AccountLayout';
import ConfirmReceivedModal from '../components/storefront/ConfirmReceivedModal';
import DeliveryProgressTimeline from '../components/storefront/DeliveryProgressTimeline';
import { VerifiedReviewForm } from '../components/storefront/VerifiedReviewSection';
import { EmptyState } from '../components/storefront/StorefrontLayout';
import storeService from '../services/storeService';
import { showError, showSuccess } from '../utils/toast';
import { resolveImageUrl } from '../utils/fileUtils';
import { formatAmount } from '../utils/formatNumber';
import { getOrderStatusLabel } from './ShopperOrdersPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getTradeAssuranceCopy = (order) => {
  const status = order?.tradeAssurance?.paymentStatus;
  if (status === 'released') return 'Payment has been released to the seller after delivery confirmation.';
  if (status === 'refunded' || order?.status === 'refunded') return 'A refund has been recorded for this order.';
  if (status === 'disputed') return 'Sabito is holding payment while the issue is reviewed.';
  if (order?.status === 'cancelled' || order?.orderStatus === 'cancelled') return 'This order was cancelled before payment could be released to the seller.';
  return 'Sabito holds your payment and releases it to the seller after you confirm receipt or the delivery confirmation window ends.';
};

const getDeliveryTracking = (order) => order?.deliveryTracking || {
  currentLabel: (order?.deliveryStatus || order?.orderStatus || 'Processing').replace(/_/g, ' '),
  timeline: order?.deliveryTimeline || [],
  canConfirmReceived: false,
};

const formatDeliveryAddressLocation = (address = {}) => (
  [address.city, address.region].filter(Boolean).join(', ')
);

const formatDeliveryAddressLines = (address = {}) => (
  [address.line1 || address.address, address.line2].filter(Boolean)
);

const ShopperOrderDetailPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [issue, setIssue] = useState({ reason: 'Item problem', message: '' });
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [showDeliveryTimeline, setShowDeliveryTimeline] = useState(false);
  const [activeProductReview, setActiveProductReview] = useState(null);

  const loadOrder = useCallback(async () => {
    const response = await storeService.getStorefrontOrder(id);
    setOrder(response?.data?.order || response?.order || null);
  }, [id]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadOrder()
      .catch((error) => {
        if (mounted) showError(error, 'Could not load this order.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [loadOrder]);

  const handleConfirmReceived = useCallback(async (payload) => {
    setActionLoading('confirm');
    try {
      const response = await storeService.confirmStorefrontOrderReceived(order.id, payload);
      setOrder(response?.data?.order || response?.order || order);
      setIsConfirmModalOpen(false);
      showSuccess(response?.message || response?.data?.message || 'Order marked as received.');
    } catch (error) {
      showError(error, 'Could not confirm this order.');
    } finally {
      setActionLoading('');
    }
  }, [order]);

  const handleConfirmMismatch = useCallback(() => {
    setIsConfirmModalOpen(false);

    if (order?.dispute?.status === 'open') {
      showError('An issue is already open for this order. Receipt has not been confirmed.');
      return;
    }

    setIssue((current) => ({
      ...current,
      reason: 'Items do not match order',
    }));
    setIsIssueModalOpen(true);
  }, [order?.dispute?.status]);

  const handleOpenIssue = useCallback(async (event) => {
    event.preventDefault();
    setActionLoading('issue');
    try {
      const response = await storeService.openStorefrontOrderDispute(order.id, issue);
      setOrder(response?.data?.order || response?.order || order);
      setIssue((current) => ({ ...current, message: '' }));
      setIsIssueModalOpen(false);
      showSuccess('Issue reported for seller review.');
    } catch (error) {
      showError(error, 'Could not report this issue.');
    } finally {
      setActionLoading('');
    }
  }, [issue, order]);

  const handleContactSeller = useCallback(async (event) => {
    event.preventDefault();
    setActionLoading('contact');
    try {
      await storeService.contactStorefrontOrderSeller(order.id, { message: supportMessage });
      setSupportMessage('');
      setIsContactModalOpen(false);
      showSuccess('Seller support request sent.');
    } catch (error) {
      showError(error, 'Could not contact the seller.');
    } finally {
      setActionLoading('');
    }
  }, [order, supportMessage]);

  const handleSubmitProductReview = useCallback(async (payload) => {
    if (!activeProductReview?.listingId) return;

    setActionLoading(`review-${activeProductReview.saleItemId}`);
    try {
      console.info('[reviews] submitting product review from order detail', {
        orderId: order.id,
        saleId: activeProductReview.saleId || order.id,
        saleItemId: activeProductReview.saleItemId,
        listingId: activeProductReview.listingId,
        productId: activeProductReview.productId,
        rating: payload?.rating,
        hasTitle: Boolean(payload?.title),
        hasComment: Boolean(payload?.comment),
      });
      await storeService.submitProductReview(activeProductReview.listingId, {
        ...payload,
        saleId: activeProductReview.saleId || order.id,
      });
      console.info('[reviews] product review saved from order detail', {
        orderId: order.id,
        saleId: activeProductReview.saleId || order.id,
        saleItemId: activeProductReview.saleItemId,
        listingId: activeProductReview.listingId,
      });
      showSuccess('Product review saved.');
      setActiveProductReview(null);
      await loadOrder();
    } catch (error) {
      console.error('[reviews] product review from order detail failed', {
        orderId: order?.id || null,
        saleId: activeProductReview.saleId || order?.id || null,
        saleItemId: activeProductReview.saleItemId,
        listingId: activeProductReview.listingId,
        status: error?.response?.status,
        errorCode: error?.response?.data?.errorCode,
        message: error?.response?.data?.message || error?.message,
      });
      showError(error, 'Could not save your review.');
    } finally {
      setActionLoading('');
    }
  }, [activeProductReview, loadOrder, order]);

  const deliveryTracking = getDeliveryTracking(order);
  const canConfirm = order && deliveryTracking.canConfirmReceived === true;
  const reviewActions = order?.reviewActions || {};
  const storeReviewPath = reviewActions.store?.storeSlug
    ? `/stores/${encodeURIComponent(reviewActions.store.storeSlug)}#reviews`
    : null;

  return (
    <AccountLayout
      title="Order detail"
      description="Review items, delivery information, and support actions for this order."
    >
      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 sm:rounded-[2rem]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading order...
        </div>
      ) : !order ? (
        <EmptyState
          icon={ShoppingBag}
          title="Order not found"
          description="This order may not exist or may not belong to your shopper account."
          action={<Button asChild className="rounded-full bg-green-700 hover:bg-green-800"><Link to="/account/orders">Back to orders</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">{order.storeName}</p>
                <h2 className="mt-2 break-words text-2xl font-black text-slate-950 sm:text-3xl">{order.saleNumber}</h2>
                <p className="mt-2 text-sm text-slate-500">Placed {formatDateTime(order.createdAt)}</p>
              </div>
              <Badge variant="outline" className="max-w-full border-green-100 bg-green-50 capitalize text-green-800">
                {getOrderStatusLabel(order)}
              </Badge>
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 min-[480px]:grid-cols-3 sm:mt-6 sm:rounded-3xl">
              <TotalLine label="Subtotal" value={formatAmount(order.subtotal, order.currency)} />
              <TotalLine label="Delivery" value={formatAmount(order.deliveryFee, order.currency)} />
              <TotalLine label="Total" value={formatAmount(order.total, order.currency)} strong />
            </div>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-green-900 min-[420px]:flex-row sm:rounded-3xl">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-green-800">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Sabito Trade Assurance</p>
                <p className="mt-2 text-sm leading-6">{getTradeAssuranceCopy(order)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                  <Truck className="h-5 w-5 text-green-700" />
                  Delivery progress
                </h3>
                <p className="mt-2 text-sm text-slate-500">Seller updates in ABS appear here when you refresh this order.</p>
              </div>
              <Badge variant="outline" className="max-w-full border-green-100 bg-green-50 capitalize text-green-800">
                {deliveryTracking.currentLabel}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-5 w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 sm:w-auto"
              onClick={() => setShowDeliveryTimeline((current) => !current)}
            >
              {showDeliveryTimeline ? 'Hide timeline' : 'View delivery timeline'}
            </Button>
            {showDeliveryTimeline ? (
              <div className="mt-5">
                <DeliveryProgressTimeline timeline={deliveryTracking.timeline || []} />
              </div>
            ) : null}
            {(deliveryTracking.courier || deliveryTracking.trackingNumber || deliveryTracking.notes) ? (
              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 min-[480px]:grid-cols-3 sm:rounded-3xl">
                <TotalLine label="Courier" value={deliveryTracking.courier || 'Not provided'} />
                <TotalLine label="Tracking no." value={deliveryTracking.trackingNumber || 'Not provided'} />
                <TotalLine label="Notes" value={deliveryTracking.notes || 'No notes'} />
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
              <h3 className="text-xl font-black text-slate-950">Items</h3>
              <div className="mt-4 grid gap-3">
                {(order.items || []).map((item) => {
                  const itemImageUrl = resolveImageUrl(item.imageUrl);
                  return (
                    <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-3 min-[420px]:flex-row sm:rounded-3xl sm:p-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 max-[419px]:h-24 max-[419px]:w-full">
                        {itemImageUrl ? (
                          <img src={itemImageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950">{item.name}</p>
                            <p className="mt-1 text-sm text-slate-500">Qty {item.quantity} {item.sku ? `- SKU ${item.sku}` : ''}</p>
                          </div>
                          <p className="shrink-0 font-black text-green-800 sm:text-right">{formatAmount(item.total, order.currency)}</p>
                        </div>
                        {(() => {
                          const action = (reviewActions.products || []).find((candidate) => candidate.saleItemId === item.id);
                          if (!action) return null;
                          if (action.reviewed) {
                            return <p className="mt-3 inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold text-green-800"><Star className="mr-1 h-3.5 w-3.5 fill-current" /> Product reviewed</p>;
                          }
                          if (!action.canReview || !action.listingId || !order.storeSlug) return null;
                          const isReviewOpen = activeProductReview?.saleItemId === action.saleItemId;
                          return (
                            <div className="mt-3 grid gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50 min-[420px]:w-fit"
                                onClick={() => {
                                  const nextReview = {
                                    ...action,
                                    name: item.name,
                                    saleId: action.saleId || order.id,
                                  };
                                  console.info('[reviews] product review form opened from order', {
                                    orderId: order.id,
                                    saleId: nextReview.saleId,
                                    saleItemId: action.saleItemId,
                                    listingId: action.listingId,
                                    productId: action.productId,
                                  });
                                  setActiveProductReview((current) => (
                                    current?.saleItemId === action.saleItemId ? null : nextReview
                                  ));
                                }}
                              >
                                <Star className="mr-2 h-4 w-4" />
                                {isReviewOpen ? 'Close review form' : 'Review product'}
                              </Button>
                              {isReviewOpen ? (
                                <VerifiedReviewForm
                                  eligibility={{
                                    eligible: true,
                                    saleId: action.saleId || order.id,
                                    saleItemId: action.saleItemId,
                                    target: {
                                      title: item.name,
                                      listingId: action.listingId,
                                      productId: action.productId,
                                    },
                                  }}
                                  isAuthenticated
                                  isSubmitting={actionLoading === `review-${action.saleItemId}`}
                                  onSubmit={handleSubmitProductReview}
                                  targetLabel={item.name}
                                />
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
                <h3 className="inline-flex items-center gap-2 text-xl font-black text-slate-950">
                  <MapPin className="h-5 w-5 text-green-700" />
                  Delivery information
                </h3>
                {order.deliveryAddress ? (
                  <div className="mt-4 min-w-0 text-sm leading-6 text-slate-600">
                    <p className="font-bold text-slate-900">{order.deliveryAddress.recipientName || 'Recipient'}</p>
                    <p>{order.deliveryAddress.phone}</p>
                    {formatDeliveryAddressLines(order.deliveryAddress).map((line) => <p key={line} className="break-words">{line}</p>)}
                    {formatDeliveryAddressLocation(order.deliveryAddress) ? <p className="break-words">{formatDeliveryAddressLocation(order.deliveryAddress)}</p> : null}
                    {order.deliveryAddress.deliveryNotes ? <p className="mt-2 text-slate-500">{order.deliveryAddress.deliveryNotes}</p> : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Pickup order. Seller pickup details are handled by the store.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-[2rem] sm:p-6">
                <h3 className="text-xl font-black text-slate-950">Order actions</h3>
                {!order.confirmedReceivedAt && deliveryTracking.currentStatus === 'delivered' ? (
                  <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900 sm:rounded-3xl">
                    Your seller marked this order delivered. Confirm receipt to make the held payout eligible for release.
                  </div>
                ) : null}
                {!order.confirmedReceivedAt && deliveryTracking.currentStatus !== 'delivered' ? (
                  <p className="mt-4 text-sm text-slate-500">You can confirm receipt after the seller marks this order delivered.</p>
                ) : null}
                <div className="mt-4 grid gap-3">
                  {storeReviewPath ? (
                    reviewActions.store?.reviewed ? (
                      <p className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
                        <Star className="mr-2 h-4 w-4 fill-current" />
                        Store reviewed
                      </p>
                    ) : reviewActions.store?.canReview ? (
                      <Button asChild variant="outline" className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50">
                        <Link to={storeReviewPath}>
                          <Star className="mr-2 h-4 w-4" />
                          Review store
                        </Link>
                      </Button>
                    ) : null
                  ) : null}
                  {reviewActions.reason && !reviewActions.eligible ? (
                    <p className="text-xs text-slate-500">{reviewActions.reason}</p>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full rounded-full bg-green-700 hover:bg-green-800"
                    disabled={!canConfirm || actionLoading === 'confirm' || Boolean(order.confirmedReceivedAt)}
                    onClick={() => setIsConfirmModalOpen(true)}
                  >
                    {actionLoading === 'confirm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                    {order.confirmedReceivedAt ? 'Received confirmed' : 'Confirm received'}
                  </Button>
                  {order.confirmedReceivedAt ? (
                    <p className="text-xs text-green-700">Confirmed {formatDateTime(order.confirmedReceivedAt)}</p>
                  ) : null}
                  <div className="grid gap-2 border-t border-slate-200 pt-3 min-[480px]:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                      disabled={order.dispute?.status === 'open'}
                      onClick={() => setIsIssueModalOpen(true)}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      {order.dispute?.status === 'open' ? 'Issue open' : 'Report issue'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full border-green-200 text-green-800 hover:bg-green-50"
                      onClick={() => setIsContactModalOpen(true)}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Contact seller
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {isIssueModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-3 py-4 sm:items-center sm:px-6" role="dialog" aria-modal="true" aria-labelledby="report-issue-modal-title">
          <form onSubmit={handleOpenIssue} className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 sm:rounded-[2rem] sm:p-6">
            <button
              type="button"
              onClick={() => setIsIssueModalOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Close report issue form"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-3 pr-12">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Report issue</p>
                <h2 id="report-issue-modal-title" className="mt-1 text-xl font-black text-slate-950">Tell us what happened</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              <Input
                value={issue.reason}
                onChange={(event) => setIssue((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Issue type"
                required
              />
              <textarea
                value={issue.message}
                onChange={(event) => setIssue((current) => ({ ...current, message: event.target.value }))}
                placeholder="Describe what happened"
                className="min-h-32 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-400"
                required
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 sm:w-auto" onClick={() => setIsIssueModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="w-full rounded-full bg-amber-600 text-white hover:bg-amber-700 sm:w-auto" disabled={actionLoading === 'issue' || order?.dispute?.status === 'open'}>
                {actionLoading === 'issue' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Open dispute
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmReceivedModal
        isOpen={isConfirmModalOpen}
        isSubmitting={actionLoading === 'confirm'}
        orderNumber={order?.saleNumber}
        onClose={() => setIsConfirmModalOpen(false)}
        onReportIssue={handleConfirmMismatch}
        onSubmit={handleConfirmReceived}
      />

      {isContactModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 px-3 py-4 sm:items-center sm:px-6" role="dialog" aria-modal="true" aria-labelledby="contact-seller-modal-title">
          <form onSubmit={handleContactSeller} className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-green-200 bg-white p-5 sm:rounded-[2rem] sm:p-6">
            <button
              type="button"
              onClick={() => setIsContactModalOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label="Close contact seller form"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-3 pr-12">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 text-green-800">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Contact seller</p>
                <h2 id="contact-seller-modal-title" className="mt-1 text-xl font-black text-slate-950">Send a support request</h2>
              </div>
            </div>
            <textarea
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              placeholder="Ask the seller about delivery, pickup, or product details"
              className="mt-5 min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-400"
            />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 sm:w-auto" onClick={() => setIsContactModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="w-full rounded-full bg-green-700 hover:bg-green-800 sm:w-auto" disabled={actionLoading === 'contact'}>
                {actionLoading === 'contact' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send request
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </AccountLayout>
  );
};

const TotalLine = ({ label, value, strong = false }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 break-words ${strong ? 'text-2xl' : 'text-lg'} font-black text-slate-950`}>{value}</p>
  </div>
);

export default ShopperOrderDetailPage;
