---
name: Sidebar Quick actions
overview: Add a "Quick actions" section to the sidebar after Settings (matching NEXPulse design), with the top three one-click actions per business type. Wire Sales openPOS so Point of Sale opens POS from quick action.
todos:
  - id: quick-actions-config
    content: Add getQuickActions(businessType) returning 3 items (label, path, icon) per type
  - id: quick-actions-after-settings
    content: Render Quick actions block after Settings in Sidebar and MobileSidebar
  - id: sales-open-pos
    content: Sales page read openPOS=1 from URL and open POS modal on mount
---

# Sidebar Quick actions (after Settings)

## Placement (match design)

**Quick actions** appear **after Settings** at the bottom of the sidebar, matching the NEXPulse design:

- Order: … Advanced, Reports, Users, Settings, **Quick actions** (3 items), then collapse button.
- So: main nav → Advanced → Reports → Users → Settings → **Quick actions** → footer/collapse.

## Top three quick actions per business type

| Business type   | Action 1        | Action 2         | Action 3      |
|-----------------|-----------------|------------------|---------------|
| **Shop**        | Point of Sale   | Restock          | Add customer  |
| **Pharmacy**    | Point of Sale   | New prescription| Restock       |
| **Printing press** | New job      | New quote        | Add customer  |

- **Shop / Pharmacy:** Point of Sale → `/sales?openPOS=1`; Restock → `/inventory`; Add customer → `/customers`; New prescription → `/prescriptions`.
- **Printing press:** New job → `/jobs`; New quote → `/quotes`; Add customer → `/customers`.

## File to change

- [Frontend/src/components/layout/Sidebar.jsx](Frontend/src/components/layout/Sidebar.jsx): add `getQuickActions(businessType)`; render Quick actions **after** Settings (before the collapse button in the aside).
- [Frontend/src/pages/Sales.jsx](Frontend/src/pages/Sales.jsx): read `openPOS=1` from search params on mount and call `setPosModalOpen(true)`.

## Implementation steps

1. **getQuickActions(businessType)**  
   Return array of 3 items: `{ label, path, icon }`. Use lucide-react icons (e.g. ShoppingCart, PackagePlus or RefreshCw, UserPlus, FileText, FilePlus, Pill). Return `[]` if no business type.

2. **Sidebar: render after Settings**  
   In the same `<nav>` (or aside), after the loop that renders menu items (which includes Settings), insert:
   - A “Quick actions” section label.
   - A list of 3 links/buttons from `getQuickActions(businessType)`, each navigating to `item.path`, with `item.icon` (green accent) and `item.label`.
   - Collapsed: show only the 3 icons with tooltips.
   - Do **not** put Quick actions between standalone items and Advanced; they go at the bottom after Settings.

3. **Sales page**  
   In Sales.jsx, `useSearchParams()`; in `useEffect`, if `searchParams.get('openPOS') === '1'`, call `setPosModalOpen(true)` and optionally remove `openPOS` from the URL.

4. **MobileSidebar**  
   Same Quick actions block after Settings in the mobile sheet.

## Summary

| Item           | Placement        |
|----------------|------------------|
| Quick actions  | After Settings   |
| Order in nav   | … Settings → Quick actions (3 items) → collapse |
