import type { StyleProp, ViewStyle } from 'react-native';

/** FlatList must fill the screen so ListEmptyComponent is visible. */
export const flatListStyleForEmpty = { flex: 1 } as const;

/**
 * Expands scroll content when the list has no rows so ListEmptyComponent centers vertically.
 */
export function listContentStyleWhenEmpty(
  baseStyle: StyleProp<ViewStyle>,
  isEmpty: boolean
): StyleProp<ViewStyle> {
  if (!isEmpty) return baseStyle;
  return [baseStyle, { flexGrow: 1, justifyContent: 'center' }];
}

/** Hide status/chip filter bars while loading, on error, or on the initial empty state (no data, no filters). */
export function showListFilters(
  isLoading: boolean,
  isError: boolean,
  itemCount: number,
  hasActiveFilter = false
): boolean {
  if (isLoading || isError) return false;
  if (itemCount > 0) return true;
  return hasActiveFilter;
}
