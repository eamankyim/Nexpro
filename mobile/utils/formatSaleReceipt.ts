import { formatCurrency, formatDecimal } from '@/utils/formatCurrency';

type SaleItem = {
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  totalPrice?: number;
  product?: { name?: string };
};

type SaleReceiptInput = {
  saleNumber?: string;
  createdAt?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  amountPaid?: number;
  change?: number;
  paymentMethod?: string;
  customer?: { name?: string; phone?: string; email?: string };
  shop?: { name?: string; address?: string; phone?: string; email?: string };
  studioLocation?: { name?: string; address?: string; phone?: string; email?: string };
  seller?: { name?: string };
  tenantName?: string;
  items?: SaleItem[];
};

function money(value: number | string | null | undefined): string {
  return formatCurrency(value);
}

function numberValue(value: number | string | null | undefined): number {
  return typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(value?: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function divider(char = '-', width = 38): string {
  return char.repeat(width);
}

function row(label: string, value: string, width = 38): string {
  const left = label.trim();
  const right = value.trim();
  const spaces = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(spaces)}${right}`;
}

function center(value: string, width = 38): string {
  const text = value.trim();
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return `${' '.repeat(left)}${text}`;
}

function itemQuantity(value: number | string | null | undefined): string {
  const qty = numberValue(value);
  return Number.isInteger(qty) ? String(qty) : formatDecimal(qty, 2).replace(/\.?0+$/, '');
}

/**
 * Plain-text receipt for Share sheet / WhatsApp / SMS previews.
 */
export function formatSaleReceiptText(sale: SaleReceiptInput): string {
  const message: string[] = [];
  const receipt: string[] = [];
  const business = sale.shop?.name || sale.studioLocation?.name || sale.tenantName || 'Receipt';
  const location = sale.shop || sale.studioLocation;
  const customerName = sale.customer?.name?.trim() || 'Walk-in customer';
  const subtotal = sale.subtotal ?? (sale.items || []).reduce((sum, item) => {
    const qty = numberValue(item.quantity ?? 1);
    return sum + numberValue(item.subtotal ?? qty * numberValue(item.unitPrice));
  }, 0);
  const discount = numberValue(sale.discount);
  const tax = numberValue(sale.tax);
  const total = numberValue(sale.total);
  const paid = numberValue(sale.amountPaid);
  const balance = Math.max(0, total - paid);

  message.push(`Hello ${customerName}, here is your receipt${business ? ` from ${business}` : ''}.`);
  message.push('');

  receipt.push(center(business.toUpperCase()));
  if (location?.address) receipt.push(center(location.address));
  if (location?.phone) receipt.push(center(`Tel: ${location.phone}`));
  if (location?.email) receipt.push(center(location.email));
  receipt.push(divider('='));
  receipt.push(center('SALES RECEIPT'));
  receipt.push(divider('='));
  if (sale.saleNumber) receipt.push(row('Receipt No.', sale.saleNumber));
  const dateText = formatDateTime(sale.createdAt);
  if (dateText) receipt.push(row('Date', dateText));
  if (sale.seller?.name) receipt.push(row('Served by', sale.seller.name));
  receipt.push(row('Customer', customerName));
  if (sale.customer?.phone) receipt.push(row('Phone', sale.customer.phone));
  receipt.push('');

  receipt.push('ITEMS');
  receipt.push(divider());
  if ((sale.items || []).length === 0) {
    receipt.push('No items listed');
  }
  (sale.items || []).forEach((item, index) => {
    const qty = itemQuantity(item.quantity ?? 1);
    const name = (item.name || item.product?.name || 'Item').trim();
    const unitPrice = numberValue(item.unitPrice);
    const lineTotal =
      item.total ??
      item.totalPrice ??
      numberValue(item.quantity ?? 1) * unitPrice;
    receipt.push(`${index + 1}. ${name}`);
    if (item.sku) receipt.push(`   SKU: ${item.sku}`);
    receipt.push(row(`   ${qty} x ${money(unitPrice)}`, money(lineTotal)));
  });

  receipt.push(divider());
  receipt.push(row('Subtotal', money(subtotal)));
  if (discount > 0) {
    receipt.push(row('Discount', `-${money(discount)}`));
  }
  if (tax > 0) {
    receipt.push(row('Tax', money(tax)));
  }
  receipt.push(row('TOTAL', money(total)));
  receipt.push(divider('='));
  if (paid > 0) {
    receipt.push(row('Paid', money(paid)));
  }
  if (balance > 0.009) {
    receipt.push(row('Balance', money(balance)));
  }
  if (sale.change != null && Number(sale.change) > 0) {
    receipt.push(row('Change', money(sale.change)));
  }
  if (sale.paymentMethod) {
    receipt.push(row('Payment', titleCase(sale.paymentMethod)));
  }
  receipt.push(divider('='));
  receipt.push(center('Thank you for your purchase!'));

  message.push('```');
  message.push(...receipt);
  message.push('```');
  return message.join('\n');
}
