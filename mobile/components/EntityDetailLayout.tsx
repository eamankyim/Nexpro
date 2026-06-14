import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

type EntityDetailHeaderProps = {
  title: string;
  headerRight?: () => React.ReactNode;
};

export type DetailMoreAction = {
  key?: string;
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof AppIcon>['name'];
  variant?: 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
};

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

export function EntityDetailHeader({ title, headerRight }: EntityDetailHeaderProps) {
  const router = useRouter();
  const { colors } = useScreenColors();
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackTitle: 'Back',
        headerTintColor: colors.tint,
        headerRight,
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

export function DetailHeroCard({
  eyebrow,
  title,
  message,
  metricLabel,
  metricValue,
  secondaryLabel,
  secondaryValue,
  secondaryIcon = 'archive',
  showCheck = true,
}: {
  eyebrow?: string;
  title: string;
  message?: string;
  metricLabel: string;
  metricValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  secondaryIcon?: React.ComponentProps<typeof AppIcon>['name'];
  showCheck?: boolean;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroDecorOne} />
      <View style={styles.heroDecorTwo} />
      {eyebrow ? (
        <View style={styles.heroPill}>
          <Text style={styles.heroPillText}>{eyebrow}</Text>
        </View>
      ) : null}
      <View style={styles.heroStatusRow}>
        <Text style={styles.heroTitle}>{title}</Text>
        {showCheck ? (
          <View style={styles.heroCheckInline}>
            <AppIcon name="check" size={14} color="#047857" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      {message ? <Text style={styles.heroMessage}>{message}</Text> : null}
      <View style={styles.heroDivider} />
      <View style={styles.heroMetrics}>
        <View style={styles.heroMetricBlock}>
          <Text style={styles.heroMetricLabel}>{metricLabel}</Text>
          <Text style={styles.heroAmount}>{metricValue}</Text>
        </View>
        {secondaryLabel || secondaryValue ? (
          <>
            <View style={styles.heroMetricDivider} />
            <View style={styles.heroSecondaryBlock}>
              <AppIcon name={secondaryIcon} size={18} color="#d1fae5" />
              <View style={styles.heroSecondaryTextBlock}>
                {secondaryLabel ? <Text style={styles.heroSecondaryLabel}>{secondaryLabel}</Text> : null}
                {secondaryValue ? <Text style={styles.heroSecondaryValue}>{secondaryValue}</Text> : null}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function DetailSectionCard({
  title,
  icon,
  children,
  compact,
}: {
  title?: string;
  icon?: React.ComponentProps<typeof AppIcon>['name'];
  children: React.ReactNode;
  compact?: boolean;
}) {
  const { cardBg, borderColor, colors, textColor } = useScreenColors();
  return (
    <View style={[styles.card, compact && styles.compactCard, { backgroundColor: cardBg, borderColor }]}>
      {title ? (
        <View style={styles.cardHeadingRow}>
          {icon ? (
            <View style={styles.iconBadge}>
              <AppIcon name={icon} size={18} color={colors.tint} />
            </View>
          ) : null}
          <Text style={[styles.cardHeading, { color: textColor }]}>{title}</Text>
        </View>
      ) : null}
      <View style={title ? styles.cardBody : undefined}>{children}</View>
    </View>
  );
}

export function DetailInfoRow({
  label,
  value,
  valueColor,
  children,
}: {
  icon?: React.ComponentProps<typeof AppIcon>['name'];
  label: string;
  value?: string | number | null;
  valueColor?: string;
  children?: React.ReactNode;
}) {
  const { mutedColor, textColor } = useScreenColors();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: mutedColor }]}>{label}</Text>
        {children ?? (
          <Text style={[styles.infoText, { color: valueColor ?? textColor }]}>{value ?? '—'}</Text>
        )}
      </View>
    </View>
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

export function DetailMoreActions({
  actions,
  disabled,
  title = 'More actions',
  label = 'More',
}: {
  actions: DetailMoreAction[];
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { colors, cardBg, borderColor, textColor, mutedColor } = useScreenColors();
  const visibleActions = actions.filter(Boolean);

  if (visibleActions.length === 0) return null;

  return (
    <>
      <DetailActionButton
        label={label}
        icon="ellipsis-v"
        onPress={() => setOpen(true)}
        disabled={disabled}
      />
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!disabled) setOpen(false);
        }}
      >
        <Pressable
          style={styles.moreBackdrop}
          onPress={() => {
            if (!disabled) setOpen(false);
          }}
        >
          <Pressable
            style={[styles.moreSheet, { backgroundColor: cardBg, borderColor }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.moreSheetHeader}>
              <Text style={[styles.moreTitle, { color: textColor }]}>{title}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                disabled={disabled}
                hitSlop={10}
                style={[styles.moreCloseButton, disabled && styles.moreDisabled]}
              >
                <AppIcon name="x" size={18} color={mutedColor} />
              </Pressable>
            </View>
            <View style={styles.moreActionList}>
              {visibleActions.map((action, index) => {
                const isDanger = action.variant === 'danger';
                const actionColor = isDanger ? '#dc2626' : textColor;
                const isDisabled = disabled || action.disabled || action.loading;
                return (
                  <Pressable
                    key={action.key ?? action.label}
                    onPress={() => {
                      setOpen(false);
                      action.onPress();
                    }}
                    disabled={isDisabled}
                    style={[
                      styles.moreActionRow,
                      { borderColor },
                      index === visibleActions.length - 1 && styles.moreLastActionRow,
                      isDisabled && !action.loading && styles.moreDisabled,
                    ]}
                  >
                    <View style={styles.moreActionLabelWrap}>
                      {action.icon ? (
                        <AppIcon name={action.icon} size={18} color={isDanger ? '#dc2626' : colors.tint} />
                      ) : null}
                      <Text style={[styles.moreActionLabel, { color: actionColor }]}>{action.label}</Text>
                    </View>
                    {action.loading ? (
                      <ActivityIndicator size="small" color={isDanger ? '#dc2626' : colors.tint} />
                    ) : (
                      <AppIcon name="chevron-right" size={14} color={mutedColor} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#047857',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
    marginBottom: 16,
    minHeight: 208,
  },
  heroDecorOne: {
    position: 'absolute',
    right: 28,
    top: 18,
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 12,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroDecorTwo: {
    position: 'absolute',
    right: -30,
    bottom: -34,
    width: 172,
    height: 172,
    borderRadius: 86,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: { color: '#d1fae5', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  heroTitle: { flexShrink: 1, color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  heroCheckInline: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  heroMessage: { color: '#d1fae5', fontSize: 13, fontWeight: '600', marginTop: 8 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginTop: 18, marginBottom: 14 },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetricBlock: { flex: 1 },
  heroMetricLabel: { color: '#d1fae5', fontSize: 12, fontWeight: '700', marginBottom: 5 },
  heroAmount: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '800' },
  heroMetricDivider: { width: 1, height: 54, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 22 },
  heroSecondaryBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroSecondaryTextBlock: { flex: 1 },
  heroSecondaryLabel: { color: '#a7f3d0', fontSize: 11, fontWeight: '700', marginBottom: 3 },
  heroSecondaryValue: { color: '#d1fae5', fontSize: 14, fontWeight: '800' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  compactCard: { paddingVertical: 14 },
  cardHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
  },
  cardHeading: { fontSize: 14, fontWeight: '800' },
  cardBody: { marginTop: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  infoContent: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  infoText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  row: { marginBottom: 14 },
  label: { fontSize: 12, marginBottom: 4, fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '500' },
  footer: {
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    minWidth: 120,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: { fontSize: 15, fontWeight: '800' },
  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 28,
  },
  moreSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  moreTitle: { fontSize: 17, fontWeight: '800' },
  moreCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreActionList: { gap: 8 },
  moreActionRow: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  moreLastActionRow: { marginBottom: 0 },
  moreActionLabelWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moreActionLabel: { fontSize: 15, fontWeight: '700' },
  moreDisabled: { opacity: 0.6 },
});
