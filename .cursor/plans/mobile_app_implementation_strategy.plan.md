# Mobile App Implementation Strategy

## Approach: Expo + React Native (Expo Go for Development)

- **Mobile**: Dedicated Expo/React Native app — native feel, Expo Go for dev, EAS Build for production
- **Web**: Existing Frontend (Vite + React) remains for desktop
- **Shared**: API client, auth logic, types via `packages/shared` or duplicated initially

---

## Current State

- **Web stack**: React + Vite + Tailwind, PWA manifest, shadcn/ui
- **Backend**: Node/Express, shared API for web and mobile
- **Gap**: No native mobile app; mobile users use responsive web

---

## Design Reference Images

See **`docs/mobile-design-references.md`** for visual references. Key sources:

- **Revolut Analytics** (`revolut-analytics-light.png`): Card-based analytics layout, filter pills, bar chart, budget/scheduled payments sections, light mode
- **Fuse Wallet**: Modals over blur, empty states, feedback pills, concise copy (patterns documented; add images when available)

---

## Phase 0: Expo Setup & Project Structure

**Goal**: Create Expo app, configure Expo Go, establish shared API layer.

### 0.1 Create Expo App
- Run `npx create-expo-app@latest mobile --template tabs` (or blank, then add tabs)
- Place in `Nexpro/mobile/` alongside `Frontend/`, `Backend/`
- Use **Expo Router** (file-based routing) for navigation
- Use **Expo SDK 52+** (latest stable)

### 0.2 Expo Go Development Workflow
- Install **Expo Go** on physical device (iOS/Android)
- Run `npx expo start` in `mobile/` → scan QR code to open in Expo Go
- Use tunnel mode if not on same LAN: `npx expo start --tunnel`
- Hot reload works in Expo Go; no native build needed for most development

### 0.3 Project Structure
```
Nexpro/
├── Backend/
├── Frontend/          # Web (desktop)
├── mobile/            # Expo app (new)
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── (tabs)/    # Tab navigator
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── sales.tsx
│   │   │   ├── customers.tsx
│   │   │   └── more.tsx
│   │   ├── login.tsx
│   │   └── ...
│   ├── components/
│   ├── hooks/
│   ├── services/     # API client, auth — shared logic
│   └── app.json
├── packages/         # Optional: shared code
│   └── api/         # API client, types
└── ...
```

### 0.4 API & Auth
- **API base URL**: Use `expo-constants` + `Constants.expoConfig?.extra?.apiUrl` or env (e.g. `EXPO_PUBLIC_API_URL`)
- **Axios/fetch**: Same endpoints as web; reuse API structure from `Frontend/src/services/`
- **Auth**: Store token in `expo-secure-store` (not AsyncStorage for production); same JWT flow as web
- **Tenant/User**: Same auth endpoints; `activeTenant`, `businessType` from API

### 0.5 Dependencies to Add
- `expo-router` — file-based routing
- `expo-secure-store` — secure token storage
- `expo-camera` or `expo-barcode-scanner` — QR for POS (shops/pharmacies)
- `@react-navigation/native`, `@react-navigation/bottom-tabs` — if not using Expo Router tabs
- `react-native-safe-area-context`, `react-native-screens` — standard with Expo

**Files**: New `mobile/` directory, `app.json`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, API service layer

**Build guide:** See `docs/MOBILE_APP_BUILD_GUIDE.md` for step-by-step setup (dependencies, imports, env, CORS, common errors).

---

## Phase 1: Mobile Layout & Navigation (Expo)

**Goal**: 5-tab bottom nav with contextual center action, matching mobile-app-design rule.

### 1.1 Tab Navigator (Expo Router)
- Use `(tabs)` group with `Tabs` layout
- **Tabs 1–2**: Dashboard, Sales (or Jobs for studios)
- **Tab 3 (center)**: Contextual action — Camera (shops/pharmacies) or Plus (studios)
- **Tabs 4–5**: Customers, More (overflow: Settings, Profile, etc.)
- Center tab: custom `tabBarButton` that renders elevated FAB-style button
- Use `useAuth()` / `activeTenant?.businessType` for center action

