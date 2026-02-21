# Plan: AI chat access via floating button

## Current state

- **Backend:** `POST /api/assistant/chat` is implemented. Tenant context and AI replies work.
- **Frontend:** [AssistantChatPanel.jsx](Frontend/src/components/AssistantChatPanel.jsx) exists (slide-over Sheet, "AI Assistant", suggested prompts, chat).
- **Gap:** The panel is never rendered or opened. No route, no header button, no floating button.

## Approach: Floating button (primary entry point)

Use a **global floating action button** in the tenant app that opens the AI assistant panel. No header control and no new route.

**Why a FAB:**
- Visible from every page without taking header space.
- Familiar pattern for “help” / “chat” (e.g. support widgets).
- Existing [FloatingActionButton](Frontend/src/components/FloatingActionButton.jsx) can be reused with a different icon and `onClick` that opens the panel.

**Conflict with page FABs:** Leads, Jobs, and Customers already use a FAB (bottom-right) for “New Lead” / “New Job” / “New Customer”. To avoid two FABs in the same corner:
- Put the **AI FAB at bottom-left** and keep page FABs at **bottom-right**, or
- Use a **single global FAB** that expands (e.g. “Add” + “AI”) only when the current page doesn’t provide its own FAB — more complex and mixes concerns.

**Recommendation:** One dedicated AI FAB at **bottom-left**, so it doesn’t overlap the existing right-side FABs.

## Implementation

1. **MainLayout**
   - File: [Frontend/src/layouts/MainLayout.jsx](Frontend/src/layouts/MainLayout.jsx)
   - Add state: `const [assistantOpen, setAssistantOpen] = useState(false)`.
   - Render:
     - `<AssistantChatPanel open={assistantOpen} onOpenChange={setAssistantOpen} />`
     - A floating button that calls `setAssistantOpen(true)`:
       - **Option A (reuse):** `<FloatingActionButton icon={MessageCircle} label="AI Assistant" tooltip="AI Assistant" onClick={() => setAssistantOpen(true)} position="bottom-left" showOnAllSizes />`  
         Note: `FloatingActionButton` currently uses `position: 'bottom-right' | 'bottom-left'` and supports `showOnAllSizes`. Ensure `showOnAllSizes={true}` so the AI FAB shows on desktop too.
       - **Option B (minimal):** A small custom fixed button (e.g. `position: fixed; bottom: 1rem; left: 1rem; z-index: 50`) with MessageCircle/Bot icon, same green style, that only opens the panel. No scroll-hide logic unless you add it.
   - No props to Header for the assistant (no header button).

2. **FloatingActionButton (if reused)**
   - File: [Frontend/src/components/FloatingActionButton.jsx](Frontend/src/components/FloatingActionButton.jsx)
   - Ensure `position="bottom-left"` is supported (it is: `positionClasses['bottom-left']` exists).
   - Use `showOnAllSizes={true}` so the AI FAB is visible on all breakpoints (unlike page FABs that are often mobile-only).

3. **Hide AI FAB when panel is open (optional)**
   - When `assistantOpen === true`, don’t render the AI FAB (or keep it; closing the sheet is enough). Hiding it avoids a redundant button while the sheet is open.

4. **Optional: hide AI FAB when a page FAB is present**
   - If you want only one FAB visible at a time, you could pass a “hasPageFAB” flag from the route/page up to MainLayout and conditionally render the AI FAB when `!hasPageFAB`. This adds complexity; recommended to keep both (AI left, page right).

## Files to touch

| File | Change |
|------|--------|
| [Frontend/src/layouts/MainLayout.jsx](Frontend/src/layouts/MainLayout.jsx) | Import `AssistantChatPanel` and `FloatingActionButton` (or a small custom FAB); add `assistantOpen` state; render panel and FAB (bottom-left, MessageCircle/Bot, `onClick` opens panel). Optionally hide FAB when `assistantOpen` is true. |
| [Frontend/src/components/FloatingActionButton.jsx](Frontend/src/components/FloatingActionButton.jsx) | Only if needed: ensure `bottom-left` and `showOnAllSizes` work when used from MainLayout (no change if already correct). |

## Result

- **How to access:** A floating button at the bottom-left of the tenant app (all pages under MainLayout). Click it to open the AI Assistant slide-over panel. No header button and no new route.
