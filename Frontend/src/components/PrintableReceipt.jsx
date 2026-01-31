import React from 'react';
import dayjs from 'dayjs';
import { MapPin, Phone, Globe, Mail } from 'lucide-react';
import logoImage from '../assets/nexus logo for dark bg.png';
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

const PrintableReceipt = ({
  sale,
  documentTitle = 'RECEIPT',
  documentSubtitle,
  organization = {}
}) => {
  if (!sale) return null;

  const titleText = documentTitle || 'RECEIPT';

  // Format logo URL - handle relative paths by prepending API base URL
  const logoSource = organization?.logoUrl
    ? (organization.logoUrl.startsWith('data:') || organization.logoUrl.startsWith('http')
        ? organization.logoUrl
        : (API_BASE_URL
            ? `${API_BASE_URL}${organization.logoUrl.startsWith('/') ? '' : '/'}${organization.logoUrl}`
            : organization.logoUrl))
    : logoImage;

  const companyInfo = {
    name: organization.name || 'Company Name',
    phone: organization.phone || '',
    website: organization.website || '',
    email: organization.email || '',
    location: formatAddress(organization.address)
  };

  const paymentMethodLabels = {
    cash: 'Cash',
    card: 'Card',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    credit: 'Credit',
    other: 'Other'
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          .printable-receipt {
            width: 100% !important;
            max-width: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .receipt-header {
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
        .printable-receipt {
          width: 100%;
          max-width: 210mm;
          padding: 15mm;
          margin: 0 auto;
          background: white;
          font-family: Arial, sans-serif;
          color: #000;
          box-sizing: border-box;
        }
        
        /* Ensure content stays together */
        .receipt-header,
        .billing-section,
        .items-table,
        .totals-section,
        .notes-section,
        .footer {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .receipt-header {
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
          max-width: 200px;
          max-height: 80px;
          margin-bottom: 10px;
          object-fit: contain;
        }
        .company-details {
          font-size: 12px;
          line-height: 1.6;
          color: #333;
        }
        .receipt-info {
          text-align: right;
          flex: 1;
        }
        .receipt-title {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 6px;
          color: #000;
          letter-spacing: 2px;
        }
        .receipt-subtitle {
          font-size: 14px;
          color: #555;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .receipt-number {
          font-size: 14px;
          margin-bottom: 5px;
        }
        .receipt-details {
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
          margin: 30px 0;
          font-size: 11px;
        }
        .items-table th {
          background-color: #f5f5f5;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          font-size: 11px;
          border: 1px solid #ddd;
        }
        .items-table td {
          padding: 6px 8px;
          border: 1px solid #ddd;
          font-size: 11px;
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
          padding: 8px 0;
          font-size: 12px;
        }
        .total-row.bold {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #000;
          padding-top: 10px;
          margin-top: 10px;
        }
        .footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      `}</style>

      <div className="printable-receipt">
        {/* Header */}
        <div className="receipt-header">
          <div className="company-info">
            <img src={logoSource} alt={companyInfo.name} className="company-logo" />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail className="h-3.5 w-3.5" style={{ fontSize: '14px' }} />
                  <span>{companyInfo.email}</span>
                </div>
              )}
            </div>
          </div>
          <div className="receipt-info">
            <div className="receipt-title">{titleText}</div>
            {documentSubtitle && (
              <div className="receipt-subtitle">{documentSubtitle}</div>
            )}
            <div className="receipt-number">
              <strong>Receipt #:</strong> {sale.saleNumber}
            </div>
            <div className="receipt-number">
              <strong>Date:</strong> {dayjs(sale.createdAt).format('MMMM DD, YYYY')}
            </div>
            <div className="receipt-number">
              <strong>Time:</strong> {dayjs(sale.createdAt).format('h:mm A')}
            </div>
            <div className="receipt-number">
              <strong>Payment Method:</strong> {paymentMethodLabels[sale.paymentMethod] || sale.paymentMethod}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="receipt-details">
          <div className="billing-section">
            <div className="section-title">Customer:</div>
            <div className="billing-info">
              {sale.customer ? (
                <>
                  <div><strong>{sale.customer.name || 'N/A'}</strong></div>
                  {sale.customer.company && (
                    <div>{sale.customer.company}</div>
                  )}
                  {sale.customer.phone && (
                    <div>Phone: {sale.customer.phone}</div>
                  )}
                  {sale.customer.email && (
                    <div>Email: {sale.customer.email}</div>
                  )}
                </>
              ) : (
                <div>Walk-in Customer</div>
              )}
            </div>
          </div>
          {sale.shop && (
            <div className="billing-section">
              <div className="section-title">Shop:</div>
              <div className="billing-info">
                <div><strong>{sale.shop.name}</strong></div>
                {sale.shop.address && (
                  <div>{sale.shop.address}</div>
                )}
                {sale.shop.phone && (
                  <div>Phone: {sale.shop.phone}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Item</th>
              <th className="text-center" style={{ width: '15%' }}>Qty</th>
              <th className="text-right" style={{ width: '15%' }}>Unit Price</th>
              <th className="text-right" style={{ width: '15%' }}>Discount</th>
              <th className="text-right" style={{ width: '15%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items && sale.items.length > 0 ? (
              sale.items.map((item, index) => (
                <tr key={item.id || index}>
                  <td>
                    <div>{item.name || item.product?.name || 'Item'}</div>
                    {item.sku && (
                      <div style={{ fontSize: '10px', color: '#666' }}>
                        SKU: {item.sku}
                      </div>
                    )}
                  </td>
                  <td className="text-center">{item.quantity || 1}</td>
                  <td className="text-right">GHS {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="text-right">
                    {parseFloat(item.discount || 0) > 0 ? (
                      <>-GHS {parseFloat(item.discount || 0).toFixed(2)}</>
                    ) : (
                      <>—</>
                    )}
                  </td>
                  <td className="text-right">
                    <strong>GHS {parseFloat(item.total || 0).toFixed(2)}</strong>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">No items</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>GHS {parseFloat(sale.subtotal || 0).toFixed(2)}</span>
          </div>
          {parseFloat(sale.discount || 0) > 0 && (
            <div className="total-row" style={{ color: '#52c41a', fontWeight: '500' }}>
              <span>Discount:</span>
              <span>-GHS {parseFloat(sale.discount || 0).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(sale.tax || 0) > 0 && (
            <div className="total-row">
              <span>Tax:</span>
              <span>GHS {parseFloat(sale.tax || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row bold">
            <span>Total:</span>
            <span>GHS {parseFloat(sale.total || 0).toFixed(2)}</span>
          </div>
          {parseFloat(sale.amountPaid || 0) > 0 && (
            <div className="total-row">
              <span>Amount Paid:</span>
              <span style={{ color: '#52c41a' }}>GHS {parseFloat(sale.amountPaid || 0).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(sale.change || 0) > 0 && (
            <div className="total-row">
              <span>Change:</span>
              <span style={{ color: '#52c41a' }}>GHS {parseFloat(sale.change || 0).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        {sale.notes && (
          <div className="notes-section" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #ddd' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>Notes:</div>
            <div style={{ fontSize: '11px', lineHeight: '1.6', color: '#666' }}>{sale.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div>Thank you for your purchase!</div>
          <div style={{ marginTop: 5 }}>
            {companyInfo.name}
            {companyInfo.phone && ` | ${companyInfo.phone}`}
            {companyInfo.email && ` | ${companyInfo.email}`}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrintableReceipt;
