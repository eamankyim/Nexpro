import React from 'react';
import dayjs from 'dayjs';
import logoImage from '../assets/nexus logo for dark bg.png';

const PrintableQuote = ({ quote }) => {
  if (!quote) return null;

  const companyInfo = {
    name: 'Nexus Creative Studio',
    phone: '0591403367',
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
          border-bottom: 2px solid #0b1a50;
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
          color: #0b1a50;
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
          gap: 32px;
          margin-bottom: 28px;
        }

        .party-card {
          flex: 1;
          background: #f8faff;
          border: 1px solid #d3ddff;
          border-radius: 8px;
          padding: 16px;
        }

        .party-title {
          font-size: 13px;
          font-weight: 600;
          color: #0b1a50;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }

        .party-details {
          font-size: 12px;
          line-height: 1.8;
          color: #333;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }

        .items-table th {
          background: #0b1a50;
          color: #fff;
          padding: 10px;
          text-align: left;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        .items-table td {
          padding: 10px;
          font-size: 12px;
          border-bottom: 1px solid #e6eaf8;
        }

        .items-table tr:nth-child(even) td {
          background: #f8faff;
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
          color: #0b1a50;
        }

        .notes-section {
          margin-top: 28px;
          padding: 16px;
          border-radius: 8px;
          background: #fef9f3;
          border: 1px solid #fde4bc;
        }

        .notes-title {
          font-size: 13px;
          font-weight: 600;
          color: #b26a00;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .references {
          margin-top: 32px;
          font-size: 11px;
          color: #777;
          text-align: center;
          line-height: 1.6;
        }
      `}</style>

      <div className="printable-quote">
        <div className="quote-header">
          <div className="quote-branding">
            <img src={logoImage} alt="Company logo" />
            <div className="company-details">
              <div>{companyInfo.name}</div>
              <div>{companyInfo.location}</div>
              <div>{companyInfo.email}</div>
              <div>{companyInfo.phone}</div>
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
          <div className="party-card">
            <div className="party-title">Prepared For</div>
            <div className="party-details">
              <div>{quote.customer?.name || '—'}</div>
              {quote.customer?.company && <div>{quote.customer.company}</div>}
              {quote.customer?.email && <div>{quote.customer.email}</div>}
            </div>
          </div>

          <div className="party-card">
            <div className="party-title">Prepared By</div>
            <div className="party-details">
              <div>{quote.creator?.name || 'Nexus Team'}</div>
              {quote.creator?.email && <div>{quote.creator.email}</div>}
              <div>Issued on {dayjs(quote.createdAt).format('MMM DD, YYYY')}</div>
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
                <td>GHS {parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                <td style={{ color: item.discountAmount > 0 ? '#52c41a' : 'inherit' }}>
                  {item.discountAmount > 0 ? (
                    <div>
                      <div>-GHS {parseFloat(item.discountAmount || 0).toFixed(2)}</div>
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
                <td>GHS {parseFloat(item.total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals-wrapper">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>GHS {parseFloat(quote.subtotal || 0).toFixed(2)}</span>
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
              <span>-GHS {parseFloat(quote.discountTotal || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="totals-row total">
            <span>Total</span>
            <span>GHS {parseFloat(quote.totalAmount || 0).toFixed(2)}</span>
          </div>
        </div>

        {quote.notes && (
          <div className="notes-section">
            <div className="notes-title">Notes</div>
            <div>{quote.notes}</div>
          </div>
        )}

        <div className="references">
          <div>Thank you for considering {companyInfo.name}. We look forward to working with you.</div>
          <div>This quotation is valid until {quote.validUntil ? dayjs(quote.validUntil).format('MMM DD, YYYY') : '—'}.</div>
        </div>
      </div>
    </>
  );
};

export default PrintableQuote;