### 1.2 Stack Layout for Screens
- Each tab can have stack navigator for detail screens (e.g. Customer detail, Sale detail)
- Use `router.push()`, `router.back()` for navigation

### 1.3 Header
- Minimal header: back (when applicable), title, notification bell → `/notifications`, avatar → `/profile`
- Use `expo-router`'s `Stack.Screen` options or custom header component
- 44px min touch targets

**Files**: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/sales.tsx`, etc., custom tab bar component

---

## Phase 2: Dark Mode (Expo)

**Goal**: Full dark mode support with user preference and system fallback.

### 2.1 Theme Infrastructure
- **Theme context**: Create `ThemeContext` with `theme: 'light' | 'dark' | 'system'`
- **Persistence**: Store in `AsyncStorage` or `expo-secure-store` for returning users
- **System preference**: Use `useColorScheme()` from React Native or `expo-system-ui` for `system` option
- **Apply**: Use `colorScheme` in `_layout.tsx` to set `StatusBar` and pass to theme provider

### 2.2 Dark Mode Palette
- Define theme object: `{ light: { background, foreground, primary, ... }, dark: { ... } }`
- Primary: #166534 (brand green); dark backgrounds: #0f0f0f, #1a1a1a; borders: #333
- Use `useColorScheme()` or custom hook to resolve `system` → actual `light` or `dark`

### 2.3 Component Support
- Pass `theme` or `colorScheme` via context; use in StyleSheet or NativeWind/Tailwind
- **NativeWind** (Tailwind for RN): Use `dark:` variants if adopting NativeWind
- **Plain StyleSheet**: Conditional styles based on `colorScheme`
- Bottom nav, header, modals, cards — all respect dark mode

### 2.4 Theme Toggle
- Add toggle in More → Settings and optionally in header
- Options: Light | Dark | System
- `StatusBar` style: `light-content` for dark, `dark-content` for light

**Files**: `ThemeContext.tsx`, `theme.ts` (palette), `app/(tabs)/more.tsx` or `app/settings.tsx`, `_layout.tsx`

---

## Phase 3: Performance & Smoothness (Expo)

**Goal**: Fast loads, smooth interactions, 60fps.

### 3.1 Expo Go vs Development Build
- **Expo Go**: Use for most development; limited to Expo SDK modules (no custom native code)
- **Development Build**: Required if you need `expo-camera` (QR) or other modules not in Expo Go — use `eas build --profile development`
- **Production**: Use `eas build` for App Store / Play Store; not Expo Go

### 3.2 Rendering Performance
- **FlatList / FlashList**: Use `FlashList` (@shopify/flash-list) for long lists (Customers, Products, Inventory) — much faster than FlatList
- **Skeleton loaders**: Use `expo-linear-gradient` or simple View placeholders for loading states
- **Debounce**: Search inputs — 500ms debounce before API calls
- **Memoization**: `React.memo`, `useMemo`, `useCallback` for list items and callbacks

### 3.3 Animations & Transitions
- **Reanimated**: Use `react-native-reanimated` (included in Expo) for smooth animations
- **Layout animations**: `Layout.springify()` for list reordering, modal open/close
- **Touch feedback**: `Pressable` with `style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}` or scale
- **Blur**: `expo-blur` for modal backdrops (BlurView)

### 3.4 Images & Assets
- Use `expo-image` for optimized image loading (caching, placeholders)
- App icons: Configure in `app.json`; Expo generates all sizes

---

## Phase 4: Mobile-Specific UX (Expo)

**Goal**: Align with mobile-app-design rule and Fuse patterns.

### 4.1 Reports on Mobile
- **AI chat only**: No chart-heavy report pages; single "Ask about your business" chat UI (Smart Report)
- Route: `app/reports.tsx` or `app/(tabs)/reports.tsx` — chat interface only

### 4.2 Modals & Overlays
- **BlurView**: Use `expo-blur` BlurView for modal backdrops (Fuse-style)
- **Bottom sheets**: Use `@gorhom/bottom-sheet` for forms — prefer over full-screen modals
- **Modal**: React Native `Modal` or `@react-navigation/modal` with blur background

### 4.3 Empty States & Feedback
- Empty states: short copy + primary CTA (e.g. "No customers yet" → "Add Customer")
- Feedback: Toast via `expo-toast` or custom pill ("Copied", "Saved") — brief, auto-dismiss
- Settings: concise helper text per setting

### 4.4 Touch Targets
- All `Pressable` / `TouchableOpacity` ≥ 44px min height/width
- Use `hitSlop` for small icons if needed

### 4.5 QR / Camera (Shops & Pharmacies)
- Use `expo-camera` with barcode scanning for POS
- **Note**: `expo-camera` may require Development Build (not Expo Go) — check Expo SDK compatibility
- Alternative: `expo-barcode-scanner` (deprecated) or `react-native-vision-camera` with dev build

---

## Phase 5: Offline & Resilience (Expo)

**Goal**: Graceful degradation when network is slow or offline.

### 5.1 Caching
- **AsyncStorage / MMKV**: Cache key data (products, customers) for offline read
- **TanStack Query**: Use `staleTime`, `cacheTime` for API responses; persist cache with `@tanstack/query-async-storage-persister` if needed
- **POS offline**: Extend patterns from web `usePOSOffline` — queue sales, sync when online

### 5.2 Error Handling
- Network errors: `NetInfo` to detect offline; show clear message + retry
- Optimistic updates: Cart, quick actions — update UI immediately, sync in background

---

## Implementation Order (Recommended)

| Step | Task | Effort | Impact |
|------|------|--------|--------|
| 1 | **Create Expo app** (`npx create-expo-app mobile --template tabs`) | Low | High |
| 2 | **API + Auth layer** (services, SecureStore, token) | Medium | High |
| 3 | **Tab layout** with 5 tabs + contextual center action | Medium | High |
| 4 | **Login / Auth flow** (login screen, protected routes) | Medium | High |
| 5 | **Core screens**: Dashboard, Sales, Customers (basic) | Medium | High |
| 6 | **ThemeContext + dark mode** | Medium | High |
| 7 | **Theme toggle** in Settings / More | Low | Medium |
| 8 | **Reports**: AI chat only | Low | Medium |
| 9 | **BlurView** for modals, bottom sheets | Low | Medium |
| 10 | **FlashList** for long lists | Low | High |
| 11 | **QR/Camera** for POS (may need dev build) | Medium | High |
| 12 | **Offline** caching + NetInfo | Medium | Medium |

---

## Key Files to Create (Expo / mobile/)

- **Create**: `mobile/` (entire app), `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/sales.tsx`, `app/(tabs)/customers.tsx`, `app/(tabs)/more.tsx`, `app/login.tsx`, `services/api.ts`, `services/auth.ts`, `context/AuthContext.tsx`, `context/ThemeContext.tsx`, `components/BottomTabBar.tsx`, `components/Header.tsx`
- **Web (unchanged for now)**: Frontend remains for desktop; optional: add link to "Get the app" pointing to store or Expo Go for testing

---

## Expo Go Workflow

1. `cd mobile && npx expo start`
2. Scan QR with Expo Go (iOS) or Camera (Android)
3. App loads on device; hot reload on save
4. Use `--tunnel` if not on same network
5. For production: `eas build` (not Expo Go)

---

## Success Metrics

- **Expo Go**: App runs in Expo Go, hot reload works
- **Auth**: Login, token storage, protected routes
- **Navigation**: 5-tab bottom nav, center action by business type
- **Touch targets** 100% ≥ 44px
- **Dark mode**: Full coverage, smooth toggle
- **Performance**: FlashList for lists, no jank on scroll
