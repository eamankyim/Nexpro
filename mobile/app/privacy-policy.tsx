import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { StackPageHeader } from '@/components/StackPageHeader';
import { useScreenColors } from '@/hooks/useScreenColors';
import { ScreenShell } from '@/components/ScreenShell';

const sections = [
  {
    title: 'Information we collect',
    body:
      'We collect account information such as your name, email address, profile photo, business name, phone number, address, logo, and workspace settings. We also process business records you add, including customers, products, sales, invoices, expenses, quotes, jobs, and related files.',
  },
  {
    title: 'How we use information',
    body:
      'We use this information to provide business management features, keep your workspace secure, sync your data across devices, send account and business notifications, and improve ABS Ghana (African Business Suite).',
  },
  {
    title: 'Photos, files, and camera',
    body:
      'When you choose to upload logos, receipts, profile images, or scan products, the app may request access to your camera or photo library. We only use those permissions for the feature you select.',
  },
  {
    title: 'Sharing',
    body:
      'We do not sell personal information. We may share data with service providers that help run the app, such as hosting, analytics, email, messaging, payment, and storage providers, only as needed to deliver the service.',
  },
  {
    title: 'Retention and deletion',
    body:
      'We retain account and business data while your account is active or as needed for legal, security, accounting, and operational reasons. You can request account and data deletion from the app under Account or Settings.',
  },
  {
    title: 'Contact',
    body:
      'For privacy questions or deletion requests, contact support through the app or email the ABS Ghana (African Business Suite) support team.',
  },
];

export default function PrivacyPolicyScreen() {
  const { bg, textColor, mutedColor } = useScreenColors();

  return (
    <ScreenShell style={styles.screen}>
      <StackPageHeader title="Privacy Policy" subtitle="Last updated: May 20, 2026" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: mutedColor }]}>
          This policy explains how ABS Ghana (African Business Suite) collects, uses, and protects information in the mobile app.
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
