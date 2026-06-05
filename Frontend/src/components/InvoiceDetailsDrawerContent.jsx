import { useState, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Briefcase,
  Package,
  CircleDollarSign,
  Info,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import DrawerSectionCard from './DrawerSectionCard';
import StatusChip from './StatusChip';
import { cn } from '@/lib/utils';

const ITEMS_PREVIEW_COUNT = 3;

const isCancelledInvoice = (invoice) => Boolean(
  String(invoice?.status || '').toLowerCase() === 'cancelled' ||
  invoice?.cancelledAt ||
  invoice?.canceledAt ||
  invoice?.isCancelled ||
  invoice?.isCanceled ||
  invoice?.metadata?.cancelled ||
  invoice?.metadata?.canceled
);

const getInvoiceDisplayStatus = (invoice) => (
  isCancelledInvoice(invoice) ? 'cancelled' : invoice?.status
);

/**
 * Label/value row for invoice detail drawer section cards.
 */
function DrawerFieldRow({ label, children, className, valueClassName }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-gray-100 py-2.5 last:border-b-0',
        className
      )}
    >
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className={cn('min-w-0 text-right text-sm font-medium text-foreground', valueClassName)}>
        {children}
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  return `₵ ${parseFloat(amount || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return dayjs(value).format('MMMM D, YYYY');
}

/**
 * Mobile-first invoice details layout for DetailsDrawer (section cards per design mock).
 * @param {{ invoice: object, showJobDetails?: boolean }} props
 */
function InvoiceDetailsDrawerContent({ invoice, showJobDetails = true }) {
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const items = invoice?.items || [];
  const hasMoreItems = items.length > ITEMS_PREVIEW_COUNT;

  useEffect(() => {
    setItemsExpanded(false);
  }, [invoice?.id]);

  const toggleItemsExpanded = useCallback(() => {
    setItemsExpanded((prev) => !prev);
  }, []);

  if (!invoice) return null;

  const showTax = parseFloat(invoice.taxAmount || 0) > 0;
  const showDiscount = parseFloat(invoice.discountAmount || 0) > 0;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      <DrawerSectionCard title="Overview" titleStyle="uppercase" cardVariant="white">
        <DrawerFieldRow label="Invoice Number" valueClassName="font-semibold">
          {invoice.invoiceNumber}
        </DrawerFieldRow>
        <DrawerFieldRow label="Status">
          <StatusChip status={getInvoiceDisplayStatus(invoice)} />
        </DrawerFieldRow>
        <DrawerFieldRow label="Invoice Date">{formatDate(invoice.invoiceDate)}</DrawerFieldRow>
        <DrawerFieldRow label="Due Date">{formatDate(invoice.dueDate)}</DrawerFieldRow>
        <DrawerFieldRow label="Payment Terms">{invoice.paymentTerms || '—'}</DrawerFieldRow>
      </DrawerSectionCard>

      <DrawerSectionCard title="Bill To" titleStyle="uppercase" cardVariant="white">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{invoice.customer?.name || '—'}</p>
          {invoice.customer?.company && (
            <p className="text-sm text-foreground">{invoice.customer.company}</p>
          )}
          {invoice.customer?.email && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <span className="break-all">{invoice.customer.email}</span>
            </p>
          )}
          {invoice.customer?.phone && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
              <span>{invoice.customer.phone}</span>
            </p>
          )}
        </div>
      </DrawerSectionCard>

      {showJobDetails && (invoice.job?.jobNumber || invoice.job?.title) && (
        <DrawerSectionCard
          title="Job Details"
          titleStyle="uppercase"
          cardVariant="white"
          icon={<Briefcase className="h-4 w-4 text-brand" aria-hidden />}
        >
          {invoice.job?.jobNumber && (
            <DrawerFieldRow label="Job Number" valueClassName="font-semibold">
              {invoice.job.jobNumber}
            </DrawerFieldRow>
          )}
          {invoice.job?.title && (
            <DrawerFieldRow label="Job Title">{invoice.job.title}</DrawerFieldRow>
          )}
        </DrawerSectionCard>
      )}

      <DrawerSectionCard
        title="Invoice Items"
        titleStyle="uppercase"
        cardVariant="white"
        icon={<Package className="h-4 w-4 text-brand" aria-hidden />}
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((item, index) => {
                if (!itemsExpanded && hasMoreItems && index >= ITEMS_PREVIEW_COUNT) {
                  return null;
                }
                const lineTotal = parseFloat(item.total || item.unitPrice * (item.quantity || 1) || 0);
                return (
                  <li
                    key={item.id ?? `${item.description}-${index}`}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
                  >
                    <div className="flex min-w-0 gap-2">
                      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm text-foreground">
                        {item.description || item.category || 'Item'}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {hasMoreItems && (
              <button
                type="button"
                onClick={toggleItemsExpanded}
                className="mt-2 flex w-full items-center justify-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                {itemsExpanded ? (
                  <>
                    Show less
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </>
                ) : (
                  <>
                    View All Items ({items.length})
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Payment Summary"
        titleStyle="uppercase"
        cardVariant="white"
        icon={<CircleDollarSign className="h-4 w-4 text-brand" aria-hidden />}
      >
        <DrawerFieldRow label="Subtotal">{formatCurrency(invoice.subtotal)}</DrawerFieldRow>
        {showDiscount && (
          <DrawerFieldRow label="Discount" valueClassName="text-green-600">
            -{formatCurrency(invoice.discountAmount)}
          </DrawerFieldRow>
        )}
        {showTax && (
          <DrawerFieldRow label="Tax">{formatCurrency(invoice.taxAmount)}</DrawerFieldRow>
        )}
        <DrawerFieldRow label="Amount Paid" valueClassName="font-semibold text-green-600">
          {formatCurrency(invoice.amountPaid)}
        </DrawerFieldRow>
        <DrawerFieldRow
          label="Balance Due"
          className="border-t border-gray-200 pt-3 mt-1"
          valueClassName="text-base font-bold text-orange-500"
        >
          {formatCurrency(invoice.balance)}
        </DrawerFieldRow>
      </DrawerSectionCard>

      <DrawerSectionCard
        title="Additional Information"
        titleStyle="uppercase"
        cardVariant="white"
        icon={<Info className="h-4 w-4 text-brand" aria-hidden />}
      >
        <DrawerFieldRow label="Notes">{invoice.notes?.trim() ? invoice.notes : '—'}</DrawerFieldRow>
        <DrawerFieldRow label="Sent Date">{formatDate(invoice.sentDate)}</DrawerFieldRow>
        <DrawerFieldRow label="Paid Date">{formatDate(invoice.paidDate)}</DrawerFieldRow>
        <DrawerFieldRow label="Created At">
          {invoice.createdAt
            ? dayjs(invoice.createdAt).format('MMMM D, YYYY h:mm A')
            : '—'}
        </DrawerFieldRow>
      </DrawerSectionCard>
    </div>
  );
}

export default InvoiceDetailsDrawerContent;
