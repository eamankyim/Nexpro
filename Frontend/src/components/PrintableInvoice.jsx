import React from 'react';
import dayjs from 'dayjs';
import { MapPin, Phone, Globe, Mail } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const formatAddress = (address) => {
  if (!address) return '';
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country
  ].filter(Boolean);
  return parts.join('\n');
};

const getPrintStyles = (printConfig) => {
  const format = printConfig?.format || 'a4';
  const isThermal = format === 'thermal_58' || format === 'thermal_80';
  const pageWidth = format === 'thermal_58' ? '58mm' : format === 'thermal_80' ? '80mm' : 'A4';
  const contentWidth = format === 'thermal_58' ? '52mm' : format === 'thermal_80' ? '72mm' : '210mm';
  const showLogo = printConfig?.showLogo !== false && !isThermal;
  const fontSize = isThermal ? 'small' : (printConfig?.fontSize || 'normal');
  const titleSize = fontSize === 'small' ? '14px' : '32px';
  const bodySize = fontSize === 'small' ? '10px' : '12px';
  const tableSize = fontSize === 'small' ? '9px' : '11px';
  const grayscale = isThermal ? 'filter: grayscale(100%); -webkit-print-color-adjust: none; print-color-adjust: none;' : '';
  return { isThermal, showLogo, titleSize, bodySize, tableSize, grayscale, pageWidth, contentWidth, fontSize };
};

