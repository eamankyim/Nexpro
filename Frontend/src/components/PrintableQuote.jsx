import React from 'react';
import dayjs from 'dayjs';
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

const PrintableQuote = ({ quote, organization = {} }) => {
  if (!quote) return null;

  const primaryColor = organization.primaryColor || '#166534';

  const logoSource = organization?.logoUrl
    ? (organization.logoUrl.startsWith('data:') || organization.logoUrl.startsWith('http')
        ? organization.logoUrl
        : (API_BASE_URL
            ? `${API_BASE_URL}${organization.logoUrl.startsWith('/') ? '' : '/'}${organization.logoUrl}`
            : organization.logoUrl))
    : null;

  const companyInfo = {
    name: organization.name || 'Company Name',
    phone: organization.phone || '',
    email: organization.email || '',
    website: organization.website || '',
    location: formatAddress(organization.address),
    paymentDetails: organization.paymentDetails || '',
    taxDisplayLabel: organization.tax?.displayLabel || 'Tax'
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-quote, .printable-quote * {
            visibility: visible;
          }
          .printable-quote {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
        }

        .printable-quote {
          width: 210mm;
          max-height: 594mm;
          padding: 20mm;
          margin: 0 auto;
          background: #fff;
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #000;
          box-sizing: border-box;
        }

        .quote-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          border-bottom: 2px solid ${primaryColor};
          padding-bottom: 20px;
          margin-bottom: 24px;
        }

        .quote-branding img {
          max-height: 60px;
        }

        .company-details {
          margin-top: 12px;
          font-size: 12px;
          line-height: 1.7;
          color: #555;
        }

        .quote-meta {
          text-align: right;
        }

        .quote-title {
          font-size: 32px;
          font-weight: 600;
          letter-spacing: 3px;
          color: ${primaryColor};
          margin-bottom: 12px;
        }

        .quote-meta-row {
          font-size: 13px;
          margin-bottom: 4px;
        }

        .quote-meta-label {
          font-weight: 600;
          color: #333;
        }

        .party-section {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
          font-size: 12px;
          color: #555;
          line-height: 1.6;
        }

        .party-block {
          flex: 1;
        }

        .party-label {
          font-size: 11px;
          font-weight: 600;
          color: ${primaryColor};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .party-details {
          font-size: 12px;
          line-height: 1.6;
          color: #333;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }

        .items-table th {
          background: ${primaryColor};
          color: #fff;
          padding: 10px;
          text-align: left;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        .items-table td {
          padding: 10px;
          font-size: 12px;
          border-bottom: 1px solid #e5e7eb;
        }

        .items-table tr:nth-child(even) td {
          background: #f9fafb;
        }

        .totals-wrapper {
          margin-left: auto;
          min-width: 240px;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .totals-row.total {
          font-size: 16px;
          font-weight: 700;
          margin-top: 10px;
          color: ${primaryColor};
        }

        .notes-section {
          margin-top: 28px;
          padding: 16px;
          border-radius: 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .notes-title {
          font-size: 13px;
          font-weight: 600;
          color: ${primaryColor};
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .pay-to-block {
          margin-top: 16px;
          padding: 10px 12px;
          border-radius: 6px;
          background-color: #f5f5f5;
          font-size: 12px;
          line-height: 1.6;
        }
        .pay-to-title {
          font-weight: 600;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .references {
          margin-top: 32px;
          font-size: 11px;
          color: #777;
          text-align: center;
          line-height: 1.6;
        }

        .printable-quote-footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #999;
          text-align: center;
        }
        .printable-quote-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="printable-quote">
        <div className="quote-header">
          <div className="quote-branding">
            {logoSource ? (
              <img src={logoSource} alt={companyInfo.name} />
            ) : (
              companyInfo.name && <div className="quote-company-name" style={{ fontSize: '24px', fontWeight: 600, color: primaryColor, marginBottom: 12 }}>{companyInfo.name}</div>
            )}
            <div className="company-details">
              {companyInfo.name && <div>{companyInfo.name}</div>}
              {companyInfo.location && <div style={{ whiteSpace: 'pre-line' }}>{companyInfo.location}</div>}
              {companyInfo.email && <div>{companyInfo.email}</div>}
              {companyInfo.phone && <div>{companyInfo.phone}</div>}
              {companyInfo.website && <div>{companyInfo.website}</div>}
            </div>
          </div>

          <div className="quote-meta">
            <div className="quote-title">QUOTE</div>
            <div className="quote-meta-row">
              <span className="quote-meta-label">Quote #:</span> {quote.quoteNumber}
            </div>
            <div className="quote-meta-row">
              <span className="quote-meta-label">Status:</span> {quote.status?.toUpperCase()}
            </div>
            <div className="quote-meta-row">
              <span className="quote-meta-label">Created:</span>{' '}
              {quote.createdAt ? dayjs(quote.createdAt).format('MMM DD, YYYY') : '—'}
            </div>
            {quote.validUntil && (
              <div className="quote-meta-row">
                <span className="quote-meta-label">Valid Until:</span>{' '}
                {dayjs(quote.validUntil).format('MMM DD, YYYY')}
              </div>
            )}
          </div>
        </div>

        <div className="party-section">
          <div className="party-block">
            <div className="party-label">Prepared for</div>
            <div className="party-details">
              {[quote.customer?.name, quote.customer?.company, quote.customer?.email].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="party-block">
            <div className="party-label">Prepared by</div>
            <div className="party-details">
              {quote.creator?.name || 'Nexus Team'}
              {' · Issued '}
              {quote.createdAt ? dayjs(quote.createdAt).format('MMM DD, YYYY') : '—'}
            </div>
          </div>
        </div>

        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Description</th>
              <th style={{ width: '10%' }}>Qty</th>
              <th style={{ width: '15%' }}>Unit Price</th>
              <th style={{ width: '10%' }}>Discount</th>
              <th style={{ width: '15%' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {(quote.items || []).map((item) => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.description}</div>
                  {item.metadata && Object.keys(item.metadata || {}).length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
                      {Object.entries(item.metadata)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(', ')}
                    </div>
                  )}
                </td>
                <td>{item.quantity}</td>
                <td>₵ {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                <td style={{ color: item.discountAmount > 0 ? '#52c41a' : 'inherit' }}>
                  {item.discountAmount > 0 ? (
                    <div>
                      <div>-₵ {parseFloat(item.discountAmount || 0).toFixed(2)}</div>
                      {item.discountPercent > 0 && (
                        <div style={{ fontSize: '9px', color: '#666' }}>({item.discountPercent}% off)</div>
                      )}
                      {item.discountReason && (
                        <div style={{ fontSize: '9px', color: '#666' }}>{item.discountReason}</div>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>₵ {parseFloat(item.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-wrapper">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>₵ {parseFloat(quote.subtotal || 0).toFixed(2)}</span>
          </div>
          {quote.discountTotal > 0 && (
            <div className="totals-row" style={{ color: '#52c41a', fontWeight: '500' }}>
              <span>
                Total Discount
                {quote.discountReason && (
                  <div style={{ fontSize: '10px', color: '#666', fontWeight: 'normal', marginTop: '2px' }}>
                    {quote.discountReason}
                  </div>
                )}
              </span>
            <span>-₵ {parseFloat(quote.discountTotal || 0).toFixed(2)}</span>
          </div>
          )}
          {parseFloat(quote.taxAmount || 0) > 0 && (
            <div className="totals-row">
              <span>
                {companyInfo.taxDisplayLabel}{' '}
                {parseFloat(quote.taxRate || 0) > 0 ? `(${parseFloat(quote.taxRate).toFixed(2)}%)` : ''}
              </span>
              <span>₵ {parseFloat(quote.taxAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="totals-row total">
            <span>Total</span>
            <span>₵ {parseFloat(quote.totalAmount || 0).toFixed(2)}</span>
          </div>
        </div>

        {companyInfo.paymentDetails && (
          <div className="notes-section">
            <div className="pay-to-block">
              <div className="pay-to-title">Pay to</div>
              <div style={{ whiteSpace: 'pre-line' }}>{companyInfo.paymentDetails}</div>
            </div>
          </div>
        )}

        {quote.notes && (
          <div className="notes-section">
            <div className="notes-title">Notes</div>
            <div>{quote.notes}</div>
          </div>
        )}

        <div className="references">
          <div>Thank you for considering {companyInfo.name || 'us'}. We look forward to working with you.</div>
          <div>This quotation is valid until {quote.validUntil ? dayjs(quote.validUntil).format('MMM DD, YYYY') : '—'}.</div>
        </div>

        <div className="printable-quote-footer">
          <a href="https://africanbusinesssuite.com" target="_blank" rel="noopener noreferrer" style={{ color: '#999', textDecoration: 'none' }}>
            Powered by ABS – African Business Suite
          </a>
        </div>
      </div>
    </>
  );
};

export default PrintableQuote;
