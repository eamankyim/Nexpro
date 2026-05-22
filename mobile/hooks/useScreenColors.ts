import { useMemo } from 'react';

import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

export type ScreenColors = {
  resolvedTheme: 'light' | 'dark';
  colors: typeof Colors.light;
  bg: string;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  inputBg: string;
  headerBg: string;
  danger: string;
  success: string;
};

/**
 * Single source of truth for screen-level colors (light/dark + brand tint).
 */
export function useScreenColors(): ScreenColors {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const colors = Colors[resolvedTheme ?? 'light'];

  return useMemo(
    () => ({
      resolvedTheme: resolvedTheme ?? 'light',
      colors,
      bg: isDark ? colors.background : '#f9fafb',
      cardBg: isDark ? '#27272a' : '#fff',
      borderColor: isDark ? '#3f3f46' : '#e5e7eb',
      textColor: isDark ? '#fff' : '#111',
      mutedColor: isDark ? '#a1a1aa' : '#6b7280',
      inputBg: isDark ? '#18181b' : '#f3f4f6',
      headerBg: isDark ? colors.background : '#fff',
      danger: '#ef4444',
      success: '#10b981',
    }),
    [resolvedTheme, isDark, colors]
  );
}
