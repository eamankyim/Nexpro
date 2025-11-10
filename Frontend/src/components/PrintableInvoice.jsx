import React from 'react';
import dayjs from 'dayjs';
import { EnvironmentOutlined, PhoneOutlined, GlobalOutlined, MailOutlined } from '@ant-design/icons';
import logoImage from '../assets/nexus logo for dark bg.png';

const PrintableInvoice = ({
  invoice,
  documentTitle = 'INVOICE',
  documentSubtitle
}) => {
  if (!invoice) return null;

  const titleText = documentTitle || 'INVOICE';

  const companyInfo = {
    name: 'Nexus Creative Studio',
    phone: '0591403367',
    website: 'www.nexuscreativestudio.com',
    email: 'info@nexuscreativestudios.com',
    location: 'Oyarifa School Junction, Adenta Municipal'
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-invoice, .printable-invoice * {
            visibility: visible;
          }
          .printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
          .printable-invoice {
            width: 210mm;
            max-height: 594mm;
            padding: 0;
            margin: 0 auto;
            background: white;
            page-break-after: auto;
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
        .printable-invoice {
          width: 210mm;
          max-height: 594mm;
          padding: 20mm;
          margin: 0 auto;
          background: white;
          font-family: Arial, sans-serif;
          color: #000;
          box-sizing: border-box;
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
          max-width: 570px;
          max-height: 225px;
          margin-top: -80px;
          margin-bottom: -55px;
        }
        .company-details {
          font-size: 12px;
          line-height: 1.6;
          color: #333;
        }
        .invoice-info {
          text-align: right;
          flex: 1;
        }
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 6px;
          color: #000;
          letter-spacing: 2px;
        }
        .invoice-subtitle {
          font-size: 14px;
          color: #555;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .invoice-number {
          font-size: 14px;
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
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      `}</style>

      <div className="printable-invoice">
        {/* Header */}
        <div className="invoice-header">
          <div className="company-info">
            <img src={logoImage} alt="Nexus Creative Studio" className="company-logo" />
            <div className="company-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <EnvironmentOutlined style={{ fontSize: '14px' }} />
                <span>{companyInfo.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <PhoneOutlined style={{ fontSize: '14px' }} />
                <span>{companyInfo.phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <GlobalOutlined style={{ fontSize: '14px' }} />
                <span>{companyInfo.website}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MailOutlined style={{ fontSize: '14px' }} />
                <span>{companyInfo.email}</span>
              </div>
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
                <div><strong>Title:</strong> {invoice.job.title || 'N/A'}</div>
                {invoice.job.description && (
                  <div><strong>Description:</strong> {invoice.job.description}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Items Table */}
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
                  <td className="text-right">₵{parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="text-right">
                    <strong>₵{parseFloat(item.total || item.unitPrice * (item.quantity || 1) || 0).toFixed(2)}</strong>
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

        {/* Totals */}
        <div className="totals-section">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>₵{parseFloat(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="total-row">
              <span>Tax ({invoice.taxRate || 0}%):</span>
              <span>₵{parseFloat(invoice.taxAmount || 0).toFixed(2)}</span>
            </div>
          )}
          {invoice.discountAmount > 0 && (
            <div className="total-row">
              <span>
                Discount {invoice.discountType === 'percentage' ? `(${invoice.discountValue}%)` : ''}:
              </span>
              <span>-₵{parseFloat(invoice.discountAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row bold">
            <span>Total Amount:</span>
            <span>₵{parseFloat(invoice.totalAmount || 0).toFixed(2)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="total-row">
              <span>Amount Paid:</span>
              <span style={{ color: '#52c41a' }}>₵{parseFloat(invoice.amountPaid || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="total-row balance">
            <span>Balance Due:</span>
            <span>₵{parseFloat(invoice.balance || 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        {(invoice.notes || invoice.termsAndConditions) && (
          <div className="notes-section">
            {invoice.notes && (
              <div style={{ marginBottom: 15 }}>
                <div className="notes-title">Notes:</div>
                <div className="notes-content">{invoice.notes}</div>
              </div>
            )}
            {invoice.termsAndConditions && (
              <div>
                <div className="notes-title">Terms & Conditions:</div>
                <div className="notes-content">{invoice.termsAndConditions}</div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div>Thank you for your business!</div>
          <div style={{ marginTop: 5 }}>
            {companyInfo.name} | {companyInfo.phone} | {companyInfo.email}
          </div>
        </div>
      </div>

    </>
  );
};

export default PrintableInvoice;

