# Status and Chip Color Consistency

This document describes the app-wide color scheme for status chips and priority/role badges so that the same meaning always uses the same color.

## Semantic color mapping

| Meaning | Color | Tailwind classes | Use for |
|--------|--------|------------------|--------|
| Success / Done / Closed positive | Green | `bg-green-100 text-green-800 border-green-300` | completed, paid, approved, converted, accepted, posted, in_stock, active_flag (account/product), synced, filled, dispensed |
| Danger / Closed negative / Error | Red | `bg-red-100 text-red-800 border-red-300` | cancelled, lost, rejected, terminated, declined, expired, out_of_stock, suspended, failed, inactive, inactive_flag, offline |
| Warning / Attention / Pending | Orange | `bg-orange-100 text-orange-800 border-orange-300` | pending, on_hold, partial, overdue |
| In progress / Info | Blue | `bg-blue-100 text-blue-800 border-blue-300` | in_progress, processing, sent, contacted, active (employee/work), syncing, sending |
| Draft / New / Not yet active | Yellow | `bg-yellow-100 text-yellow-800 border-yellow-300` | new, draft, trialing |
| Special / Qualified / Soft state | Purple | `bg-purple-100 text-purple-800 border-purple-300` | qualified, on_leave, probation, paused |
| Neutral / Unknown | Gray | `bg-gray-100 text-gray-800 border-gray-300` | default fallback, online, ready |

## Where it lives

- **Status chips**: `STATUS_CHIP_CLASSES` and `STATUS_CHIP_DEFAULT_CLASS` in [src/constants/index.js](src/constants/index.js). The [StatusChip](src/components/StatusChip.jsx) component looks up the status (normalized to lowercase, spaces → underscores) and applies the class.
- **Priority chips** (Jobs, Leads): `PRIORITY_CHIP_CLASSES` in constants. low → gray, medium → blue, high → orange, urgent → red.
- **Role chips** (Users): `ROLE_CHIP_CLASSES` in constants. admin → red, manager → primary, employee/staff → gray.

## Adding a new status

1. Add the status value (lowercase, use underscores) to `STATUS_CHIP_CLASSES` in [src/constants/index.js](src/constants/index.js).
2. Choose the color by meaning: green (success), red (danger), orange (warning), blue (in progress), yellow (draft/new), purple (special), gray (neutral).
3. Use one of the existing `CHIP_*` constants (e.g. `CHIP_GREEN`) so styling stays consistent.

## Stock status

Use the status **key** (e.g. `in_stock`, `low_stock`, `out_of_stock`) from `getStockStatus(quantity, reorderLevel)` when passing to StatusChip, not the label. StatusChip also accepts label forms like `"out of stock"` (normalized to `out_of_stock`).

## Active / Inactive (account or product)

Use `active_flag` and `inactive_flag` as the status value so they render green and red and display as "Active" and "Inactive".
