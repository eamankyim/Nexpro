/**
 * Email Templates for ShopWISE
 * 
 * HTML email templates for various notification types.
 */

/**
 * Base email template wrapper
 * @param {string} content - Inner content HTML
 * @param {Object} options - Template options
 * @returns {string} - Complete HTML email
 */
const baseTemplate = (content, options = {}) => {
  const {
    companyName = 'ShopWISE',
    companyLogo = '',
    primaryColor = '#166534',
    footerText = ''
  } = options;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email from ${companyName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f4f4;
      color: #333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: ${primaryColor};
      padding: 24px;
      text-align: center;
    }
    .header img {
      max-height: 50px;
      max-width: 200px;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 12px 32px;
      background-color: ${primaryColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    .info-table th,
    .info-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-table th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .amount {
      font-size: 28px;
      font-weight: 700;
      color: ${primaryColor};
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-pending {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-paid {
      background-color: #d1fae5;
      color: #065f46;
    }
    .status-overdue {
      background-color: #fee2e2;
      color: #991b1b;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" />` : `<h1>${companyName}</h1>`}
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${footerText || `&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.`}</p>
      <p>This email was sent automatically. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} - Formatted amount
 */
const formatCurrency = (amount, currency = 'GHS') => {
  return `${currency} ${parseFloat(amount || 0).toFixed(2)}`;
};

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Invoice notification email template
 * @param {Object} invoice - Invoice data
 * @param {Object} customer - Customer data
 * @param {string} paymentLink - Payment link URL
 * @param {Object} company - Company/tenant data
 * @returns {Object} - { subject, html, text }
 */
const invoiceNotification = (invoice, customer, paymentLink, company = {}) => {
  const {
    invoiceNumber,
    total,
    currency = 'GHS',
    dueDate,
    status,
    items = []
  } = invoice;

  const customerName = customer?.name || customer?.companyName || 'Valued Customer';
  const companyName = company.name || 'ShopWISE';

  const statusClass = status === 'paid' ? 'status-paid' : 
                      status === 'overdue' ? 'status-overdue' : 'status-pending';

  const itemsHtml = items.length > 0 ? `
    <table class="info-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: right;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.description || item.name || 'Item'}</td>
            <td style="text-align: right;">${item.quantity || 1}</td>
            <td style="text-align: right;">${formatCurrency(item.total || item.amount, currency)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  const content = `
    <h2 style="margin-top: 0;">Invoice ${invoiceNumber}</h2>
    
    <p>Dear ${customerName},</p>
    
    <p>Please find below the details of your invoice. Click the button below to view or pay your invoice online.</p>
    
    <div style="background-color: #f8f9fa; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #666;">Amount Due</p>
      <p class="amount">${formatCurrency(total, currency)}</p>
      <span class="status-badge ${statusClass}">${status?.toUpperCase() || 'PENDING'}</span>
    </div>
    
    <table class="info-table">
      <tr>
        <td><strong>Invoice Number</strong></td>
        <td>${invoiceNumber}</td>
      </tr>
      <tr>
        <td><strong>Due Date</strong></td>
        <td>${formatDate(dueDate)}</td>
      </tr>
      <tr>
        <td><strong>Customer</strong></td>
        <td>${customerName}</td>
      </tr>
    </table>
    
    ${itemsHtml}
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${paymentLink}" class="button">View & Pay Invoice</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If you have any questions about this invoice, please contact us.
    </p>
  `;

  const text = `
Invoice ${invoiceNumber}

Dear ${customerName},

Your invoice is ready for payment.

Amount Due: ${formatCurrency(total, currency)}
Due Date: ${formatDate(dueDate)}
Status: ${status || 'Pending'}

View and pay your invoice here: ${paymentLink}

If you have any questions, please contact us.

${companyName}
  `.trim();

  return {
    subject: `Invoice ${invoiceNumber} - ${formatCurrency(total, currency)} Due`,
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

/**
 * Invoice paid confirmation email template
 * @param {Object} invoice - Invoice data
 * @param {Object} customer - Customer data
 * @param {Object} company - Company/tenant data
 * @returns {Object} - { subject, html, text }
 */
const invoicePaidConfirmation = (invoice, customer, company = {}) => {
  const {
    invoiceNumber,
    total,
    currency = 'GHS',
    paidDate
  } = invoice;

  const customerName = customer?.name || customer?.companyName || 'Valued Customer';
  const companyName = company.name || 'ShopWISE';

  const content = `
    <h2 style="margin-top: 0;">Payment Received</h2>
    
    <p>Dear ${customerName},</p>
    
    <p>Thank you! We have received your payment for invoice ${invoiceNumber}.</p>
    
    <div style="background-color: #d1fae5; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #065f46;">Payment Confirmed</p>
      <p class="amount" style="color: #065f46;">${formatCurrency(total, currency)}</p>
      <span class="status-badge status-paid">PAID</span>
    </div>
    
    <table class="info-table">
      <tr>
        <td><strong>Invoice Number</strong></td>
        <td>${invoiceNumber}</td>
      </tr>
      <tr>
        <td><strong>Amount Paid</strong></td>
        <td>${formatCurrency(total, currency)}</td>
      </tr>
      <tr>
        <td><strong>Payment Date</strong></td>
        <td>${formatDate(paidDate || new Date())}</td>
      </tr>
    </table>
    
    <p style="color: #666; font-size: 14px;">
      This email serves as your payment confirmation. Thank you for your business!
    </p>
  `;

  const text = `
Payment Received - Invoice ${invoiceNumber}

Dear ${customerName},

Thank you! We have received your payment.

Invoice Number: ${invoiceNumber}
Amount Paid: ${formatCurrency(total, currency)}
Payment Date: ${formatDate(paidDate || new Date())}

This email serves as your payment confirmation.

Thank you for your business!

${companyName}
  `.trim();

  return {
    subject: `Payment Received - Invoice ${invoiceNumber}`,
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

/**
 * Payment reminder email template
 * @param {Object} invoice - Invoice data
 * @param {Object} customer - Customer data
 * @param {string} paymentLink - Payment link URL
 * @param {Object} company - Company/tenant data
 * @param {string} reminderType - Type: 'upcoming', 'due', 'overdue'
 * @returns {Object} - { subject, html, text }
 */
const paymentReminder = (invoice, customer, paymentLink, company = {}, reminderType = 'due') => {
  const {
    invoiceNumber,
    total,
    currency = 'GHS',
    dueDate
  } = invoice;

  const customerName = customer?.name || customer?.companyName || 'Valued Customer';
  const companyName = company.name || 'ShopWISE';

  let urgencyMessage, subjectPrefix, statusClass;
  
  switch (reminderType) {
    case 'upcoming':
      urgencyMessage = `Your invoice ${invoiceNumber} will be due on ${formatDate(dueDate)}.`;
      subjectPrefix = 'Payment Due Soon';
      statusClass = 'status-pending';
      break;
    case 'overdue':
      urgencyMessage = `Your invoice ${invoiceNumber} is now overdue. It was due on ${formatDate(dueDate)}.`;
      subjectPrefix = 'Overdue Payment';
      statusClass = 'status-overdue';
      break;
    default: // 'due'
      urgencyMessage = `Your invoice ${invoiceNumber} is due today.`;
      subjectPrefix = 'Payment Due Today';
      statusClass = 'status-pending';
  }

  const content = `
    <h2 style="margin-top: 0;">${subjectPrefix}</h2>
    
    <p>Dear ${customerName},</p>
    
    <p>${urgencyMessage} Please make your payment at your earliest convenience.</p>
    
    <div style="background-color: ${reminderType === 'overdue' ? '#fee2e2' : '#fef3c7'}; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: ${reminderType === 'overdue' ? '#991b1b' : '#92400e'};">Amount Due</p>
      <p class="amount" style="color: ${reminderType === 'overdue' ? '#991b1b' : '#92400e'};">${formatCurrency(total, currency)}</p>
      <span class="status-badge ${statusClass}">${reminderType === 'overdue' ? 'OVERDUE' : 'DUE'}</span>
    </div>
    
    <table class="info-table">
      <tr>
        <td><strong>Invoice Number</strong></td>
        <td>${invoiceNumber}</td>
      </tr>
      <tr>
        <td><strong>Due Date</strong></td>
        <td>${formatDate(dueDate)}</td>
      </tr>
    </table>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${paymentLink}" class="button">Pay Now</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If you have already made this payment, please disregard this reminder.
    </p>
  `;

  const text = `
${subjectPrefix} - Invoice ${invoiceNumber}

Dear ${customerName},

${urgencyMessage}

Amount Due: ${formatCurrency(total, currency)}
Due Date: ${formatDate(dueDate)}

Pay now: ${paymentLink}

If you have already made this payment, please disregard this reminder.

${companyName}
  `.trim();

  return {
    subject: `${subjectPrefix} - Invoice ${invoiceNumber}`,
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

/**
 * Welcome email template for new users
 * @param {Object} user - User data
 * @param {Object} company - Company/tenant data
 * @param {string} loginUrl - Login URL
 * @returns {Object} - { subject, html, text }
 */
const welcomeEmail = (user, company = {}, loginUrl = '') => {
  const userName = user?.name || 'User';
  const companyName = company.name || 'ShopWISE';
  const defaultLoginUrl = loginUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

  const content = `
    <h2 style="margin-top: 0;">Welcome to ${companyName}!</h2>
    
    <p>Dear ${userName},</p>
    
    <p>Your account has been created successfully. You can now log in and start using the platform.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${defaultLoginUrl}/login" class="button">Log In to Your Account</a>
    </div>
    
    <p>If you did not create this account, please contact support immediately.</p>
  `;

  const text = `
Welcome to ${companyName}!

Dear ${userName},

Your account has been created successfully.

Log in here: ${defaultLoginUrl}/login

If you did not create this account, please contact support.

${companyName}
  `.trim();

  return {
    subject: `Welcome to ${companyName}!`,
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

/**
 * Password reset email template
 * @param {Object} user - User data
 * @param {string} resetLink - Password reset link
 * @param {Object} company - Company/tenant data
 * @returns {Object} - { subject, html, text }
 */
const passwordReset = (user, resetLink, company = {}) => {
  const userName = user?.name || 'User';
  const companyName = company.name || 'ShopWISE';

  const content = `
    <h2 style="margin-top: 0;">Password Reset Request</h2>
    
    <p>Dear ${userName},</p>
    
    <p>We received a request to reset your password. Click the button below to create a new password.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      This link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact support if you have concerns.
    </p>
  `;

  const text = `
Password Reset Request

Dear ${userName},

We received a request to reset your password.

Reset your password here: ${resetLink}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

${companyName}
  `.trim();

  return {
    subject: 'Password Reset Request',
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

/**
 * Low stock alert email template
 * @param {Array} items - Array of low stock items
 * @param {Object} company - Company/tenant data
 * @returns {Object} - { subject, html, text }
 */
const lowStockAlert = (items, company = {}) => {
  const companyName = company.name || 'ShopWISE';

  const itemsHtml = `
    <table class="info-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Current Stock</th>
          <th style="text-align: center;">Reorder Level</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.name}${item.sku ? ` (${item.sku})` : ''}</td>
            <td style="text-align: center; color: ${item.quantityOnHand <= 0 ? '#991b1b' : '#92400e'};">
              ${item.quantityOnHand} ${item.unit || 'pcs'}
            </td>
            <td style="text-align: center;">${item.reorderLevel} ${item.unit || 'pcs'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const content = `
    <h2 style="margin-top: 0;">Low Stock Alert</h2>
    
    <p>The following items are running low and need to be restocked:</p>
    
    ${itemsHtml}
    
    <p style="color: #666; font-size: 14px;">
      Please review and reorder these items to avoid stockouts.
    </p>
  `;

  const itemsList = items.map(i => `- ${i.name}: ${i.quantityOnHand} ${i.unit || 'pcs'} (Reorder at: ${i.reorderLevel})`).join('\n');

  const text = `
Low Stock Alert

The following items need to be restocked:

${itemsList}

Please review and reorder these items.

${companyName}
  `.trim();

  return {
    subject: `Low Stock Alert - ${items.length} item${items.length !== 1 ? 's' : ''} need restocking`,
    html: baseTemplate(content, {
      companyName,
      companyLogo: company.logo,
      primaryColor: company.primaryColor || '#166534'
    }),
    text
  };
};

module.exports = {
  baseTemplate,
  formatCurrency,
  formatDate,
  invoiceNotification,
  invoicePaidConfirmation,
  paymentReminder,
  welcomeEmail,
  passwordReset,
  lowStockAlert
};
