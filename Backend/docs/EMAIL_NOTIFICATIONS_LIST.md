# Email notifications – what exists and who pays

## Summary

- **Platform email (you pay):** System/account emails – use `PLATFORM_EMAIL_*` env. Sent via `emailService.sendPlatformMessage()`.
- **Tenant email (business pays):** Business-to-customer and internal tenant emails – use Settings → Email per tenant. Sent via `emailService.sendMessage(tenantId, ...)`.

---

## 1. Platform emails (you pay – platform config)

| Item | Recipient | When | Implemented | Template / Notes |
|------|-----------|------|--------------|------------------|
| **Password reset** | User (account email) | Forgot password | ✅ Yes | `passwordReset` in emailTemplates |
| **Welcome email** | New user | After signup (if you add it) | ❌ Template only | `welcomeEmail` – not sent anywhere yet |
| **Invite email (invitee)** | Invited person | When admin invites by email (if you add it) | ❌ No | Invite currently returns `inviteUrl` in API; no email sent to invitee |

---

## 2. Business → customer emails (tenant config – business pays)

| Item | Recipient | When | Implemented | Template / Notes |
|------|-----------|------|--------------|------------------|
| **Quote sent** | Customer | When quote is created with "Send to customer" and email is configured | ✅ Yes | `quoteNotification` – quoteController (auto-send on create) |
| **Invoice sent** | Customer | When business sends invoice to customer | ✅ Yes | `invoiceNotification` – invoiceController |
| **Sale receipt** | Customer | When business sends receipt (POS / sale) via email | ⚠️ Broken | saleController uses `emailService.sendEmail()` which does not exist; should use `sendMessage(tenantId, ...)` |
| **Invoice paid confirmation** | Customer | After invoice is paid (if you add it) | ❌ Template only | `invoicePaidConfirmation` – not sent anywhere yet |
| **Payment reminder (email)** | Customer | Overdue invoice reminder | ❌ Template only | `paymentReminder` – paymentReminderService currently sends **WhatsApp** only, not email |
| **Low stock alert (to customer)** | N/A | N/A | N/A | Not applicable (alerts go to staff) |

### Quote email – why it might not send

- **Settings → Integrations → Email** must be **turned on** (enabled) and have SMTP or SendGrid/SES configured. If the toggle is off or credentials are missing, quote email is skipped.
- The **customer** linked to the quote must have an **email address** (Customers → edit customer).
- When creating the quote, **Send quote to customer** must be checked and at least one channel (Email, WhatsApp, or SMS) must be configured; if Email is the only one, it must be configured as above.
- If send fails (e.g. SMTP auth error), the API returns `delivery.emailError`; the app shows a toast with the error.

---

## 3. Internal tenant emails (to staff / tenant users – tenant config, business pays)

These are **in-app notifications** that can also be sent by **email** when the activity type includes `CHANNELS.EMAIL` in `activityLogger` and tenant has email configured. Recipients are tenant users (staff/managers), not customers.

| Activity type | Recipients | Channels (in-app + email) | Trigger |
|---------------|------------|----------------------------|--------|
| **Job assigned** | Everyone (tenant) | in_app, email | Job assigned to user |
| **Job completed** | Everyone | in_app, email | Job marked completed |
| **Invoice sent** | Everyone | in_app, email | Invoice sent to customer |
| **Invoice paid** | Everyone | in_app, email, sms | Invoice paid |
| **Invoice overdue** | Everyone | in_app, email | Invoice overdue |
| **Payment received** | Everyone | in_app, email | Payment recorded |
| **Quote accepted** | Everyone | in_app, email | Quote accepted |
| **Lead assigned** | Everyone | in_app, email | Lead assigned |
| **Lead converted** | Everyone | in_app, email | Lead converted to customer |
| **Expense submitted** | Everyone | in_app, email | Expense submitted |
| **Expense approved** | Everyone | in_app, email | Expense approved |
| **Expense rejected** | Everyone | in_app, email | Expense rejected |
| **User invited** | Everyone | **email only** | User invite created (notify team; does not email the invitee) |
| **Materials low stock** | Everyone | in_app, email | Low stock alert |

All of the above use **tenant** email config (Settings → Email). If tenant has not configured email, only in-app (and SMS where configured) is used.

---

## 4. Other / variance alerts

| Item | Recipient | When | Implemented | Notes |
|------|-----------|------|--------------|--------|
| **Stock variance / shrinkage alert** | Tenant (in-app) | varianceDetectionService | Notifications created with `channels: ['in_app', 'email']` | Email sending for these notifications depends on notification pipeline; currently in-app + real-time emit are used |

---

## 5. Email templates that exist but are not used for sending

- `invoicePaidConfirmation` – for sending “invoice paid” to **customer** (not implemented).
- `paymentReminder` – for **email** payment reminders (payment reminders today are WhatsApp-only).
- `welcomeEmail` – for new user welcome (not implemented).
- `lowStockAlert` – for emailing **tenant staff** about low stock; activity type `MATERIALS_LOW_STOCK` has email channel but the code that triggers low-stock and calls the logger would need to use this template if you want branded HTML (activityLogger currently sends a generic title+message email).

---

## 6. Quick reference: who pays

| Category | Who pays | Config |
|----------|----------|--------|
| Password reset, welcome, invite-to-signup (when you add them) | **Platform (you)** | `PLATFORM_EMAIL_*` env |
| Invoice to customer, receipt to customer, payment reminder (email), invoice paid (email) | **Tenant (business)** | Settings → Email per tenant |
| Internal tenant notifications (job/invoice/quote/lead/expense/low stock, etc.) | **Tenant (business)** | Same Settings → Email |

---

## 7. Suggested follow-ups

1. **Sale receipt email:** Replace `emailService.sendEmail(...)` in saleController with `emailService.sendMessage(tenantId, to, subject, html, text)` (and optionally use a proper receipt template).
2. **Invite email (to invitee):** Optionally send an email to the invitee with signup link using **platform** email (you pay) so they don’t rely on the admin copying the link.
3. **Welcome email:** Optionally send after registration using **platform** email and `welcomeEmail` template.
4. **Payment reminder (email):** Optionally use tenant email + `paymentReminder` template alongside or instead of WhatsApp in paymentReminderService.
5. **Invoice paid (to customer):** Optionally send `invoicePaidConfirmation` to customer when invoice is paid, using **tenant** email.
