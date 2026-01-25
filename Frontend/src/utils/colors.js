/**
 * Centralized color system for the application
 * Update colors here to change them across the entire app
 */

export const colors = {
  // Primary brand color (deep green)
  primary: '#166534',
  
  // Primary color variations
  primaryLight: 'rgba(22, 101, 52, 0.1)',
  primaryLighter: 'rgba(22, 101, 52, 0.05)',
  primaryDark: '#0f4a22',
  
  // Status colors
  success: '#166534',
  successLight: 'rgba(22, 101, 52, 0.1)',
  error: '#ef4444',
  errorLight: 'rgba(239, 68, 68, 0.1)',
  warning: '#f97316',
  warningLight: 'rgba(249, 115, 22, 0.1)',
  info: '#166534', // Changed from blue to green
  infoLight: 'rgba(22, 101, 52, 0.1)',
  
  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Background colors
  background: '#ffffff',
  surface: 'rgba(255, 255, 255, 0.95)',
  
  // Text colors
  text: {
    primary: '#1a1a1a',
    secondary: '#666666',
    muted: '#9ca3af',
  },
  
  // Border colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  
  // Card colors
  cardBackground: '#ffffff',
  
  // Focus/ring color (for inputs, buttons, etc.)
  focus: '#166534',
  focusRing: 'rgba(22, 101, 52, 0.2)',
  
  // Loader/Spinner color
  loader: '#166534',
  
  // Link color
  link: '#166534',
  linkHover: '#0f4a22',
};

/**
 * Get HSL values for CSS variables
 */
export const getHSL = (hex) => {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  // Convert RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
      case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
      case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

/**
 * Primary color HSL for CSS variables
 * This matches #166534
 */
export const primaryHSL = {
  h: 143,
  s: 64,
  l: 24,
};

export default colors;
