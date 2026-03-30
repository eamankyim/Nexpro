# Sending Invoices via Link and Accepting Payment

## How it works

1. **Create an invoice** (from a Job, Sale, or manually) in African Business Suite.
2. **Send the invoice** to the customer:
   - In **Invoices**, open the invoice and use **Send**, or use the row action **Send**.
   - The backend generates a unique payment link and (if configured) sends it by **email** and/or **WhatsApp**.
3. **Customer receives** the link, e.g. `https://yourapp.com/pay-invoice/abc123...`.
4. **Customer opens the link** (no login required), sees the invoice and can pay.
5. **Payment** is recorded against the invoice; when the balance is zero, the invoice is marked paid.

## Paystack (card / mobile money)

Customers can pay with **card or mobile money** via Paystack:

- On the pay-invoice page, they choose **Pay with Card or Mobile Money**, enter their email, and click **Pay**. They are redirected to Paystack’s secure page to complete payment.
- After payment, Paystack sends a webhook to your backend; the invoice is updated and the payment is recorded automatically.
- **Backend:** `POST /api/public/invoices/:token/initialize-paystack` (body: `{ email }`) returns `authorization_url` for redirect. The Paystack webhook `POST /api/webhooks/paystack` handles `charge.success` and applies the payment to the invoice when `metadata.type === 'invoice'`.
- **Config:** Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in the backend. Ensure the Paystack dashboard has the webhook URL set to `https://your-api.com/api/webhooks/paystack`. Set `FRONTEND_URL` so the Paystack callback URL is correct.

## What you need in the app

- **Backend:** Implemented.
  - `POST /api/invoices/:id/send` – send invoice, get payment link, optional email/WhatsApp.
  - `GET /api/public/invoices/:token` – public view of invoice by token.
  - `POST /api/public/invoices/:token/pay` – record payment manually (amount, method, reference).
  - `POST /api/public/invoices/:token/initialize-paystack` – start Paystack payment, returns `authorization_url`.
