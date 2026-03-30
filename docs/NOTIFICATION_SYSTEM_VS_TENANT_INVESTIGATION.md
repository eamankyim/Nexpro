# System vs Tenant Notifications – Investigation Summary

## Your requirements (summary)

| Layer | Who pays | Channels | Config | Provider (example) |
|-------|----------|----------|--------|--------------------|
| **System** | Company | Email + in-app only (important ones: verifications, etc.) | ENV | SendGrid |
| **Tenant** | Tenant | SMS, Email, WhatsApp – tenant chooses in Settings | Settings per tenant | Default SMS: **Termii**; tenant provides their own |

---

## 1. Current state

### System (platform) emails – company pays, ENV

- **Config:** `emailService.getPlatformConfig()` reads from ENV: `PLATFORM_EMAIL_PROVIDER`, `PLATFORM_SENDGRID_API_KEY`, etc.
- **SendGrid:** Already supported. Set `PLATFORM_EMAIL_PROVIDER=sendgrid` and `PLATFORM_SENDGRID_API_KEY=...` in `.env`.
- **Used for (all correct – important only):**
  - Password reset – [authController.js](Backend/controllers/authController.js)
  - Email verification (signup) – [tenantController.js](Backend/controllers/tenantController.js)
  - Resend verification – [authController.js](Backend/controllers/authController.js)
  - Payment settings OTP email – [settingsController.js](Backend/controllers/settingsController.js)
  - Bank account linked confirmation – [settingsController.js](Backend/controllers/settingsController.js)

No system SMS is sent today; system uses only email + in-app. That matches “we are using only emails and in-app notifications” for system.

### Tenant-specific notifications – tenant pays, Settings

- **Email:** Tenant config in Settings → Email (key `email`). Providers: SMTP, SendGrid, AWS SES. Used for: invoice sent, invoice paid confirmation, sale receipt, activityLogger internal emails.
- **SMS:** Tenant config in Settings → SMS (key `sms`). **Current providers:** Twilio, Africa’s Talking. **Default in code:** `twilio`. Used for: invoice sent, payment reminder, quote sent, sale receipt, invoice paid confirmation.
- **WhatsApp:** Tenant config in Settings → WhatsApp (key `whatsapp`). Used for: invoice sent, payment reminder, quote delivery.

Tenant flows correctly use tenant config (e.g. `emailService.getConfig(tenantId)`, `smsService.getResolvedConfig(tenantId)`). One nuance: **SMS** uses “resolved” config: if the tenant has no SMS config, the app can fall back to **platform SMS** (ENV: `PLATFORM_SMS_ENABLED`, Twilio/Africa’s Talking). So today tenant notifications can sometimes be sent using the company’s SMS account. If you want “tenant notifications = tenant pays only”, that fallback should be removed (see changes below).

---

## 2. What needs to change

### A. Default tenant SMS provider: Termii

- **Backend**
  - **SMS service ([Backend/services/smsService.js](Backend/services/smsService.js))**
    - Add **Termii** as a provider:
      - Send: `POST https://api.termii.com/api/sms/send` (or `TERMII_BASE_URL` from env). Body: `api_key`, `to` (e.g. 234…), `from` (sender ID, 3–11 chars), `sms`, `type: "plain"`, `channel: "dnd"` (transactional).
    - In `sendMessage` and `testConnection`, handle `provider === 'termii'`.
  - **Settings ([Backend/controllers/settingsController.js](Backend/controllers/settingsController.js))**
    - Default SMS provider: change from `'twilio'` to `'termii'` in `getSMSSettings` default and in `updateSMSSettings` when deriving `finalProvider`.
    - For Termii, validation: require **API Key** and **Sender ID** (`from`). Termii does not use accountSid/authToken/fromNumber; store e.g. `apiKey` and `senderId` (or reuse `fromNumber` for sender ID). Add a `senderId` field in the stored SMS settings object for Termii.
    - In `testSMSConnection`, support `provider: 'termii'` and call `smsService.testConnection` with Termii config (e.g. apiKey + senderId).

