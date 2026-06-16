import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenShell } from '@/components/ScreenShell';
import { StackPageHeader } from '@/components/StackPageHeader';
import { useScreenColors } from '@/hooks/useScreenColors';
import { TERMS_VERSION } from '@/constants/legal';

const sections = [
  {
    title: 'Using African Business Suite',
    body:
      'African Business Suite helps businesses manage daily operations, storefronts, customer records, jobs, sales, payments, and related workflows. You are responsible for the accuracy of information you enter and for activity under your account.',
  },
  {
    title: 'Account responsibility',
    body:
      'Keep your login details secure and only invite trusted team members to your workspace. Contact support if you believe your account has been accessed without permission.',
  },
  {
    title: 'Business data',
    body:
      'Your workspace data belongs to your business. We process it to provide the service, keep the platform reliable, and support features you choose to use.',
  },
  {
    title: 'Payments and marketplace activity',
    body:
      'When you use checkout, marketplace, or payment features, you agree to provide accurate transaction details and follow the seller, buyer, and payment rules shown in the app.',
  },
  {
    title: 'Acceptable use',
    body:
      'Do not use ABS for fraud, illegal activity, abuse, spam, or attempts to disrupt the platform or other users.',
  },
  {
    title: 'Updates',
    body:
      'We may update these terms as the product evolves. Important changes will be communicated through the app or account email where appropriate.',
  },
];

export default function TermsScreen() {
  const { textColor, mutedColor } = useScreenColors();

  return (
    <ScreenShell style={styles.screen}>
      <StackPageHeader title="Terms and Conditions" subtitle={`Version ${TERMS_VERSION}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: mutedColor }]}>
          These terms explain the basic rules for using African Business Suite (ABS).
          By creating an account, you agree to these terms and our Privacy Policy.
        </Text>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: mutedColor }]}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  sectionBody: { fontSize: 15, lineHeight: 22 },
});
