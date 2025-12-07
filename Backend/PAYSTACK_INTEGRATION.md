# Paystack Integration Guide

## Overview
This guide explains how to integrate Paystack for subscription management. Plans should be created in the Paystack dashboard for production use.

## Why Use Paystack Dashboard?

### ✅ Benefits:
1. **Automatic Recurring Billing** - Paystack handles subscription renewals automatically
2. **Payment Security** - PCI compliance handled by Paystack
3. **Fraud Protection** - Built-in fraud detection
4. **Webhook Support** - Real-time payment notifications
5. **Invoice Generation** - Automatic invoice emails
6. **Payment Methods** - Supports Card, Bank Transfer, and Mobile Money (MoMo)
7. **Subscription Management** - Easy plan updates, cancellations, prorations

## Setup Steps

### 1. Create Plans in Paystack Dashboard

1. Log in to [Paystack Dashboard](https://dashboard.paystack.com)
2. Go to **Settings → Plans**
3. Create the following plans:

#### Starter Plan
- **Name**: Starter
- **Amount**: GHS 9,900 (GHS 99 × 100 pesewas)
- **Interval**: Monthly
- **Plan Code**: `starter_monthly`
- **Description**: "Starter plan - Up to 5 team members"

#### Starter Plan (Yearly)
- **Name**: Starter (Yearly)
- **Amount**: GHS 95,000 (GHS 950 × 100 pesewas)
- **Interval**: Annually
- **Plan Code**: `starter_yearly`
- **Description**: "Starter plan - Up to 5 team members (20% off)"

#### Professional Plan
- **Name**: Professional
- **Amount**: GHS 19,900 (GHS 199 × 100 pesewas)
- **Interval**: Monthly
- **Plan Code**: `professional_monthly`
- **Description**: "Professional plan - Up to 20 team members"

#### Professional Plan (Yearly)
- **Name**: Professional (Yearly)
- **Amount**: GHS 191,000 (GHS 1,910 × 100 pesewas)
- **Interval**: Annually
- **Plan Code**: `professional_yearly`
- **Description**: "Professional plan - Up to 20 team members (20% off)"

#### Enterprise Plan
- **Name**: Enterprise
- **Amount**: GHS 29,900 (GHS 299 × 100 pesewas)
- **Interval**: Monthly
- **Plan Code**: `enterprise_monthly`
- **Description**: "Enterprise plan - Unlimited team members"

#### Enterprise Plan (Yearly)
- **Name**: Enterprise (Yearly)
- **Amount**: GHS 287,000 (GHS 2,870 × 100 pesewas)
- **Interval**: Annually
- **Plan Code**: `enterprise_yearly`
- **Description**: "Enterprise plan - Unlimited team members (20% off)"

### 2. Get Paystack API Keys

1. Go to **Settings → API Keys & Webhooks**
2. Copy your **Secret Key** (starts with `sk_`)
3. Copy your **Public Key** (starts with `pk_`)
4. Add to `.env`:
```env
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

### 3. Set Up Webhook URL

1. In Paystack Dashboard, go to **Settings → API Keys & Webhooks**
2. Add webhook URL: `https://your-backend.vercel.app/api/webhooks/paystack`
3. Select events to listen for:
   - `subscription.create`
   - `subscription.disable`
   - `subscription.enable`
   - `charge.success`
   - `invoice.payment_failed`
   - `invoice.payment_failed`

### 4. Install Paystack SDK

```bash
npm install paystack
```

### 5. Database Schema Updates

Add Paystack-specific fields to Tenant model:
- `paystackCustomerCode` - Paystack customer reference
- `paystackSubscriptionCode` - Active subscription reference
- `paystackPlanCode` - Current plan code from Paystack
- `subscriptionStatus` - active, cancelled, past_due, etc.

## Implementation Flow

### Frontend → Backend → Paystack

1. **User selects plan** → Frontend sends plan + billing period
2. **Backend creates Paystack subscription** → Returns authorization URL
3. **User completes payment** → Paystack redirects back
4. **Webhook confirms payment** → Backend updates tenant subscription
5. **Frontend shows success** → User redirected to dashboard

## Code Structure Needed

### Backend Services:
- `services/paystackService.js` - Paystack API wrapper
- `controllers/subscriptionController.js` - Handle subscription operations
- `controllers/webhookController.js` - Handle Paystack webhooks
- `routes/subscriptionRoutes.js` - Subscription endpoints
- `routes/webhookRoutes.js` - Webhook endpoints

### Frontend Updates:
- Update `Checkout.jsx` to use Paystack inline JS
- Add Paystack payment form component
- Handle payment callbacks

## Testing

Use Paystack Test Mode:
- Test cards: `4084084084084081` (success), `5060666666666666666` (declined)
- Test MoMo: Use test phone numbers from Paystack docs

## Migration Path

1. **Phase 1**: Install Paystack SDK, create service
2. **Phase 2**: Update checkout flow to use Paystack
3. **Phase 3**: Add webhook handlers
4. **Phase 4**: Migrate existing subscriptions (if any)
5. **Phase 5**: Remove manual subscription management

## Notes

- Paystack amounts are in **pesewas** (smallest currency unit)
- GHS 99 = 9,900 pesewas
- Always use Paystack plan codes, not internal plan IDs
- Store Paystack customer/subscription codes for future operations
- Handle webhook idempotency (same event may be sent multiple times)

