import React from 'react';
import { API_BASE_URL } from '../services/api';
import { formatLineItemQuantity } from '../utils/documentLineItems';

const formatAddress = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
  return parts.join('\n');
};

const money = (value) => `GH₵ ${parseFloat(value || 0).toFixed(2)}`;

/**
 * Premium project / service quotation printable (A4).
 * Driven by buildQuotePrintModel() section flags.
 */
const PrintableQuotation = ({
  model,
  organization = {},
}) => {
  if (!model?.data) return null;

  const { sections, data, meta, documentTitle } = model;
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
    paymentDetailsEnabled: organization.paymentDetailsEnabled === true,
    taxDisplayLabel: organization.tax?.displayLabel || 'Tax',
    invoiceFooter: organization.invoiceFooter || '',
  };

  const customer = data.customer || {};

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-quotation, .printable-quotation * { visibility: visible; }
          .printable-quotation {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          @page { size: A4; margin: 14mm 16mm; }
        }

        .printable-quotation {
          width: 210mm;
          max-width: 100%;
          padding: 18mm 16mm;
          margin: 0 auto;
          background: #fff;
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          color: #111827;
          box-sizing: border-box;
        }

        .pq-header {
          display: flex;
          justify-content: space-between;
          gap: 28px;
          padding-bottom: 20px;
          margin-bottom: 28px;
          border-bottom: 1px solid #e5e7eb;
        }

        .pq-brand img {
          max-height: 56px;
          max-width: 200px;
          object-fit: contain;
        }

        .pq-company-name {
          font-size: 20px;
          font-weight: 650;
          color: ${primaryColor};
          letter-spacing: 0.02em;
          margin-bottom: 8px;
        }

        .pq-company-details {
          margin-top: 10px;
          font-size: 11.5px;
          line-height: 1.65;
          color: #4b5563;
          white-space: pre-line;
        }

        .pq-meta {
          text-align: right;
          min-width: 220px;
        }

        .pq-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: ${primaryColor};
          margin: 0 0 14px;
        }

        .pq-meta-row {
          font-size: 12px;
          line-height: 1.7;
          color: #374151;
        }

        .pq-meta-label {
          font-weight: 600;
          color: #6b7280;
          margin-right: 6px;
        }

        .pq-section {
          margin-bottom: 22px;
        }

        .pq-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .pq-bill-to {
          font-size: 13px;
          line-height: 1.65;
          color: #111827;
        }

        .pq-bill-to .name {
          font-weight: 650;
          font-size: 14px;
        }

        .pq-summary-text {
          font-size: 13.5px;
          line-height: 1.7;
          color: #1f2937;
          white-space: pre-line;
        }

        .pq-items {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 6px;
        }

        .pq-items th {
          text-align: left;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #6b7280;
          padding: 10px 8px;
          border-bottom: 1px solid #d1d5db;
        }

        .pq-items th.num,
        .pq-items td.num {
          text-align: right;
        }

        .pq-items td {
          padding: 12px 8px;
          font-size: 12.5px;
          vertical-align: top;
          border-bottom: 1px solid #f3f4f6;
          color: #111827;
        }

        .pq-desc {
          white-space: pre-line;
          line-height: 1.55;
        }

        .pq-totals {
          margin-left: auto;
          width: 260px;
          margin-top: 12px;
        }

        .pq-total-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 12.5px;
          padding: 6px 0;
          color: #374151;
        }

        .pq-total-row.grand {
          margin-top: 8px;
          padding-top: 10px;
          border-top: 1px solid #d1d5db;
          font-size: 15px;
          font-weight: 700;
          color: ${primaryColor};
        }

        .pq-body-text {
          font-size: 12.5px;
          line-height: 1.7;
          color: #1f2937;
          white-space: pre-line;
        }

        .pq-bullets {
          margin: 0;
          padding-left: 18px;
          font-size: 12.5px;
          line-height: 1.7;
          color: #1f2937;
        }

        .pq-bullets li {
          margin-bottom: 4px;
        }

        .pq-schedule {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }

        .pq-schedule th,
        .pq-schedule td {
          padding: 9px 8px;
          font-size: 12.5px;
          border-bottom: 1px solid #f3f4f6;
          text-align: left;
        }

        .pq-schedule th {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          border-bottom: 1px solid #d1d5db;
        }

        .pq-schedule td.num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .pq-acceptance {
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid #e5e7eb;
        }

        .pq-accept-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 28px;
          margin-top: 14px;
        }

        .pq-accept-field {
          font-size: 12px;
          color: #4b5563;
        }

        .pq-accept-line {
          margin-top: 22px;
          border-bottom: 1px solid #9ca3af;
          min-height: 18px;
        }

        .pq-pay-to {
          margin-top: 10px;
          padding: 10px 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          font-size: 12px;
          line-height: 1.6;
          white-space: pre-line;
        }

        .pq-footer {
          margin-top: 28px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 10px;
          color: #9ca3af;
          text-align: center;
          white-space: pre-line;
        }
      `}</style>

      <div className="printable-quotation printable-quote">
        <div className="pq-header">
          <div className="pq-brand">
            {logoSource ? (
              <img src={logoSource} alt={companyInfo.name} />
            ) : (
              <div className="pq-company-name">{companyInfo.name}</div>
            )}
            <div className="pq-company-details">
              {logoSource && companyInfo.name ? `${companyInfo.name}\n` : ''}
              {[companyInfo.location, companyInfo.email, companyInfo.phone, companyInfo.website]
                .filter(Boolean)
                .join('\n')}
            </div>
          </div>
          <div className="pq-meta">
            <h1 className="pq-title">{documentTitle || 'QUOTATION'}</h1>
            <div className="pq-meta-row">
              <span className="pq-meta-label">Quotation No:</span>
              {data.quoteNumber}
            </div>
            <div className="pq-meta-row">
              <span className="pq-meta-label">Date:</span>
              {meta?.dateLabel}
            </div>
            {meta?.validUntilLabel && (
              <div className="pq-meta-row">
                <span className="pq-meta-label">Valid Until:</span>
                {meta.validUntilLabel}
              </div>
            )}
            {meta?.statusLabel && (
              <div className="pq-meta-row">
                <span className="pq-meta-label">Status:</span>
                {meta.statusLabel}
              </div>
            )}
          </div>
        </div>

        <div className="pq-section">
          <div className="pq-section-title">Bill To</div>
          <div className="pq-bill-to">
            <div className="name">{customer.name || 'Customer'}</div>
            {customer.company && <div>{customer.company}</div>}
            {customer.phone && <div>{customer.phone}</div>}
            {customer.email && <div>{customer.email}</div>}
          </div>
        </div>

        {sections.projectSummary && (
          <div className="pq-section">
            <div className="pq-section-title">Project Summary</div>
            <div className="pq-summary-text">
              {data.title || data.description}
              {data.title && data.description && data.description !== data.title
                ? `\n${data.description}`
                : ''}
            </div>
          </div>
        )}

        <div className="pq-section">
          <table className="pq-items">
            <thead>
              <tr>
                <th style={{ width: '58%' }}>Description</th>
                <th className="num" style={{ width: '12%' }}>{sections.items?.qtyLabel || 'Qty'}</th>
                <th className="num" style={{ width: '15%' }}>{sections.items?.rateLabel || 'Rate'}</th>
                <th className="num" style={{ width: '15%' }}>{sections.items?.amountLabel || 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).length ? (data.items || []).map((item, index) => (
                <tr key={item.id || index}>
                  <td className="pq-desc">{item.description || '—'}</td>
                  <td className="num">{formatLineItemQuantity(item)}</td>
                  <td className="num">{money(item.unitPrice)}</td>
                  <td className="num">{money(item.total)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ color: '#6b7280' }}>No line items</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pq-totals">
            <div className="pq-total-row">
              <span>{sections.totals?.projectCostLabel || 'Project Cost'}</span>
              <span>{money(data.subtotal)}</span>
            </div>
            {parseFloat(data.discountTotal || 0) > 0 && (
              <div className="pq-total-row">
                <span>
                  Discount
                  {data.discountReason ? ` (${data.discountReason})` : ''}
                </span>
                <span>-{money(data.discountTotal)}</span>
              </div>
            )}
            {parseFloat(data.taxAmount || 0) > 0 && (
              <div className="pq-total-row">
                <span>
                  {companyInfo.taxDisplayLabel}
                  {parseFloat(data.taxRate || 0) > 0 ? ` (${parseFloat(data.taxRate).toFixed(2)}%)` : ''}
                </span>
                <span>{money(data.taxAmount)}</span>
              </div>
            )}
            <div className="pq-total-row grand">
              <span>{sections.totals?.grandTotalLabel || 'Grand Total'}</span>
              <span>{money(data.totalAmount)}</span>
            </div>
          </div>
        </div>

        {sections.scopeOfWork && (
          <div className="pq-section">
            <div className="pq-section-title">Scope of Work</div>
            <div className="pq-body-text">{data.scopeOfWork}</div>
          </div>
        )}

        {sections.terms && (
          <div className="pq-section">
            <div className="pq-section-title">Terms &amp; Conditions</div>
            <ul className="pq-bullets">
              {(data.termsBullets || []).map((bullet, index) => (
                <li key={`${index}-${bullet.slice(0, 24)}`}>{bullet}</li>
              ))}
            </ul>
          </div>
        )}

        {sections.paymentSchedule && (
          <div className="pq-section">
            <div className="pq-section-title">Payment Schedule</div>
            <table className="pq-schedule">
              <thead>
                <tr>
                  <th>Milestone</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(data.paymentSchedule || []).map((row, index) => {
                  const amountLabel = Number.isFinite(row.amount)
                    ? money(row.amount)
                    : (Number.isFinite(row.percent)
                      ? `${row.percent}%`
                      : '—');
                  return (
                    <tr key={`${row.label}-${index}`}>
                      <td>
                        {row.label}
                        {Number.isFinite(row.percent) && Number.isFinite(row.amount)
                          ? ` (${row.percent}%)`
                          : ''}
                      </td>
                      <td className="num">{amountLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {companyInfo.paymentDetailsEnabled && companyInfo.paymentDetails && (
          <div className="pq-section">
            <div className="pq-section-title">Pay To</div>
            <div className="pq-pay-to">{companyInfo.paymentDetails}</div>
          </div>
        )}

        {sections.clientAcceptance && (
          <div className="pq-acceptance">
            <div className="pq-section-title">Client Acceptance</div>
            <div className="pq-accept-grid">
              <div className="pq-accept-field">
                Accepted By
                <div className="pq-accept-line" />
              </div>
              <div className="pq-accept-field">
                Signature
                <div className="pq-accept-line" />
              </div>
              <div className="pq-accept-field">
                Date
                <div className="pq-accept-line" />
              </div>
              <div className="pq-accept-field">
                Company Stamp
                <div className="pq-accept-line" />
              </div>
            </div>
          </div>
        )}

        {companyInfo.invoiceFooter && (
          <div className="pq-footer">{companyInfo.invoiceFooter}</div>
        )}
      </div>
    </>
  );
};

export default PrintableQuotation;
