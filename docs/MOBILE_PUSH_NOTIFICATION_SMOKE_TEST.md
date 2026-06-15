# Mobile Push Notification Smoke Test

Use this checklist to verify killed-app notification tap routing on physical devices. Expo push taps cannot be fully validated in unit tests because delivery, OS notification trays, and cold-start handoff are device behavior.

## Prerequisites

- Install current builds for both apps on physical iOS or Android devices:
  - Seller app: `mobile/`
  - Buyer app: `sabito-buyer/`
- Sign in with test accounts that can receive push notifications.
- Allow notification permissions in each app.
- Confirm the backend can send Expo pushes to the registered test devices.

## Buyer App: Order Update Tap

1. Open `sabito-buyer/`, sign in as the buyer, and confirm the device is registered for push notifications.
2. Force quit the app so it is not running in the foreground or background.
3. Trigger an `order_update` push for an existing order. The notification data must include `type: "order_update"` and either `orderId` or `saleId`.
4. Tap the notification from the OS notification tray.
5. Verify the app cold-starts and lands on `/order/:id` for the order from the payload.
6. Repeat with a payload where the identifier is in `metadata.orderId` or `metadata.saleId`.

## Seller App: Online Order Tap

1. Open `mobile/`, sign in as the seller, and confirm the device is registered for push notifications.
2. Force quit the app so it is not running in the foreground or background.
3. Trigger an online store order push with `type: "order"`, `saleId`, and `metadata.source: "online_store"`.
4. Tap the notification from the OS notification tray.
5. Verify the app cold-starts and lands on `/store-order/:saleId`.
6. Repeat with no `saleId` and verify the app lands on `/(tabs)/online-orders`.

## Seller App: Stock Alert Tap

1. Force quit `mobile/`.
2. Trigger a stock alert push with `type: "inventory"` and `metadata.source: "stock_alert"`.
3. Tap the notification from the OS notification tray.
4. Verify the app cold-starts and lands on `/(tabs)/products`.

## Pass Criteria

- Tapping a killed-app notification opens the expected route on the first launch.
- The route uses the payload identifier when present.
- Missing or unrelated payloads do not navigate to an incorrect screen.
- The same notification is not replayed after closing and reopening the app.
