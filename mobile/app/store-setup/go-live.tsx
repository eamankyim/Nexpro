import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { Image } from 'expo-image';

import { FeatureAccessDenied } from '@/components/FeatureAccessDenied';
import { AppIcon, type AppIconName } from '@/components/AppIcon';
import { StoreSetupChrome } from '@/components/store/StoreSetupChrome';
import { useAuth } from '@/context/AuthContext';
import { useStoreSetup } from '@/context/StoreSetupContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { getErrorMessage } from '@/utils/errorMessages';
import { firstFilled, STORE_PRIMARY_FALLBACK } from '@/utils/onlineStoreDefaults';
import { resolveImageUrl } from '@/utils/fileUtils';
import { getLaunchBlockReason, type StoreSetupStepId } from '@/utils/storeSetupFlow';
import { buildOnlineStoreUrl } from '@/utils/storefrontUrl';
import { BRAND_GREEN } from '@/constants/brand';

/** Same welcome hero as Online Store launch — cropped small beside the headline. */
const HERO_THUMB = require('../../assets/images/online-store-welcome.png');

const ICON_TINT = '#dcfce7';

type ReviewRow = {
  key: string;
  label: string;
  value: string;
  icon: AppIconName;
  editStep?: StoreSetupStepId;
  swatch?: string;
  /** Resolved image URI for logo preview */
  thumbUri?: string;
  valueTone?: 'default' | 'success';
  showCheck?: boolean;
  hint?: string;
};

/**
 * Step 7 — Review configured details as cards, then go live when checklist.canLaunch.
 */
