import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import * as DocumentPicker from 'expo-document-picker';

import { FormSheetModal } from '@/components/FormSheetModal';
import {
  contactImportService,
  type ContactImportDestination,
  type ContactImportItem,
} from '@/services/contactImportService';
import { getApiErrorMessage } from '@/utils/parseApiListResponse';

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultDestination?: ContactImportDestination;
  onImported?: () => void;
  colors: { tint: string };
  cardBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
};

type PhoneContactRow = ContactImportItem & { id: string };

const MAX_CONTACTS = 500;

/**
 * Mobile import sheet: destination + From phone / From file.
 */
export function ImportContactsSheet({
  visible,
  onClose,
  defaultDestination = 'customers',
  onImported,
  colors,
  cardBg,
  borderColor,
  textColor,
  mutedColor,
}: Props) {
  const [destination, setDestination] = useState<ContactImportDestination>(defaultDestination);
  const [mode, setMode] = useState<'menu' | 'phone'>('menu');
  const [phoneRows, setPhoneRows] = useState<PhoneContactRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (visible) {
      setDestination(defaultDestination);
      setMode('menu');
      setPhoneRows([]);
      setSelectedIds(new Set());
      setLoading(false);
      setLoadingContacts(false);
    }
  }, [defaultDestination, visible]);

  const selectedContacts = useMemo(
    () => phoneRows.filter((row) => selectedIds.has(row.id)),
    [phoneRows, selectedIds]
  );

  const handleLoadPhoneContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow contacts access to import from your phone, or use Import from file instead.'
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        pageSize: MAX_CONTACTS,
        sort: Contacts.SortTypes.FirstName,
      });

      const rows: PhoneContactRow[] = (data || [])
        .map((contact, index) => {
          const name = contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed';
          const phone = contact.phoneNumbers?.[0]?.number || '';
          const email = contact.emails?.[0]?.email || '';
          if (!name && !phone && !email) return null;
          return {
            id: contact.id || `contact-${index}`,
            name,
            phone: phone || undefined,
            email: email || undefined,
          };
        })
        .filter(Boolean) as PhoneContactRow[];

      setPhoneRows(rows.slice(0, MAX_CONTACTS));
      setSelectedIds(new Set());
      setMode('phone');
    } catch (error) {
      Alert.alert('Could not load contacts', getApiErrorMessage(error, 'Try again or use file import.'));
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(phoneRows.map((row) => row.id)));
  }, [phoneRows]);

  const handleImportSelected = useCallback(async () => {
    if (!selectedContacts.length) {
      Alert.alert('Select contacts', 'Choose at least one contact to import.');
      return;
    }
    setLoading(true);
    try {
      const result = await contactImportService.importFromContacts(
        destination,
        selectedContacts.map(({ name, phone, email }) => ({ name, phone, email }))
      );
      const created = result.successCount || 0;
      const skipped = result.skippedCount || 0;
      Alert.alert(
        'Import complete',
        `Created ${created}. Skipped ${skipped}. Errors ${result.errorCount || 0}.`
      );
      if (created > 0) onImported?.();
      onClose();
    } catch (error) {
      Alert.alert('Import failed', getApiErrorMessage(error, 'Could not import contacts.'));
    } finally {
      setLoading(false);
    }
  }, [destination, onClose, onImported, selectedContacts]);

  const handleImportFile = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setLoading(true);
      const result = await contactImportService.importFromFile(destination, {
        uri: asset.uri,
        name: asset.name || 'contacts.csv',
        mimeType: asset.mimeType,
      });
      const created = result.successCount || 0;
      const skipped = result.skippedCount || 0;
      Alert.alert(
        'Import complete',
        `Created ${created}. Skipped ${skipped}. Errors ${result.errorCount || 0}.`
      );
      if (created > 0) onImported?.();
      onClose();
    } catch (error) {
      Alert.alert('Import failed', getApiErrorMessage(error, 'Could not import file.'));
    } finally {
      setLoading(false);
    }
  }, [destination, onClose, onImported]);

  return (
    <FormSheetModal
      visible={visible}
      title="Import contacts"
      onClose={onClose}
      cardBg={cardBg}
      borderColor={borderColor}
      textColor={textColor}
      mutedColor={mutedColor}
      footer={
        mode === 'phone' ? (
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => setMode('menu')}
              style={[styles.secondaryBtn, { borderColor }]}
            >
              <Text style={[styles.secondaryBtnText, { color: textColor }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleImportSelected}
              disabled={loading || selectedContacts.length === 0}
              style={[styles.primaryBtn, { backgroundColor: colors.tint, opacity: loading ? 0.7 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  Import ({selectedContacts.length})
                </Text>
              )}
            </Pressable>
          </View>
        ) : null
      }
    >
      <View style={styles.body}>
        <Text style={[styles.label, { color: mutedColor }]}>Import into</Text>
        <View style={styles.destRow}>
          {(['customers', 'leads'] as const).map((value) => {
            const active = destination === value;
            return (
              <Pressable
                key={value}
                onPress={() => setDestination(value)}
                style={[
                  styles.destChip,
                  {
                    borderColor: active ? colors.tint : borderColor,
                    backgroundColor: active ? `${colors.tint}18` : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? colors.tint : textColor, fontWeight: '600' }}>
                  {value === 'customers' ? 'Customers' : 'Leads'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'menu' ? (
          <View style={styles.menu}>
            <Pressable
              onPress={handleLoadPhoneContacts}
              disabled={loadingContacts}
              style={[styles.menuBtn, { borderColor }]}
            >
              {loadingContacts ? (
                <ActivityIndicator color={colors.tint} />
              ) : (
                <Text style={[styles.menuBtnText, { color: textColor }]}>From phone contacts</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleImportFile}
              disabled={loading}
              style={[styles.menuBtn, { borderColor }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.tint} />
              ) : (
                <Text style={[styles.menuBtnText, { color: textColor }]}>From CSV / Excel file</Text>
              )}
            </Pressable>
            <Text style={[styles.hint, { color: mutedColor }]}>
              Phone import asks for permission. Duplicates are skipped.
            </Text>
          </View>
        ) : (
          <View style={styles.phoneList}>
            <View style={styles.phoneHeader}>
              <Text style={[styles.label, { color: mutedColor }]}>
                {phoneRows.length} contacts
              </Text>
              <Pressable onPress={selectAllVisible}>
                <Text style={{ color: colors.tint, fontWeight: '600' }}>Select all</Text>
              </Pressable>
            </View>
            <FlatList
              data={phoneRows}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = selectedIds.has(item.id);
                return (
                  <Pressable
                    onPress={() => toggleSelected(item.id)}
                    style={[styles.contactRow, { borderColor }]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: selected ? colors.tint : borderColor,
                          backgroundColor: selected ? colors.tint : 'transparent',
                        },
                      ]}
                    />
                    <View style={styles.contactText}>
                      <Text style={[styles.contactName, { color: textColor }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={{ color: mutedColor, fontSize: 12 }} numberOfLines={1}>
                        {[item.phone, item.email].filter(Boolean).join(' · ') || 'No phone/email'}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </View>
    </FormSheetModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, minHeight: 220 },
  label: { fontSize: 13, fontWeight: '600' },
  destRow: { flexDirection: 'row', gap: 8 },
  destChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  menu: { gap: 10, marginTop: 8 },
  menuBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  menuBtnText: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 18 },
  phoneList: { flex: 1, minHeight: 280 },
  phoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  list: { maxHeight: 320 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
  },
  contactText: { flex: 1, minWidth: 0 },
  contactName: { fontSize: 14, fontWeight: '600' },
  footerRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '600' },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
