import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import {
  AppBottomSheet,
  APP_SHEET_HEIGHT_COMPACT,
  SheetMenuRow,
} from '@/components/AppBottomSheet';
import { FontFamily, FontSize } from '@/constants/typography';
import { DELIVERY_STATUS_ORDER, getDeliveryStatusDisplayLabel } from '@/utils/deliveryStatus';

type DeliveryStatusPickerProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  tintColor: string;
  loading?: boolean;
  disabled?: boolean;
};

export function DeliveryStatusPicker({
  value,
  onChange,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
  tintColor,
  loading,
  disabled,
}: DeliveryStatusPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (nextValue: string | null) => {
    setOpen(false);
    onChange(nextValue);
  };

  return (
    <>
      <Pressable
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { borderColor },
          (disabled || loading) && { opacity: 0.6 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tintColor} />
        ) : (
          <>
            <Text style={[styles.triggerText, { color: textColor }]} numberOfLines={1}>
              {getDeliveryStatusDisplayLabel(value)}
            </Text>
            <AppIcon name="chevron-down" size={16} color={mutedColor} />
          </>
        )}
      </Pressable>

      <AppBottomSheet
        visible={open}
        title="Delivery status"
        onClose={() => setOpen(false)}
        height={APP_SHEET_HEIGHT_COMPACT}
        cardBg={cardBg}
        borderColor={borderColor}
        textColor={textColor}
        mutedColor={mutedColor}
      >
        <SheetMenuRow
          label="Not set yet"
          active={!value}
          onPress={() => handleSelect(null)}
          trailing={!value ? <AppIcon name="check" size={18} color="#fff" /> : <View />}
        />
        {DELIVERY_STATUS_ORDER.map((status) => {
          const selected = value === status;
          return (
            <SheetMenuRow
              key={status}
              label={getDeliveryStatusDisplayLabel(status)}
              active={selected}
              onPress={() => handleSelect(status)}
              trailing={selected ? <AppIcon name="check" size={18} color="#fff" /> : <View />}
            />
          );
        })}
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    fontWeight: '500',
  },
});
