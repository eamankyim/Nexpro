import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { useScreenColors } from '@/hooks/useScreenColors';

export const FORM_SHEET_HEIGHT = '90%';

export type FormSheetModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Sticky action bar — stays visible above the keyboard; form fields scroll above it. */
  footer?: React.ReactNode;
  keyboardVerticalOffset?: number;
  cardBg?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
};

/** Bottom sheet modal for add/edit forms — 90% height with scrollable body and pinned footer. */
export function FormSheetModal({
  visible,
  title,
  onClose,
  children,
  footer,
  keyboardVerticalOffset = 0,
  cardBg: cardBgProp,
  borderColor: borderColorProp,
  textColor: textColorProp,
  mutedColor: mutedColorProp,
}: FormSheetModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useScreenColors();
  const cardBg = cardBgProp ?? theme.cardBg;
  const borderColor = borderColorProp ?? theme.borderColor;
  const textColor = textColorProp ?? theme.textColor;
  const mutedColor = mutedColorProp ?? theme.mutedColor;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { backgroundColor: cardBg }]}>
            <View style={[styles.header, { borderBottomColor: borderColor }]}>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <AppIcon name="times" size={22} color={mutedColor} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: borderColor,
                    backgroundColor: cardBg,
                    paddingBottom: Math.max(insets.bottom, 16),
                  },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrap: {
    width: '100%',
    height: FORM_SHEET_HEIGHT,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: 12 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 8 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'stretch',
  },
});
