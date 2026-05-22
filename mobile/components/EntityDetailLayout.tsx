import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

/** @deprecated Prefer useScreenColors — kept for backward compatibility */
export function useEntityDetailTheme() {
  const screen = useScreenColors();
  return {
    colors: screen.colors,
    bg: screen.bg,
    cardBg: screen.cardBg,
    borderColor: screen.borderColor,
    textColor: screen.textColor,
    mutedColor: screen.mutedColor,
  };
}

export function EntityDetailHeader({ title }: { title: string }) {
  const router = useRouter();
  const { colors } = useScreenColors();
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: colors.tint,
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <AppIcon name="chevron-left" size={18} color={colors.tint} />
          </Pressable>
        ),
      }}
    />
  );
}

export function DetailLoading({ title }: { title: string }) {
  const { bg, colors, mutedColor } = useScreenColors();
  return (
    <>
      <EntityDetailHeader title={title} />
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={[styles.loadingText, { color: mutedColor }]}>Loading...</Text>
      </View>
    </>
  );
}

export function DetailNotFound({ title, entityLabel }: { title: string; entityLabel: string }) {
  const router = useRouter();
  const { bg, colors, mutedColor } = useScreenColors();
  return (
    <>
      <EntityDetailHeader title={title} />
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={{ color: mutedColor }}>{entityLabel} not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.tint, fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </View>
    </>
  );
}

export function DetailRow({
  label,
  value,
  valueColor,
  children,
}: {
  label: string;
  value?: string | number | null;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  const { mutedColor, textColor } = useScreenColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      {children ?? (
        <Text style={[styles.value, { color: valueColor ?? textColor }]}>{value ?? '—'}</Text>
      )}
    </View>
  );
}

export function DetailCard({ children }: { children: React.ReactNode }) {
  const { cardBg, borderColor } = useScreenColors();
  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>{children}</View>
  );
}

export function DetailFooter({ children }: { children: React.ReactNode }) {
  const { cardBg, borderColor } = useScreenColors();
  return (
    <View style={[styles.footer, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
      {children}
    </View>
  );
}

export function DetailActionButton({
  label,
  onPress,
  icon,
  variant = 'outline',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof AppIcon>['name'];
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, borderColor, textColor } = useScreenColors();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.actionBtn,
        isPrimary && { backgroundColor: colors.tint, borderColor: colors.tint },
        isDanger && { borderColor: '#ef4444' },
        !isPrimary && !isDanger && { borderColor },
        (disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : colors.tint} size="small" />
      ) : (
        <>
          {icon ? (
            <AppIcon
              name={icon}
              size={18}
              color={isPrimary ? '#fff' : isDanger ? '#ef4444' : colors.tint}
            />
          ) : null}
          <Text
            style={[
              styles.actionText,
              { color: isPrimary ? '#fff' : isDanger ? '#ef4444' : textColor },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  row: { marginBottom: 14 },
  label: { fontSize: 12, marginBottom: 4, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '500' },
  footer: {
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
