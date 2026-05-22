import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.title, { color: textColor }]}>Delivery status</Text>
            <Pressable
              onPress={() => handleSelect(null)}
              style={[styles.option, { borderBottomColor: borderColor }]}
            >
              <Text style={[styles.optionText, { color: textColor }]}>Not set yet</Text>
              {!value ? <AppIcon name="check" size={16} color={tintColor} /> : null}
            </Pressable>
            {DELIVERY_STATUS_ORDER.map((status) => {
              const selected = value === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => handleSelect(status)}
                  style={[styles.option, { borderBottomColor: borderColor }]}
                >
                  <Text style={[styles.optionText, { color: textColor }]}>
                    {getDeliveryStatusDisplayLabel(status)}
                  </Text>
                  {selected ? <AppIcon name="check" size={16} color={tintColor} /> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
              <Text style={{ color: mutedColor, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 180,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  title: { fontSize: 16, fontWeight: '700', padding: 16 },
  option: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionText: { fontSize: 15, fontWeight: '500', flex: 1 },
  cancel: { padding: 16, alignItems: 'center' },
});
