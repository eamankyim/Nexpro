# Color System Documentation

## Overview

The application uses a centralized color system located in `/src/utils/colors.js`. This allows you to change colors across the entire app by updating a single file.

## Usage

### Importing Colors

```javascript
import colors from '@/utils/colors';
// or
import { colors, primaryHSL } from '@/utils/colors';
```

### Using Colors in Components

```javascript
import colors from '@/utils/colors';

// Inline styles
<div style={{ backgroundColor: colors.primary, color: colors.text.primary }}>
  Content
</div>

// CSS variables (recommended for Tailwind)
<div className="bg-[var(--color-primary)] text-[var(--color-text-primary)]">
  Content
</div>
```

### Available Colors

#### Primary Colors
- `colors.primary` - Main brand color (#166534 - deep green)
- `colors.primaryLight` - Light variant (10% opacity)
- `colors.primaryLighter` - Lighter variant (5% opacity)
- `colors.primaryDark` - Dark variant (#0f4a22)

#### Status Colors
- `colors.success` - Success state (#166534)
- `colors.error` - Error state (#ef4444)
- `colors.warning` - Warning state (#f97316)
- `colors.info` - Info state (#166534)

#### Neutral Colors
- `colors.gray` - Gray scale (50-900)
- `colors.text` - Text colors (primary, secondary, muted)
- `colors.border` - Border colors

#### Special Colors
- `colors.focus` - Focus ring color for inputs
- `colors.loader` - Loader/spinner color
- `colors.link` - Link color

## CSS Variables

All colors are also available as CSS variables:

```css
--color-primary
--color-primary-light
--color-primary-dark
--color-success
--color-error
--color-warning
--color-info
--color-loader
--color-focus
--color-focus-ring
--color-link
--color-link-hover
```

## Changing the Primary Color

To change the primary color across the entire app:

1. Open `/src/utils/colors.js`
2. Update the `primary` value:
   ```javascript
   primary: '#YOUR_NEW_COLOR',
   ```
3. Update related variations:
   ```javascript
   primaryLight: 'rgba(R, G, B, 0.1)',
   primaryDark: '#DARKER_SHADE',
   ```
4. Update HSL values if needed (for CSS variables):
   ```javascript
   export const primaryHSL = {
     h: HUE,
     s: SATURATION,
     l: LIGHTNESS,
   };
   ```
5. Update `/src/index.css` CSS variables:
   ```css
   --primary: H S% L%;
   --ring: H S% L%;
   ```

## Ant Design Components

Ant Design components automatically use the green theme through CSS overrides in `/src/index.css`. These include:

- Buttons (primary, link)
- Inputs (focus states)
- Loaders/Spinners
- Progress bars
- Tags
- Checkboxes/Radios
- Tables
- Menus
- Tabs
- And more...

## Best Practices

1. **Use CSS variables** when possible for better performance
2. **Import colors utility** for inline styles or dynamic colors
3. **Use Tailwind classes** with CSS variables: `bg-[var(--color-primary)]`
4. **Keep color variations consistent** - update all related colors when changing primary

## Examples

### Button with Primary Color
```javascript
<button style={{ backgroundColor: colors.primary, color: 'white' }}>
  Click Me
</button>
```

### Input with Focus State
```javascript
<input className="focus:ring-[var(--color-focus)]" />
```

### Tag with Primary Color
```javascript
<Tag color={colors.primary}>Tag</Tag>
```

### Loader
```javascript
<Spin style={{ color: colors.loader }} />
```