export default function StoreSetupGoLiveScreen() {
  const { hasFeature } = useAuth();
  const { textColor, mutedColor, borderColor, cardBg } = useScreenColors();
  const {
    gapFlags,
    settings,
    defaults,
    checklist,
    paymentConfigured,
    refreshSetupStatus,
    goToStep,
    buildSmartDefaultsPayload,
    saveSettings,
    finishAndOpenStore,
  } = useStoreSetup();

  const [launching, setLaunching] = useState(false);

  // Background checklist sync only — never blocks the review UI or navigation.
  useEffect(() => {
    void refreshSetupStatus();
  }, [refreshSetupStatus]);

  const blockReason = getLaunchBlockReason(checklist);
  const canLaunch = Boolean(checklist.canLaunch);
  const storeUrl = buildOnlineStoreUrl(String(settings?.slug || ''), {
    customDomain: settings?.customDomain as string | undefined,
    customDomainStatus: settings?.customDomainStatus as string | undefined,
  });

  const storeName = String(settings?.displayName || defaults.displayName || '').trim() || 'Not set';
  const contact =
    String(settings?.whatsappNumber || settings?.contactPhone || defaults.whatsappNumber || defaults.contactPhone || '')
      .trim() || 'Not set';
  // Settings (incl. business logo copied on first save) or live org/tenant default.
  const logoUrl = firstFilled(settings?.logoUrl, defaults.logoUrl);
  const logoPreview = logoUrl ? resolveImageUrl(logoUrl) : '';
  const brandColor =
    String(settings?.primaryColor || defaults.primaryColor || STORE_PRIMARY_FALLBACK).trim() ||
    STORE_PRIMARY_FALLBACK;
  const listingsCount = Number(checklist.listingsCount);
  const publishedCount = Number.isFinite(listingsCount) ? Math.max(0, listingsCount) : 0;
  const paymentsConnected = paymentConfigured || checklist.hasPaymentMethod;
  const paymentsLabel = paymentsConnected ? 'Connected' : 'Not set';

  const reviewRows = useMemo<ReviewRow[]>(
    () => [
      { key: 'name', label: 'Store name', value: storeName, icon: 'store', editStep: 'confirm-name' },
      {
        key: 'contact',
        label: 'WhatsApp / contact',
        value: contact,
        icon: 'comments',
        editStep: 'whatsapp',
      },
      {
        key: 'logo',
        label: 'Logo',
        value: logoUrl ? 'Yes' : 'No',
        icon: 'image',
        editStep: 'logo',
        thumbUri: logoPreview || undefined,
      },
      {
        key: 'color',
        label: 'Brand color',
        value: brandColor,
        icon: 'palette',
        editStep: 'color',
        swatch: brandColor,
      },
      {
        key: 'payments',
        label: 'Payments',
        value: paymentsLabel,
        icon: 'credit-card',
        editStep: 'payments',
        valueTone: paymentsConnected ? 'success' : 'default',
        showCheck: paymentsConnected,
      },
      {
        key: 'products',
        label: 'Products published',
        value: publishedCount === 1 ? '1 product' : `${publishedCount} products`,
        icon: 'package',
        editStep: 'products',
      },
      {
        key: 'url',
        label: 'Store URL',
        value: storeUrl || 'Available after name is saved',
        icon: 'link',
        hint: storeUrl ? 'This is your store link' : undefined,
      },
    ],
    [brandColor, contact, logoPreview, logoUrl, paymentsConnected, paymentsLabel, publishedCount, storeName, storeUrl]
  );

  const onEditRow = useCallback(
    (step: StoreSetupStepId) => {
      goToStep(step);
    },
    [goToStep]
  );

  const onGoLive = useCallback(async () => {
    if (!canLaunch) {
      Alert.alert('Almost there', blockReason || 'Finish the remaining setup steps first.');
      return;
    }
    setLaunching(true);
    try {
      await saveSettings(await buildSmartDefaultsPayload({ launch: true }), { awaitStatus: true });
      finishAndOpenStore();
    } catch (error) {
      Alert.alert('Could not launch', getErrorMessage(error, 'Failed to go live.'));
    } finally {
      setLaunching(false);
    }
  }, [blockReason, buildSmartDefaultsPayload, canLaunch, finishAndOpenStore, saveSettings]);

  if (!hasFeature('paymentsExpenses')) {
    return <FeatureAccessDenied message="Online store is not enabled for your workspace." />;
  }

  return (
    <StoreSetupChrome
      stepId="go-live"
      gapFlags={gapFlags}
      onContinue={() => {
        void onGoLive();
      }}
      continueLabel="Go live"
      continueIcon="rocket"
      continueDisabled={!canLaunch}
      continuing={launching}
    >
      <View style={styles.introRow}>
        <View style={styles.introCopy}>
          <Text style={[styles.headline, { color: textColor }]}>Ready to go live?</Text>
          <Text style={[styles.body, { color: mutedColor }]}>
            Review your settings below. Tap any item or progress step to edit, then launch your store.
          </Text>
        </View>
        <View style={[styles.heroThumbWrap, { borderColor }]}>
          <Image source={HERO_THUMB} style={styles.heroThumb} contentFit="cover" />
        </View>
      </View>

      <View style={styles.reviewList}>
        {reviewRows.map((row) => {
          const editable = Boolean(row.editStep);
          const valueColor =
            row.valueTone === 'success' ? BRAND_GREEN : textColor;

          const rowInner = (
            <>
              <View style={[styles.iconCircle, { backgroundColor: ICON_TINT }]}>
                <AppIcon name={row.icon} size={18} color={BRAND_GREEN} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: mutedColor }]}>{row.label}</Text>
                <View style={styles.rowValueWrap}>
                  {row.thumbUri ? (
                    <Image
                      source={{ uri: row.thumbUri }}
                      style={[styles.logoThumb, { borderColor }]}
                      contentFit="contain"
                    />
                  ) : null}
                  {row.swatch ? (
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: row.swatch, borderColor },
                      ]}
                    />
                  ) : null}
                  <Text style={[styles.rowValue, { color: valueColor }]} numberOfLines={2}>
                    {row.value}
                  </Text>
                  {row.showCheck ? (
                    <AppIcon name="check-circle" size={16} color={BRAND_GREEN} />
                  ) : null}
                </View>
                {row.hint ? (
                  <View style={styles.hintRow}>
                    <Text style={[styles.hint, { color: mutedColor }]}>{row.hint}</Text>
                    <AppIcon name="info-circle" size={14} color={mutedColor} />
                  </View>
                ) : null}
              </View>
              {editable ? (
                <AppIcon name="chevron-right" size={18} color={mutedColor} />
              ) : null}
            </>
          );

          const cardStyle = [
            styles.reviewCard,
            { borderColor, backgroundColor: cardBg },
          ];

          return editable ? (
            <Pressable
              key={row.key}
              onPress={() => onEditRow(row.editStep!)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.label}`}
              style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
            >
              {rowInner}
            </Pressable>
          ) : (
            <View key={row.key} style={cardStyle}>
              {rowInner}
            </View>
          );
        })}
      </View>

      {canLaunch ? (
        <View style={[styles.statusCard, { borderColor, backgroundColor: cardBg }]}>
          <View style={styles.statusTitleRow}>
            <View style={styles.statusCheck}>
              <AppIcon name="check" size={14} color="#fff" strokeWidth={3} />
            </View>
            <Text style={[styles.statusTitle, { color: textColor }]}>All set to launch</Text>
          </View>
          {checklist.publishedListingWarning || publishedCount === 0 ? (
            <Text style={[styles.statusBody, { color: mutedColor }]}>
              No products published yet — customers will see an empty catalog until you add some.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.statusCard, { borderColor, backgroundColor: cardBg }]}>
          <View style={styles.statusTitleRow}>
            <AppIcon name="exclamation-circle" size={22} color="#b45309" />
            <Text style={[styles.statusTitle, { color: textColor }]}>Almost there</Text>
          </View>
          <Text style={[styles.statusBody, { color: mutedColor }]}>
            {blockReason || 'Finish the remaining setup steps before going live.'}
          </Text>
        </View>
      )}
    </StoreSetupChrome>
  );
}

const styles = StyleSheet.create({
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  introCopy: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#0a0a0a',
  },
  heroThumb: {
    width: '140%',
    height: '140%',
    marginLeft: '-18%',
    marginTop: '-12%',
  },
  reviewList: {
    gap: 10,
    marginTop: 4,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logoThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#f3f4f6',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  statusCard: {
    gap: 8,
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 34,
  },
});