- **Frontend ([Frontend/src/pages/Settings.jsx](Frontend/src/pages/Settings.jsx))**
  - SMS provider enum: add `'termii'` and use it as the **default** (e.g. `provider: z.enum(['termii', 'twilio', 'africas_talking']).default('termii')`).
  - When provider is Termii, show fields: **API Key**, **Sender ID** (3–11 chars). Hide Twilio / Africa’s Talking fields when Termii is selected.
  - Load/save: map `senderId` (or chosen field name) to/from the API so the backend can store and use it for Termii.

### B. Optional: Tenant-only SMS (no platform fallback)

- If tenant notifications must be **only** tenant-paid:
  - In [Backend/services/smsService.js](Backend/services/smsService.js), change `getResolvedConfig(tenantId)` so it returns **only** tenant config (no fallback to `getPlatformConfigFromEnv()`). Then receipts/invoice/quote/payment-reminder SMS are sent only when the tenant has configured SMS in Settings.
- If you keep the current behaviour, tenants without SMS config can still send via platform SMS (company pays for those).

### C. ENV and docs

- **[Backend/env.example](Backend/env.example)** (and any runbook):
  - **Platform email:** State clearly that it is for **system emails only** (verifications, password reset, etc.), company pays, and that **SendGrid** is the recommended provider (`PLATFORM_EMAIL_PROVIDER=sendgrid`, `PLATFORM_SENDGRID_API_KEY=...`).
  - **Platform SMS:** State that it is **optional** and, if used, acts as a fallback when a tenant has no SMS config; if you adopt “tenant-only SMS”, document that platform SMS is unused for tenant notifications.
  - **Tenant notifications:** State that payment reminders, invoice/quote/receipt notifications are **tenant-configured** in Settings (SMS, Email, WhatsApp) and that the **default SMS provider for tenants is Termii** (they supply API Key and Sender ID in Settings).

### D. No change needed

- **System emails:** Already only for important flows; SendGrid already supported via ENV. No code change required for “system = email + in-app, company pays, SendGrid.”
- **Tenant email/WhatsApp:** Already configured per tenant in Settings; no change for “tenant chooses and pays.”

---

## 3. Termii integration details (for implementation)

- **Send SMS**
  - `POST https://api.termii.com/api/sms/send`
  - Body (JSON): `api_key`, `to` (string, e.g. `"23490126727"`), `from` (sender ID), `sms`, `type: "plain"`, `channel: "dnd"` (for transactional) or `"generic"`.
- **Test connection**
  - Termii may not expose a dedicated “account” endpoint; common approach: send a test SMS to a known number or use a balance/status endpoint if they provide one. Otherwise “test” can mean “validate api_key + sender ID format” and optionally send a test message.
- **Tenant settings shape for Termii**
  - `provider: 'termii'`, `apiKey: '...'`, `senderId: '...'` (3–11 alphanumeric). Backend and frontend must read/write `senderId` for Termii; Twilio/AT keep using `accountSid`/`authToken`/`fromNumber` as today.

---

## 4. File checklist

| File | Change |
|------|--------|
| [Backend/services/smsService.js](Backend/services/smsService.js) | Add Termii: send (sendViaTermii), testConnection(termii). Optionally remove platform fallback in getResolvedConfig. |
| [Backend/controllers/settingsController.js](Backend/controllers/settingsController.js) | Default provider `'termii'`. Validate/save Termii (apiKey + senderId). testSMSConnection for termii. |
| [Frontend/src/pages/Settings.jsx](Frontend/src/pages/Settings.jsx) | Add `termii` to SMS provider enum and as default. Termii form: API Key, Sender ID. Load/save senderId. |
| [Backend/env.example](Backend/env.example) | Document: system email = SendGrid (recommended); tenant SMS default = Termii, configured in Settings. |

---

## 5. Summary

- **System:** Already “email + in-app, important only, company pays, ENV, SendGrid” – no structural change; only ENV/docs clarification.
- **Tenant:** Already “Settings, tenant chooses SMS/Email/WhatsApp”. Remaining work: **add Termii as default tenant SMS provider** (backend + frontend + settings default and validation) and, if desired, **make tenant SMS strictly tenant-only** by dropping platform SMS fallback for tenant notifications.
