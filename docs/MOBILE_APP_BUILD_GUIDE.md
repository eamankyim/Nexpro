# Mobile App Build Guide — Zero-Error Setup

Step-by-step guide to build the Expo mobile app with all dependencies, imports, and configuration correct from the start.

---

## Prerequisites

- **Node.js** 18+ (match `Frontend/.nvmrc` if present)
- **npm** or **yarn**
- **Expo Go** app on your phone (iOS App Store / Google Play)
- **Backend** running (default: `http://localhost:5001` or `5000`)

---

## Step 1: Create the Expo App

From the project root:

```bash
cd /Users/us/Desktop/Development/Nexpro
npx create-expo-app@latest mobile --template tabs
```

If the template flag isn't available, run `npx create-expo-app@latest mobile` and choose **tabs** when prompted. The tabs template includes Expo Router + TypeScript.

This creates `mobile/` with:
- `app/_layout.tsx` — root layout
- `app/(tabs)/_layout.tsx` — tab layout
- `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx` — default tabs

---

## Step 2: Install All Dependencies

```bash
cd mobile
```

### Core (Auth, API, Storage)

```bash
npx expo install expo-secure-store
npx expo install expo-constants
npx expo install axios
```

### Navigation (usually included; verify)

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-status-bar
```

### UI & UX

```bash
npx expo install expo-blur
npx expo install expo-image
npx expo install @expo/vector-icons
```

### Forms & Data

```bash
npm install @tanstack/react-query
```

### Optional (add when needed)

```bash
# QR/Camera — may require dev build
npx expo install expo-camera

# Bottom sheets
npm install @gorhom/bottom-sheet react-native-reanimated

# FlashList for performant lists
npm install @shopify/flash-list

# Offline detection
npx expo install @react-native-community/netinfo
```

---

## Step 3: Configure Environment & API URL

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:5001
```

**For physical device on same WiFi:** Use your machine's LAN IP:

```bash
cd mobile && npm run show-api-url
```

Copy the output to `mobile/.env`. Or get your IP: `ipconfig getifaddr en0` (Mac).

**Important:** Expo only exposes env vars prefixed with `EXPO_PUBLIC_`. Access via `process.env.EXPO_PUBLIC_API_URL`.

---

## Step 4: Path Aliases (Clean Imports)

Create or update `mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

Then in `babel.config.js` (or create it):

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './',
          },
        },
      ],
    ],
  };
};
```

Install the plugin:

```bash
npm install babel-plugin-module-resolver --save-dev
```

Now you can use: `import { api } from '@/services/api'`

---

## Step 5: App Config (app.json / app.config.js)

Ensure `mobile/app.json` has:

```json
{
  "expo": {
    "name": "ShopWISE",
    "slug": "shopwise",
    "scheme": "shopwise",
    "extra": {
      "apiUrl": "http://localhost:5001"
    }
  }
}
```

For dynamic env, use `app.config.js`:

```javascript
export default {
  expo: {
    name: 'ShopWISE',
    slug: 'shopwise',
    scheme: 'shopwise',
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001',
    },
  },
};
```

---

## Step 6: Backend CORS for Mobile

Add your dev machine's LAN IP and Expo URLs to `Backend/.env`:

```
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,http://192.168.1.100:3000,exp://192.168.1.100:8081
```

Expo Go uses `exp://` scheme. Adjust IP and port as needed.

---

## Step 7: Verify Imports & Run

### Check Root Layout

`app/_layout.tsx` should wrap with providers. Minimal working version:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

### Check Tab Layout

`app/(tabs)/_layout.tsx` — ensure all tab files exist. Rename `explore.tsx` to match your tabs (e.g. `sales.tsx`, `customers.tsx`).

### Run

```bash
npx expo start
```

Scan QR with Expo Go. If you get "Unable to resolve module" or "Network request failed":

1. **Module errors:** Run `npx expo start --clear` to clear cache
2. **Network errors:** Ensure `EXPO_PUBLIC_API_URL` uses LAN IP when on device; Backend CORS includes your origin

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `Unable to resolve module` | Run `npx expo start --clear`; check path aliases in `tsconfig` + `babel-plugin-module-resolver` |
| `Network request failed` | Use LAN IP for API URL; add CORS origin in Backend |
| `expo-camera` not working in Expo Go | Use Development Build: `eas build --profile development` |
| `Invariant Violation: Native module cannot be null` | Some native modules need dev build; stick to Expo Go–compatible packages |
| `Metro bundler` port conflict | Run `npx expo start --port 8082` |
| TypeScript errors on `process.env` | Add `expo-env.d.ts` with `declare namespace NodeJS { interface ProcessEnv { EXPO_PUBLIC_API_URL?: string } }` |

---

## Dependency Checklist

Before first run, ensure these are installed:

- [ ] `expo` (from create-expo-app)
- [ ] `expo-router`
- [ ] `expo-secure-store`
- [ ] `expo-constants`
- [ ] `axios`
- [ ] `react-native-safe-area-context`
- [ ] `react-native-screens`
- [ ] `expo-linking`
- [ ] `expo-status-bar`
- [ ] `@expo/vector-icons`
- [ ] `babel-plugin-module-resolver` (dev)

---

## Quick Start (Copy-Paste)

```bash
cd /Users/us/Desktop/Development/Nexpro
npx create-expo-app@latest mobile --template tabs
cd mobile
npx expo install expo-secure-store expo-constants expo-blur expo-image expo-router react-native-safe-area-context react-native-screens expo-linking expo-status-bar
npm install axios @tanstack/react-query
npm install babel-plugin-module-resolver --save-dev
echo "EXPO_PUBLIC_API_URL=http://localhost:5001" > .env
npx expo start
```
