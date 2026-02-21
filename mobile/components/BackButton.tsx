import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface BackButtonProps {
  /**
   * Custom onPress handler. If not provided, defaults to router.back()
   */
  onPress?: () => void;
  /**
   * Whether to show the button. Defaults to true
   */
  visible?: boolean;
  /**
   * Custom hit slop area. Defaults to 8
   */
  hitSlop?: number;
  /**
   * Size of the button container. Defaults to 40
   */
  size?: number;
  /**
   * Size of the icon. Defaults to 18
   */
  iconSize?: number;
}

/**
 * Reusable back button component with consistent design.
 * Shows a back arrow icon with a circular border.
 * 
 * @example
 * <BackButton />
 * <BackButton onPress={() => router.push('/home')} />
 */
export function BackButton({
  onPress,
  visible = true,
  hitSlop = 8,
  size = 40,
  iconSize = 18,
}: BackButtonProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const borderColor = colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb';

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
          borderColor: borderColor,
        },
        pressed && styles.iconButtonPressed,
      ]}
      hitSlop={hitSlop}
    >
      <FontAwesome name="chevron-left" size={iconSize} color={colors.tint} />
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
