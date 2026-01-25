# Invoice Payment Links System

This document describes the payment link system that allows customers to view and pay invoices via a public link.

## Overview

When an invoice is sent to a customer, a unique payment token is generated. This token creates a secure, public link that customers can use to:
1. View invoice details
2. Make payments online
3. Track payment status

## Features

### 1. Payment Token Generation
- Each invoice automatically gets a unique `paymentToken` (64-character hex string)
- Token is generated when invoice is created or sent
- Token is unique and secure (crypto.randomBytes)

### 2. Sending Invoices
**Endpoint:** `POST /api/invoices/:id/send`

When you send an invoice:
- Payment token is generated if it doesn't exist
- Invoice status is updated to 'sent'
- Payment link is returned in the response

**Response:**
```json
{
  "success": true,
  "message": "Invoice marked as sent",
  "data": { /* invoice object */ },
  "paymentLink": "https://yourapp.com/pay-invoice/abc123..."
}
```

### 3. Public Invoice Viewing
**Endpoint:** `GET /api/public/invoices/:token`

Customers can view invoice details without authentication:
- Invoice number, date, due date
- Line items and totals
- Customer information
- Payment status and balance
- Payment link

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-2024-01-0001",
    "totalAmount": 1000.00,
    "balance": 1000.00,
    "status": "sent",
    "items": [...],
    "customer": {...},
    "tenant": { "name": "Company Name" }
  }
}
```

### 4. Public Payment Processing
**Endpoint:** `POST /api/public/invoices/:token/pay`

Customers can make payments via the public link:

**Request:**
```json
{
  "amount": 1000.00,
  "paymentMethod": "card",
  "referenceNumber": "TXN123456",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "invoice": { /* updated invoice */ },
    "payment": {
      "id": "...",
      "paymentNumber": "PAY-...",
      "amount": 1000.00,
      "paymentMethod": "card"
    }
  }
}
```

## Security Features

1. **Unique Tokens**: Each invoice has a unique, cryptographically secure token
2. **No Authentication Required**: Public endpoints don't require login
3. **Status Validation**: Cancelled or already-paid invoices cannot be paid again
4. **Amount Validation**: Payment amounts are validated against invoice balance

## Frontend Integration

### Payment Link Format
```
https://yourapp.com/pay-invoice/{paymentToken}
```

### Example Frontend Flow

1. **Send Invoice** (from admin dashboard):
   ```javascript
   const response = await invoiceService.send(invoiceId);
   const paymentLink = response.paymentLink;
   // Send this link via email/SMS to customer
   ```

2. **Customer Views Invoice** (public page):
   ```javascript
   const invoice = await fetch(`/api/public/invoices/${token}`);
   // Display invoice details
   ```

3. **Customer Makes Payment** (public page):
   ```javascript
   const result = await fetch(`/api/public/invoices/${token}/pay`, {
     method: 'POST',
     body: JSON.stringify({
       amount: invoice.balance,
       paymentMethod: 'card',
       customerEmail: 'customer@example.com'
     })
   });
   ```

## Email Integration (TODO)

Currently, the payment link is returned in the API response. To send it via email:

1. **Configure Email Service** (e.g., SendGrid, AWS SES, Nodemailer)
2. **Create Email Template**:
   ```
   Subject: Invoice {invoiceNumber} - Payment Required
   
   Dear {customerName},
   
   Please find your invoice attached.
   
   Invoice Number: {invoiceNumber}
   Amount Due: {balance}
   Due Date: {dueDate}
   
   Pay online: {paymentLink}
   
   Thank you for your business!
   ```

3. **Update sendInvoice function** to send email with payment link

## Database Migration

Run the migration to add payment tokens to existing invoices:
```bash
node Backend/migrations/add-payment-token-to-invoices.js
```

## Environment Variables

Make sure `FRONTEND_URL` is set in your `.env`:
```
FRONTEND_URL=https://yourapp.com
```

This is used to generate the payment links.

## API Endpoints Summary

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/invoices/:id/send` | Private | Send invoice and get payment link |
| GET | `/api/public/invoices/:token` | Public | View invoice by token |
| POST | `/api/public/invoices/:token/pay` | Public | Process payment |

## Testing

1. Create an invoice
2. Send the invoice: `POST /api/invoices/:id/send`
3. Copy the `paymentLink` from response
4. Visit the link in a browser (or use the public API)
5. View invoice: `GET /api/public/invoices/:token`
6. Make payment: `POST /api/public/invoices/:token/pay`
