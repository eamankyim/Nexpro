import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { settingsService } from '@/services/settings';
import { authService } from '@/services/auth';
import { getErrorMessage } from '@/utils/errorMessages';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { StackPageHeader } from '@/components/StackPageHeader';
import {
  getStoredPushRegistrationState,
  registerPushNotifications,
  type PushRegistrationState,
} from '@/utils/pushNotifications';
import {
  NOTIFICATION_PREFERENCE_CATEGORY_LABELS,
  NOTIFICATION_PREFERENCE_CATEGORY_ORDER,
  normalizeNotificationPreferences,
  type NotificationPrefsDraft,
} from '@/constants/notificationPreferences';

type NotificationCategoryPrefs = { in_app?: boolean; email?: boolean };

type SettingsLink = {
  id: string;
  label: string;
  subtitle?: string;
  icon: AppIconName;
  route?: string;
  onPress?: () => void;
};

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, memberships, activeTenantId, setActiveTenantId, refreshAuth } = useAuth();
  const { theme, setTheme } = useTheme();
  const { colors, bg, cardBg, borderColor, textColor, mutedColor, resolvedTheme } = useScreenColors();
  const [notificationPrefsDraft, setNotificationPrefsDraft] = useState<NotificationPrefsDraft | null>(null);
  const [pushState, setPushState] = useState<PushRegistrationState | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const { data: profileRes, isLoading: loadingProfile } = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: () => settingsService.getProfile(),
  });

  const profileData = profileRes?.data ?? profileRes;

  useEffect(() => {
    setNotificationPrefsDraft(normalizeNotificationPreferences(profileData?.notificationPreferences));
  }, [profileData]);

  useEffect(() => {
    let mounted = true;
    getStoredPushRegistrationState().then((state) => {
      if (mounted) setPushState(state);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const notificationCategories = notificationPrefsDraft?.categories;
  const hasNotificationPrefs = Boolean(
    notificationCategories && Object.keys(notificationCategories).length > 0
  );

  const updateNotificationPrefsMutation = useMutation({
    mutationFn: (categories: Record<string, NotificationCategoryPrefs>) =>
      authService.updateNotificationPreferences(categories),
    onSuccess: (body) => {
      if (body?.data?.categories) {
        setNotificationPrefsDraft({
          categories: JSON.parse(JSON.stringify(body.data.categories)),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      refreshAuth();
      Alert.alert('Saved', 'Notification preferences updated.');
    },
    onError: (error) => {
      Alert.alert('Error', getErrorMessage(error, 'Failed to save notification preferences.'));
    },
  });

  const setNotifChannel = useCallback(
    (categoryKey: string, channel: 'in_app' | 'email', value: boolean) => {
      setNotificationPrefsDraft((prev) => {
        if (!prev?.categories?.[categoryKey]) return prev;
        return {
          categories: {
            ...prev.categories,
            [categoryKey]: {
              ...prev.categories[categoryKey],
              [channel]: value,
            },
          },
        };
      });
    },
    []
  );

  const handleResetNotificationPrefs = useCallback(() => {
    setNotificationPrefsDraft(normalizeNotificationPreferences(profileData?.notificationPreferences));
  }, [profileData]);

  const handleSaveNotificationPrefs = useCallback(() => {
    if (notificationPrefsDraft?.categories) {
      updateNotificationPrefsMutation.mutate(notificationPrefsDraft.categories);
    }
  }, [notificationPrefsDraft, updateNotificationPrefsMutation]);

  const handleEnablePush = useCallback(async () => {
    setPushLoading(true);
    try {
      const state = await registerPushNotifications({ prompt: true });
      setPushState(state);
      if (state.status === 'registered') {
        Alert.alert('Push enabled', state.message);
      } else if (state.status === 'denied') {
        Alert.alert('Push not enabled', state.message);
      }
    } finally {
      setPushLoading(false);
    }
  }, []);

  const handleSelectTenant = useCallback(
    async (tenantId: string) => {
      if (tenantId !== activeTenantId) {
        await setActiveTenantId(tenantId);
      }
    },
    [activeTenantId, setActiveTenantId]
  );

  const handleResendVerification = useCallback(async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification();
      Alert.alert('Done', 'Verification email sent. Check your inbox.');
      await refreshAuth();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Failed to send verification email.'));
    } finally {
      setResendLoading(false);
    }
  }, [refreshAuth]);

  const accountLinks = useMemo<SettingsLink[]>(
    () => [
      {
        id: 'profile',
        label: 'Profile',
        subtitle: 'Name, photo, and password',
        icon: 'user',
        route: '/profile',
      },
      {
        id: 'notifications-inbox',
        label: 'Notification inbox',
        subtitle: 'View recent alerts',
        icon: 'bell',
        route: '/notifications',
      },
      {
        id: 'reset-password',
        label: 'Reset password',
        subtitle: 'Email a reset link',
        icon: 'lock',
        onPress: () =>
          router.push({
            pathname: '/forgot-password',
            params: user?.email ? { email: user.email } : undefined,
          }),
      },
      {
        id: 'privacy-policy',
        label: 'Privacy Policy',
        subtitle: 'How we collect, use, and protect data',
        icon: 'info-circle',
        route: '/privacy-policy',
      },
      {
        id: 'data-deletion',
        label: 'Delete account/data',
        subtitle: 'Request account and content deletion',
        icon: 'trash',
        route: '/data-deletion',
      },
    ],
    [router, user?.email]
  );

  const showVerifyEmail = Boolean(user && !user.emailVerifiedAt);

  const activeRowBg = resolvedTheme === 'dark' ? '#3f3f46' : '#f3f4f6';
  const brand = colors.tint;

  const renderLinkRow = (item: SettingsLink, index: number, total: number) => (
    <Pressable
      key={item.id}
      onPress={() => {
        if (item.onPress) item.onPress();
        else if (item.route) router.push(item.route as never);
      }}
      style={({ pressed }) => [
        styles.linkRow,
        index > 0 && styles.rowBorder,
        { borderTopColor: borderColor },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name={item.icon} size={20} color={brand} />
      <View style={styles.linkTextWrap}>
        <Text style={[styles.linkLabel, { color: textColor }]}>{item.label}</Text>
        {item.subtitle ? (
          <Text style={[styles.linkSubtitle, { color: mutedColor }]}>{item.subtitle}</Text>
        ) : null}
      </View>
      <AppIcon name="chevron-right" size={14} color={mutedColor} />
    </Pressable>
  );

  return (
    <ScreenShell style={styles.screen}>
      <StackPageHeader
        title="Settings"
        subtitle="Account, notifications, workspace, and appearance."
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {showVerifyEmail ? (
          <View style={[styles.banner, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.bannerTitle, { color: textColor }]}>Verify your email</Text>
            <Text style={[styles.bannerText, { color: mutedColor }]}>
              Confirm {user?.email} to secure your account and receive important updates.
            </Text>
            <Pressable
              onPress={handleResendVerification}
              disabled={resendLoading}
              style={({ pressed }) => [
                styles.bannerButton,
                { borderColor: brand },
                pressed && styles.pressed,
                resendLoading && styles.disabled,
              ]}
            >
              {resendLoading ? (
                <ActivityIndicator color={brand} size="small" />
              ) : (
                <Text style={[styles.bannerButtonText, { color: brand }]}>Resend verification email</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {accountLinks.map((item, index) => renderLinkRow(item, index, accountLinks.length))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: textColor, marginTop: 0, marginBottom: 0 }]}>
            Notifications
          </Text>
          <View style={styles.sectionActions}>
            <Pressable
              onPress={handleResetNotificationPrefs}
              disabled={loadingProfile || !hasNotificationPrefs || updateNotificationPrefsMutation.isPending}
              style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
            >
              <Text style={[styles.textActionLabel, { color: mutedColor }]}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveNotificationPrefs}
              disabled={loadingProfile || !hasNotificationPrefs || updateNotificationPrefsMutation.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                { backgroundColor: brand },
                pressed && styles.pressed,
                (loadingProfile || !hasNotificationPrefs || updateNotificationPrefsMutation.isPending) &&
                  styles.disabled,
              ]}
            >
              {updateNotificationPrefsMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
        <Text style={[styles.sectionHint, { color: mutedColor }]}>
          Choose what appears in the bell and whether to also get email at {user?.email || 'your account email'}.
        </Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.pushStatusBox, { borderColor, backgroundColor: activeRowBg }]}>
            <View style={styles.pushStatusHeader}>
              <AppIcon name="bell" size={18} color={brand} />
              <Text style={[styles.noticeTitle, { color: textColor }]}>Push delivery</Text>
            </View>
            <Text style={[styles.noticeText, { color: mutedColor }]}>
              {pushState?.message || 'Checking push notification status...'}
            </Text>
            {pushState?.updatedAt ? (
              <Text style={[styles.pushMetaText, { color: mutedColor }]}>
                Last checked {new Date(pushState.updatedAt).toLocaleString()}
              </Text>
            ) : null}
            <Pressable
              onPress={handleEnablePush}
              disabled={pushLoading || pushState?.status === 'unsupported' || pushState?.canAskAgain === false}
              style={({ pressed }) => [
                styles.pushButton,
                { borderColor: brand },
                pressed && styles.pressed,
                (pushLoading || pushState?.status === 'unsupported' || pushState?.canAskAgain === false) && styles.disabled,
              ]}
            >
              {pushLoading ? (
                <ActivityIndicator color={brand} size="small" />
              ) : (
                <Text style={[styles.pushButtonText, { color: brand }]}>
                  {pushState?.status === 'registered' ? 'Refresh push token' : 'Enable push notifications'}
                </Text>
              )}
            </Pressable>
          </View>
          <View style={[styles.noticeBox, { borderColor, backgroundColor: activeRowBg }]}>
            <Text style={[styles.noticeTitle, { color: textColor }]}>Security and account email</Text>
            <Text style={[styles.noticeText, { color: mutedColor }]}>
              Password reset, email verification, and workspace invitations are sent when required. They are not
              controlled by these toggles.
            </Text>
          </View>

          {loadingProfile || !hasNotificationPrefs ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={brand} />
              <Text style={[styles.loadingText, { color: mutedColor }]}>Loading preferences…</Text>
            </View>
          ) : (
            <>
              <View style={[styles.notifHeaderRow, { borderBottomColor: borderColor, backgroundColor: activeRowBg }]}>
                <Text style={[styles.notifHeaderCell, styles.notifCategoryCell, { color: mutedColor }]}>
                  Category
                </Text>
                <Text style={[styles.notifHeaderCell, { color: mutedColor }]}>In-app</Text>
                <Text style={[styles.notifHeaderCell, { color: mutedColor }]}>Email</Text>
              </View>
              {(NOTIFICATION_PREFERENCE_CATEGORY_ORDER ?? []).map((key) => {
                const row = notificationCategories?.[key];
                if (!row) return null;
                const label = NOTIFICATION_PREFERENCE_CATEGORY_LABELS[key] || key;
                return (
                  <View key={key} style={[styles.notifRow, { borderBottomColor: borderColor }]}>
                    <View style={styles.notifCategoryCell}>
                      <Text style={[styles.notifLabel, { color: textColor }]}>{label}</Text>
                      {key === 'user' ? (
                        <Text style={[styles.notifSubLabel, { color: mutedColor }]}>
                          Invitation messages are always delivered.
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.notifSwitchCell}>
                      <Switch
                        value={row.in_app !== false}
                        onValueChange={(v) => setNotifChannel(key, 'in_app', v)}
                        trackColor={{ false: borderColor, true: `${brand}88` }}
                        thumbColor={row.in_app !== false ? brand : '#f4f4f5'}
                      />
                    </View>
                    <View style={styles.notifSwitchCell}>
                      <Switch
                        value={row.email === true}
                        onValueChange={(v) => setNotifChannel(key, 'email', v)}
                        trackColor={{ false: borderColor, true: `${brand}88` }}
                        thumbColor={row.email === true ? brand : '#f4f4f5'}
                      />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Workspace</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {memberships.length === 0 ? (
            <Text style={[styles.emptyText, { color: mutedColor }]}>No workspaces</Text>
          ) : (
            memberships.map((m, index) => {
              const isActive = m.tenantId === activeTenantId;
              const name = m.tenant?.name ?? `Workspace ${m.tenantId.slice(0, 8)}`;
              return (
                <Pressable
                  key={m.tenantId}
                  onPress={() => handleSelectTenant(m.tenantId)}
                  style={({ pressed }) => [
                    styles.tenantRow,
                    index > 0 && styles.rowBorder,
                    { borderTopColor: borderColor },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.tenantInfo}>
                    <Text style={[styles.tenantName, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.tenantType, { color: mutedColor }]}>
                      {m.tenant?.businessType ?? '—'}
                    </Text>
                  </View>
                  {isActive ? <AppIcon name="check-circle" size={22} color={brand} /> : null}
                </Pressable>
              );
            })
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {(
            [
              { key: 'light' as const, label: 'Light', icon: 'sun-o' as AppIconName },
              { key: 'dark' as const, label: 'Dark', icon: 'moon-o' as AppIconName },
              { key: 'system' as const, label: 'System', icon: 'circle-o' as AppIconName },
            ] as const
          ).map((option, index) => {
            const active = theme === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setTheme(option.key)}
                style={({ pressed }) => [
                  styles.prefRow,
                  active && { backgroundColor: activeRowBg },
                  index > 0 && styles.rowBorder,
                  { borderTopColor: borderColor },
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon name={option.icon} size={20} color={active ? brand : mutedColor} />
                <Text style={[styles.prefLabel, { color: textColor }]}>{option.label}</Text>
                {active ? <AppIcon name="check-circle" size={20} color={brand} /> : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
    gap: 12,
  },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHint: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  bannerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  bannerText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  bannerButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerButtonText: { fontSize: 14, fontWeight: '600' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  linkTextWrap: { flex: 1 },
  linkLabel: { fontSize: 16, fontWeight: '600' },
  linkSubtitle: { fontSize: 13, marginTop: 2 },
  noticeBox: {
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pushStatusBox: {
    margin: 12,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pushStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  noticeText: { fontSize: 12, lineHeight: 18 },
  pushMetaText: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  pushButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  pushButtonText: { fontSize: 13, fontWeight: '600' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  loadingText: { fontSize: 14 },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginTop: 12,
  },
  notifHeaderCell: { fontSize: 12, fontWeight: '600', textAlign: 'center', width: 72 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notifCategoryCell: { flex: 1, width: undefined, textAlign: 'left' },
  notifLabel: { fontSize: 14, fontWeight: '600' },
  notifSubLabel: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  notifSwitchCell: { width: 72, alignItems: 'center' },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 16, fontWeight: '600' },
  tenantType: { fontSize: 13, marginTop: 2 },
  emptyText: { padding: 20, fontSize: 15 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  prefLabel: { flex: 1, fontSize: 16 },
  rowBorder: { borderTopWidth: 1 },
  textAction: { paddingVertical: 6, paddingHorizontal: 4 },
  textActionLabel: { fontSize: 14, fontWeight: '600' },
  saveButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
});
