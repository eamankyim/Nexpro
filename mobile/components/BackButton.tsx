import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

interface BackButtonProps {
  onPress?: () => void;
  visible?: boolean;
  hitSlop?: number;
  size?: number;
  iconSize?: number;
}

/**
 * Reusable back button — respects saved theme preference.
 */
export function BackButton({
  onPress,
  visible = true,
  hitSlop = 8,
  size = 40,
  iconSize = 18,
}: BackButtonProps) {
  const router = useRouter();
  const { colors, borderColor } = useScreenColors();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.backButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor,
        },
        pressed && styles.iconButtonPressed,
      ]}
      hitSlop={hitSlop}
    >
      <AppIcon name="chevron-left" size={iconSize} color={colors.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
});
