---
name: POS product list and cart
overview: Remove Quick Add from POS; left side = product list (search + browse), click or scan adds to cart. Keep simple UX and fast performance.
todos:
  - id: remove-quick-add-pos
    content: Remove Quick Add block and related state/handlers from POS.jsx
  - id: expand-product-list
    content: POSProductSearch - larger browse cap, flexible height for list; optional fillHeight prop
  - id: cleanup-quick-add
    content: Remove POSQuickAddGrid from POS; delete file or leave unused; update pos/index.js
---

# POS: Product list (click to add) + cart; remove Quick Add

## Current behavior

- **Left column (POS):** POSProductSearch (search + browse list, click product → add to cart; scan → add to cart) **plus** POSQuickAddGrid (8 configurable “Add Item” slots).
- **Right column:** POSCart.
- **Scan:** In POSProductSearch, scanning already adds to cart via `onSelectProduct`.

## Desired behavior

1. **No Quick Add grid** – Remove the 8-slot “Quick Add” area.
2. **Left side = product list only** – Search + product list; **click product → add to cart**.
3. **Scan → cart** – Unchanged.
4. **Reuse** – Same product list + cart for POS and (when built) other sales flows.

## Simplicity & performance

**User simplicity**

- **One mental model:** Left = “Products I can add,” Right = “Cart.” Click or scan = add to cart.
- **Instant feedback:** On click/scan, add to cart and show brief feedback (e.g. cart count bump or “Added” on the row). No extra modals or steps.
- **Copy:** Short hint like “Search or scan to add to cart.” One search box, one list, one cart. No tabs or modes.
- **Empty state:** “No products to show. Add products in Products, or refresh when online.”

**Fast performance**

- **Cap the browse list** at ~50–80 items when search is empty so first load stays fast and scroll stays smooth.
- **Add “Load more”** only when you have enough products that the cap feels limiting (e.g. +50 per click); avoid infinite scroll or complex pagination at first.
- **Skip virtualization** unless you see real slowness with 100+ items.
- **Keep** existing debounced search and React Query; no “show all products” on open.

**Summary**

| Goal       | Choice                                                |
|-----------|--------------------------------------------------------|
| Simple    | One list, click or scan → cart; no Quick Add.          |
| Fast      | Browse cap ~50–80; “Load more” only if needed.         |
| Easy to use | Clear add-to-cart feedback; minimal copy and layout. |

## Implementation

### 1. Remove Quick Add from POS layout

**File:** `Frontend/src/pages/POS.jsx`

- Remove the Quick Add block (the div wrapping `POSQuickAddGrid` and all its props).
- Left column = only `POSProductSearch`; give it full height (e.g. `flex-1 min-h-0`).
- Remove state/handlers only used by Quick Add: `quickItems`, `handleAddQuickItem`, `handleRemoveQuickItem`, `handleFetchProductsForQuickAdd`; remove quick-item loading from `loadData` and unused `usePOSOffline` destructuring.
- Keep cart and all cart-related state/callbacks unchanged.

### 2. Expand product list UX

**File:** `Frontend/src/components/pos/POSProductSearch.jsx`

- Set **browse cap** to ~50–80 (e.g. `BROWSE_LIST_SIZE = 60`). Add optional “Load more” (e.g. +50) if product count exceeds cap.
- Give results/browse area **flexible height** when used in POS (e.g. `fillHeight` prop so ScrollArea uses `flex-1 min-h-0` and fills the left column).
- Keep: search input, scan button, click-to-add, scan → add to cart, existing empty/loading/error states.

### 3. Cleanup

- Remove or delete `POSQuickAddGrid.jsx`; remove export from `Frontend/src/components/pos/index.js` if deleted.
- POSScanMode unchanged.

## Files to touch

- `Frontend/src/pages/POS.jsx` – Remove Quick Add block and related state/handlers; left column = product list only.
- `Frontend/src/components/pos/POSProductSearch.jsx` – Browse cap ~50–80; optional “Load more”; flexible height when in POS.
- `Frontend/src/components/pos/POSQuickAddGrid.jsx` – Remove from POS; delete or leave unused.
- `Frontend/src/components/pos/index.js` – Remove POSQuickAddGrid export if component deleted.
