# Mobile App Design Reference Images

Design references for the African Business Suite mobile app (Expo/React Native). Use these for layout, typography, spacing, and UX patterns.

---

## Reference Images

### 1. Revolut Analytics (Light Mode)

**File:** `mobile-design-references/revolut-analytics-light.png`

**Source:** Revolut app (curated by Mobbin)

**Use for:**
- Analytics / Reports screen layout
- Card-based sections with clear hierarchy
- Filter pills ("All personal accounts", "This month") with icons
- Total spend / summary card with large bold amount + label
- Simple bar chart for trends (weekly periods, average line)
- Spend breakdown legend with colored markers
- Budget section: icon + title + subtitle + add button (blue +)
- Scheduled payments: "See all" link, amount + context label
- Clean light mode: white cards, dark text, blue accents
- Close (X) button in header for modal/detail views

**Patterns to adopt:**
- Rounded card sections with generous padding
- Pill-shaped filter buttons
- Large primary number, smaller label below
- Minimal bar chart (no heavy chart libraries)
- Section headers with action links ("See all")
- Blue accent for primary actions

**Dark mode adaptation:** Invert backgrounds (white → dark grey), text (black → white), keep blue accents with adjusted contrast.

---

### 2. Fuse Wallet App (Earlier Reference)

**Note:** Fuse app patterns were discussed as inspiration. Key patterns to apply:

- Modals over blurred background
- Clear empty states with primary CTA
- Prominent feedback pills ("Copied", "Saved")
- Concise explanatory copy for settings
- Generous white space and card-based layouts
- Flat design, no shadows

*(Add specific Fuse reference images here when available.)*

---

## Adding More References

Place additional reference images in `docs/mobile-design-references/` and add entries above with:
- Filename
- Source
- What to use it for
- Patterns to adopt