- **Frontend:** Public route `/pay-invoice/:token` – view invoice, “Pay with Card or Mobile Money” (Paystack), or “Record payment manually”.
- **Config:** Set `FRONTEND_URL` in backend `.env`. Configure email (and optionally WhatsApp) for “Send”. For Paystack, set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` and the webhook URL in the Paystack dashboard.

## Do you need licenses?

- **Sending an invoice via link**  
  No special license. It’s just sending a document/link. Normal business and data-protection rules apply (e.g. only send to the right customer, protect personal data).

- **Accepting payment online (card, mobile money, etc.)**  
  You don’t get a separate “payment license” yourself. You use a **licensed payment provider** (e.g. **Paystack** in Ghana/Nigeria). They are licensed (e.g. by the Bank of Ghana). You sign their merchant agreement and use their API/checkout. African Business Suite can record the payment when the provider confirms it; online collection is done through the provider.

- **What’s in the app today**  
  The public pay page offers **Pay with Card or Mobile Money** (Paystack) and **Record payment manually** (bank transfer, cash, etc.). Paystack collects the money; the webhook records it on the invoice. No separate payment license is needed; Paystack is the licensed provider.

- **Your business**  
  Normal business registration and tax rules still apply in your country; they are not specific to “invoice links” or “payment links.”

## Summary

| What                         | License needed? |
|-----------------------------|------------------|
| Send invoice to customer via link | No (normal business) |
| Customer views invoice at link   | No |
| Record payment (e.g. bank ref)   | No (bookkeeping only) |
| Collect payment online (card/MoMo) | Use Paystack (integrated); they hold the license |

---

## How to test

### Prerequisites

1. **Backend** and **Frontend** running (e.g. Backend on port 5001, Frontend on 3000).
2. **Backend `.env`:**
   - `FRONTEND_URL=http://localhost:3000` (or your frontend URL) so payment links and Paystack callback point to the right place.
   - For Paystack: `PAYSTACK_SECRET_KEY=sk_test_...` and `PAYSTACK_PUBLIC_KEY=pk_test_...` (use **test** keys from [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API Keys & Webhooks).
3. Logged in to the app as a user who can create/send invoices.

### 1. Get a payment link

1. In the app, go to **Invoices**.
2. Create an invoice (e.g. from a Job or Sale), or use an existing draft invoice with a balance.
3. Open the invoice and click **Send** (or use the row action **Send**).
4. The invoice is marked “sent”. The backend returns a `paymentLink` in the API response. To get the link:
   - **Option A:** If email is configured, the link is in the email; check your mail or logs.
   - **Option B:** Call the API and read the response:
     ```bash
     # Replace INVOICE_ID and use your auth token
     curl -X POST "http://localhost:5001/api/invoices/INVOICE_ID/send" \
       -H "Authorization: Bearer YOUR_JWT" \
       -H "tenant-id: YOUR_TENANT_ID"
     ```
     Copy `paymentLink` from the JSON (e.g. `http://localhost:3000/pay-invoice/abc123...`).
   - **Option C:** From the database: `SELECT "paymentToken" FROM invoices WHERE id = 'INVOICE_ID';` then open `http://localhost:3000/pay-invoice/<paymentToken>`.

### 2. Test the pay-invoice page (no Paystack)

1. Open the payment link in a browser (incognito or another browser so you’re not logged in).
2. You should see the invoice total, balance, and the “Pay this invoice” section.
3. **Record payment manually:** Fill amount, payment method, optional reference/name/email, click **Confirm payment**.
4. You should see “Thank you. This invoice is paid.” (or the updated balance if you paid less than the total).
5. In the app, open **Invoices** and confirm the invoice shows the new payment and status (e.g. Paid or Partial).

### 3. Test Paystack (redirect + payment)

1. Use **test** keys (`sk_test_...`, `pk_test_...`) so no real money is charged.
2. Open the payment link again (use an invoice that still has a balance; create a new one or use a partial-paid invoice).
3. In “Pay with Card or Mobile Money”, enter an email and click **Pay ₵ X.XX**.
4. You should be redirected to Paystack’s hosted page. Use Paystack’s **test cards** (e.g. card `5060 6666 6666 6666 666`, any future expiry, any CVV, or see [Paystack test cards](https://paystack.com/docs/payments/test-payments)).
5. Complete payment on Paystack. You should be redirected back to your app at `/pay-invoice/:token?paystack=1` and see “Payment submitted – confirming…”.
6. After a few seconds the page should refetch and show “Thank you. This invoice is paid.” (once the webhook has run).
7. In the app, check **Invoices** and **Payments** to confirm the payment is recorded.

### 4. Test webhook locally (Paystack → your machine)

Paystack must be able to POST to your backend. On localhost they cannot, so use a tunnel:

1. **Install ngrok** (or similar): `ngrok http 5001` (or whatever port your backend uses).
2. Note the HTTPS URL ngrok gives (e.g. `https://abc123.ngrok.io`).
3. In **Paystack Dashboard** → Settings → API Keys & Webhooks, set **Webhook URL** to:
   `https://abc123.ngrok.io/api/webhooks/paystack`
4. Trigger a Paystack payment from the pay-invoice page as in step 3. Paystack will send `charge.success` to your ngrok URL, which forwards to your local backend.
5. Check backend logs for `[Paystack Webhook] Invoice payment completed` and confirm the invoice updates in the app.

If you don’t set a webhook URL, the redirect back to your app still works, but the invoice won’t be updated until the webhook is received. For local testing without ngrok, you can temporarily call the “record payment” flow with the Paystack reference after paying, or use a deployed backend URL as the webhook target.

### 5. Quick checklist

| Step | What to check |
|------|----------------|
| Send invoice | Payment link in response or email; invoice status “sent”. |
| Open link | Public page loads without login; invoice details and balance correct. |
| Manual payment | Confirm payment → success message; invoice in app shows payment. |
| Paystack redirect | “Pay with Card or Mobile Money” → redirect to Paystack. |
| Paystack callback | After payment, redirect to `/pay-invoice/:token?paystack=1`. |
| Webhook | Backend logs show webhook received; invoice status/balance updated. |