const PrintableInvoice = ({
  invoice,
  documentTitle = 'INVOICE',
  documentSubtitle,
  organization = {},
  /** When printing receipt from sale, pass saleNumber for Receipt # display */
  saleNumber,
  printConfig = {}
}) => {
  if (!invoice) return null;

  const titleText = documentTitle || 'INVOICE';
  const printStyles = getPrintStyles(printConfig);
  const isReceipt = titleText.toUpperCase() === 'RECEIPT';
  const docNumberLabel = isReceipt ? 'Receipt #' : 'Invoice #';
  const docNumber = isReceipt && (saleNumber || invoice.sale?.saleNumber)
    ? (saleNumber || invoice.sale.saleNumber)
    : invoice.invoiceNumber;

  // Format logo URL - data URLs (base64) and absolute URLs use as-is; relative paths get API base URL
  // Only use tenant logo; no generic fallback when none is set
  const logoSource = organization?.logoUrl
    ? (organization.logoUrl.startsWith('data:') || organization.logoUrl.startsWith('http')
        ? organization.logoUrl
        : (API_BASE_URL
            ? `${API_BASE_URL}${organization.logoUrl.startsWith('/') ? '' : '/'}${organization.logoUrl}`
            : organization.logoUrl))
    : null;

  const companyInfo = {
    name: organization.name || 'Company name',
    phone: organization.phone || '',
    website: organization.website || '',
    email: organization.email || '',
    location: formatAddress(organization.address),
    invoiceFooter: organization.invoiceFooter || '',
    vatNumber: organization.tax?.vatNumber || '',
    tin: organization.tax?.tin || ''
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${printStyles.pageWidth} auto;
            margin: ${printStyles.isThermal ? '2mm' : '10mm'};
          }
          
          .printable-invoice {
            width: 100% !important;
            max-width: ${printStyles.contentWidth} !important;
            padding: ${printStyles.isThermal ? '2mm' : '0'} !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            ${printStyles.grayscale}
            -webkit-print-color-adjust: ${printStyles.isThermal ? 'none' : 'exact'} !important;
            print-color-adjust: ${printStyles.isThermal ? 'none' : 'exact'} !important;
          }
          
          .invoice-header {
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          .items-table {
            page-break-inside: avoid;
          }
          .items-table thead {
            display: table-header-group;
          }
          .items-table tbody tr {
            page-break-inside: avoid;
          }
          .totals-section {
            page-break-inside: avoid;
          }
          .notes-section {
            page-break-inside: avoid;
          }
        }
        
        /* Screen styles */
        .printable-invoice {
          width: 100%;
          max-width: ${printStyles.contentWidth};
          padding: ${printStyles.isThermal ? '4mm' : '15mm'};
          margin: 0 auto;
          background: white;
          font-family: Arial, sans-serif;
          color: #000;
          box-sizing: border-box;
          ${printStyles.grayscale}
        }
        
        /* Ensure content stays together */
        .invoice-header,
        .billing-section,
        .items-table,
        .totals-section,
        .notes-section,
        .footer {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }
        .company-info {
          flex: 1;
        }
        .company-logo {
          max-width: 400px;
          max-height: 160px;
          margin-bottom: 0px;
          object-fit: contain;
          ${!printStyles.showLogo ? 'display: none !important;' : ''}
        }
        .company-details {
          font-size: ${printStyles.bodySize};
          line-height: 1.6;
          color: #333;
        }
        .invoice-info {
          text-align: right;
          flex: 1;
        }
        .invoice-title {
          font-size: ${printStyles.titleSize};
          font-weight: bold;
          margin-bottom: 6px;
          color: #000;
          letter-spacing: 2px;
        }
        .invoice-subtitle {
          font-size: ${printStyles.fontSize === 'small' ? '10px' : '14px'};
          color: #555;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .invoice-number {
          font-size: ${printStyles.bodySize};
          margin-bottom: 5px;
        }
        .invoice-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        .billing-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
          color: #000;
        }
        .billing-info {
          font-size: 12px;
          line-height: 1.8;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: ${printStyles.isThermal ? '8px 0' : '30px 0'};
          font-size: ${printStyles.tableSize};
        }
        .items-table th {
          background-color: #f5f5f5;
          padding: ${printStyles.isThermal ? '4px' : '8px'};
          text-align: left;
          font-weight: bold;
          font-size: ${printStyles.tableSize};
          border: 1px solid #ddd;
        }
        .items-table td {
          padding: ${printStyles.isThermal ? '3px 4px' : '6px 8px'};
          border: 1px solid #ddd;
          font-size: ${printStyles.tableSize};
        }
        .items-table tr:nth-child(even) {
          background-color: #fafafa;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .totals-section {
          margin-top: 20px;
          margin-left: auto;
          width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: ${printStyles.isThermal ? '4px 0' : '8px 0'};
          font-size: ${printStyles.bodySize};
        }
        .total-row.bold {
          font-weight: bold;
          font-size: ${printStyles.fontSize === 'small' ? '11px' : '14px'};
          border-top: 2px solid #000;
          padding-top: 10px;
          margin-top: 10px;
        }
        .total-row.balance {
          font-weight: bold;
          font-size: 16px;
          border-top: 2px solid #000;
          padding-top: 10px;
          margin-top: 10px;
          color: #ff4d4f;
        }
        .notes-section {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
        }
        .notes-title {
          font-weight: bold;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .notes-content {
          font-size: 11px;
          line-height: 1.6;
          color: #666;
        }
        .footer {
          margin-top: ${printStyles.isThermal ? '8px' : '20px'};
          padding-top: ${printStyles.isThermal ? '8px' : '15px'};
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: ${printStyles.fontSize === 'small' ? '9px' : '10px'};
          color: #666;
        }
        
        /* Thermal receipt layout */
        .thermal-receipt {
          text-align: center;
          max-width: ${printStyles.contentWidth};
          margin: 0 auto;
          padding: ${printStyles.isThermal ? '2mm' : '0'};
          font-family: Arial, sans-serif;
          font-size: 10px;
          color: #000;
        }
        .thermal-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
          letter-spacing: 1px;
        }
        .thermal-business {
          font-size: 9px;
          line-height: 1.4;
          margin-bottom: 6px;
          color: #000;
        }
        .thermal-separator {
          border: none;
          border-top: 1px dotted #000;
          margin: 6px 0;
        }
        .thermal-date-row {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          margin-bottom: 6px;
        }
        .thermal-items {
          text-align: left;
          margin: 8px 0;
          list-style: none;
          padding: 0;
        }
        .thermal-item-list {
          font-size: 9px;
          padding: 4px 0;
          border-bottom: none;
        }
        .thermal-item-name {
          display: block;
          margin-bottom: 2px;
        }
        .thermal-item-amount {
          display: block;
          font-weight: 500;
          padding-left: 8px;
        }
        .thermal-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          padding: 3px 0;
        }
        .thermal-total-row.bold {
          font-weight: bold;
          font-size: 11px;
          border-top: 1px dotted #000;
          padding-top: 6px;
          margin-top: 4px;
        }
        .thermal-thanks {
          font-size: 12px;
          font-weight: bold;
          margin-top: 10px;
          letter-spacing: 2px;
        }
      `}</style>

      <div className={`printable-invoice ${printStyles.isThermal ? 'thermal-mode' : ''}`}>
        {printStyles.isThermal ? (
          /* Thermal receipt layout - simplified CASH RECEIPT style */
          <div className="thermal-receipt">
            <div className="thermal-title">CASH RECEIPT</div>
            <div className="thermal-business">
              <div style={{ fontWeight: 600 }}>{companyInfo.name}</div>
              {companyInfo.location && <div>Address: {companyInfo.location.replace(/\n/g, ', ')}</div>}
              {companyInfo.phone && <div>Tel: {companyInfo.phone}</div>}
              {companyInfo.vatNumber && <div>VAT: {companyInfo.vatNumber}</div>}
              {companyInfo.tin && <div>TIN: {companyInfo.tin}</div>}
            </div>
            <hr className="thermal-separator" />
            <div className="thermal-date-row">
              <span>Date: {dayjs(invoice.invoiceDate).format('DD-MM-YYYY')}</span>
              <span>{dayjs(invoice.invoiceDate).format('HH:mm')}</span>
            </div>
            <hr className="thermal-separator" />
            <div className="thermal-items">
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item, index) => {
                  const qty = item.quantity || 1;
                  const total = parseFloat(item.total || item.unitPrice * qty || 0).toFixed(2);
                  const unitPrice = parseFloat(item.unitPrice || 0).toFixed(2);
                  return (
                    <div key={index} className="thermal-item-list">
                      <span className="thermal-item-name">{item.description || item.category || 'Item'}</span>
                      <span className="thermal-item-amount">{qty} × ₵ {unitPrice} = ₵ {total}</span>
                    </div>
                  );
                })
              ) : (
                <div className="thermal-item-list">
                  <span className="thermal-item-name">No items</span>
                  <span className="thermal-item-amount">₵ 0.00</span>
                </div>
              )}
            </div>
            <hr className="thermal-separator" />
            <div className="thermal-total-row">
              <span>Sub-total</span>
              <span>₵ {parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="thermal-total-row">
                <span>Sales Tax</span>
                <span>₵ {parseFloat(invoice.taxAmount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="thermal-total-row bold">
              <span>Total</span>
              <span>₵ {parseFloat(invoice.totalAmount || 0).toFixed(2)}</span>
            </div>
            <hr className="thermal-separator" />
            {(companyInfo.invoiceFooter || companyInfo.name) && (
              <div className="thermal-thanks text-center">
                {companyInfo.invoiceFooter || companyInfo.name}
              </div>
            )}
            <div className="thermal-business-footer" style={{ fontSize: '9px', marginTop: '8px', lineHeight: 1.4 }}>
              {companyInfo.name}
              {companyInfo.phone && ` | ${companyInfo.phone}`}
            </div>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="invoice-header">
          <div className="company-info">
            {logoSource ? (
              <img src={logoSource} alt={companyInfo.name} className="company-logo" />
            ) : companyInfo.name ? (
              <div className="company-name-placeholder" style={{ fontSize: printStyles.titleSize, fontWeight: 'bold', marginBottom: 10 }}>{companyInfo.name}</div>
            ) : null}
            <div className="company-details">
              {companyInfo.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <MapPin className="h-3.5 w-3.5" style={{ fontSize: '14px' }} />
                  <span style={{ whiteSpace: 'pre-line' }}>{companyInfo.location}</span>
                </div>
              )}
              {companyInfo.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Phone className="h-3.5 w-3.5" style={{ fontSize: '14px' }} />
                  <span>{companyInfo.phone}</span>
                </div>
              )}
              {companyInfo.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Globe className="h-3.5 w-3.5" style={{ fontSize: '14px' }} />
                  <span>{companyInfo.website}</span>
                </div>
              )}
              {companyInfo.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Mail className="h-3.5 w-3.5" style={{ fontSize: '14px' }} />
                  <span>{companyInfo.email}</span>
                </div>
              )}
              {(companyInfo.vatNumber || companyInfo.tin) && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '11px', color: '#6b7280' }}>
                  {companyInfo.vatNumber && <div>VAT: {companyInfo.vatNumber}</div>}
                  {companyInfo.tin && <div>TIN: {companyInfo.tin}</div>}
                </div>
              )}
            </div>
          </div>
          <div className="invoice-info">
            <div className="invoice-title">{titleText}</div>
            {documentSubtitle && (
              <div className="invoice-subtitle">{documentSubtitle}</div>
            )}
            <div className="invoice-number">
              <strong>Invoice #:</strong> {invoice.invoiceNumber}
            </div>
            <div className="invoice-number">
              <strong>Date:</strong> {dayjs(invoice.invoiceDate).format('MMMM DD, YYYY')}
            </div>
            <div className="invoice-number">
              <strong>Due Date:</strong> {dayjs(invoice.dueDate).format('MMMM DD, YYYY')}
            </div>
            {invoice.paymentTerms && (
              <div className="invoice-number">
                <strong>Terms:</strong> {invoice.paymentTerms}
              </div>
            )}
          </div>
        </div>

        {/* Billing Details */}
        <div className="invoice-details">
          <div className="billing-section">
            <div className="section-title">Bill To:</div>
            <div className="billing-info">
              <div><strong>{invoice.customer?.name || 'N/A'}</strong></div>
              {invoice.customer?.company && (
                <div>{invoice.customer.company}</div>
              )}
              {invoice.customer?.address && (
                <div>{invoice.customer.address}</div>
              )}
              {(invoice.customer?.city || invoice.customer?.state || invoice.customer?.zipCode) && (
                <div>
                  {[invoice.customer.city, invoice.customer.state, invoice.customer.zipCode]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {invoice.customer?.email && (
                <div>Email: {invoice.customer.email}</div>
              )}
              {invoice.customer?.phone && (
                <div>Phone: {invoice.customer.phone}</div>
              )}
            </div>
          </div>
          {invoice.job && (
            <div className="billing-section">
              <div className="section-title">Job Details:</div>
              <div className="billing-info">
                <div><strong>Job #:</strong> {invoice.job.jobNumber}</div>
              </div>
            </div>
          )}
        </div>

        {/* Items: list for receipts, table for invoices */}
        {isReceipt ? (
          <div className="receipt-items-list" style={{ margin: '16px 0' }}>
            {invoice.items && invoice.items.length > 0 ? (
              invoice.items.map((item, index) => {
                const qty = item.quantity || 1;
                const total = parseFloat(item.total || item.unitPrice * qty || 0).toFixed(2);
                const unitPrice = parseFloat(item.unitPrice || 0).toFixed(2);
                return (
                  <div key={index} className="receipt-item-row" style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '12px' }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>{item.description || item.category || 'Item'}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>{qty} × ₵ {unitPrice} = ₵ {total}</div>
                  </div>
                );
              })
            ) : (
              <div className="receipt-item-row" style={{ padding: '6px 0', fontSize: '12px' }}>No items</div>
            )}
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Description</th>
                <th className="text-center" style={{ width: '15%' }}>Quantity</th>
                <th className="text-right" style={{ width: '15%' }}>Unit Price</th>
                <th className="text-right" style={{ width: '15%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items && invoice.items.length > 0 ? (
                invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <div>{item.description || item.category || 'Item'}</div>
                      {item.paperSize && (
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          Size: {item.paperSize}
                        </div>
                      )}
                    </td>
                    <td className="text-center">{item.quantity || 1}</td>
                    <td className="text-right">₵ {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                    <td className="text-right">
                      <strong>₵ {parseFloat(item.total || item.unitPrice * (item.quantity || 1) || 0).toFixed(2)}</strong>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">No items</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>₵ {parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="total-row">
              <span>Tax ({invoice.taxRate || 0}%):</span>
              <span>₵ {parseFloat(invoice.taxAmount || 0).toFixed(2)}</span>
            </div>
          )}
          {invoice.discountAmount > 0 && (
            <div className="total-row" style={{ color: '#52c41a', fontWeight: '500' }}>
              <span>
                Discount {invoice.discountType === 'percentage' ? `(${invoice.discountValue}%)` : ''}
                {invoice.discountReason && (
                  <div style={{ fontSize: '10px', color: '#666', fontWeight: 'normal', marginTop: '2px' }}>
                    {invoice.discountReason}
                  </div>
                )}
              </span>
              <span>-₵ {parseFloat(invoice.discountAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row bold">
            <span>Total Amount:</span>
            <span>₵ {parseFloat(invoice.totalAmount || 0).toFixed(2)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="total-row">
              <span>Amount Paid:</span>
              <span style={{ color: '#52c41a' }}>₵ {parseFloat(invoice.amountPaid || 0).toFixed(2)}</span>
            </div>
          )}
          <div className={`total-row ${isReceipt && invoice.balance <= 0 ? '' : 'balance'}`}>
            <span>{isReceipt && invoice.balance <= 0 ? 'Status:' : 'Balance Due:'}</span>
            <span style={isReceipt && invoice.balance <= 0 ? { color: '#52c41a' } : undefined}>
              {isReceipt && invoice.balance <= 0 ? 'Paid' : `₵ ${parseFloat(invoice.balance || 0).toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Terms & Conditions */}
        {invoice.termsAndConditions && (
          <div className="notes-section">
                <div className="notes-title">Terms & Conditions:</div>
                <div className="notes-content">{invoice.termsAndConditions}</div>
          </div>
        )}

        {/* Footer - uses tenant invoiceFooter only; no generic fallback */}
        <div className="footer">
          {companyInfo.invoiceFooter ? (
            <div>{companyInfo.invoiceFooter}</div>
          ) : (companyInfo.name || companyInfo.phone || companyInfo.email) ? (
            <div>
              {companyInfo.name}
              {companyInfo.phone && ` | ${companyInfo.phone}`}
              {companyInfo.email && ` | ${companyInfo.email}`}
            </div>
          ) : null}
        </div>
          </>
        )}
      </div>

    </>
  );
};

export default PrintableInvoice;

