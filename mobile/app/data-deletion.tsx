import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { StackPageHeader } from '@/components/StackPageHeader';
import { FormInput, FormLabel } from '@/components/FormField';
import { useAuth } from '@/context/AuthContext';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';
import { settingsService } from '@/services/settings';
import { getErrorMessage } from '@/utils/errorMessages';

export default function DataDeletionScreen() {
  const { user } = useAuth();
  const { bg, cardBg, borderColor, textColor, mutedColor, colors } = useScreenColors();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleRequestDeletion = async () => {
    Alert.alert(
      'Request account deletion',
      'We will review this request and delete eligible account and workspace data. Some records may be retained when required for legal, tax, fraud prevention, or security reasons.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit request',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await settingsService.requestDataDeletion({ reason: reason.trim() || undefined });
              setSubmitted(true);
            } catch (err) {
              Alert.alert('Could not submit request', getErrorMessage(err, 'Please try again.'));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenShell style={styles.container}>
      <StackPageHeader
        title="Delete account/data"
        subtitle="Request removal of your account and associated business data."
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!user ? (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.cardTitle, { color: colors.tint }]}>Sign in required</Text>
            <Text style={[styles.bodyText, { color: mutedColor }]}>
              To protect account security, please sign in first. After signing in, return here to request deletion of your
              account and associated business data.
            </Text>
            <Pressable
              onPress={() => router.replace('/login')}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.tint },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Go to sign in</Text>
            </Pressable>
          </View>
        ) : submitted ? (
          <View style={[styles.successCard, { borderColor: colors.tint }]}>
            <Text style={[styles.successTitle, { color: colors.tint }]}>Request received</Text>
            <Text style={[styles.bodyText, { color: mutedColor }]}>
              We received your deletion request for {user?.email || 'your account'}. Our team will review it and follow up if
              more information is needed.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.cardTitle, { color: colors.tint }]}>What happens next?</Text>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                Submitting this request starts the account and data deletion process for the signed-in user and active workspace.
              </Text>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                Deletion may remove profile details, workspace settings, customer records, sales records, invoices, products,
                uploaded files, and other content you created or manage.
              </Text>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                Some information may be retained where required for legal, accounting, security, fraud prevention, or dispute
                resolution obligations.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
              <FormLabel optional>Note</FormLabel>
              <FormInput
                value={reason}
                onChangeText={setReason}
                placeholder="Tell us anything we should know"
                multiline
                editable={!submitting}
              />
            </View>

            <Pressable
              onPress={handleRequestDeletion}
              disabled={submitting}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
                submitting && styles.disabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>Request account deletion</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 10,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  successCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.7,
  },
});
