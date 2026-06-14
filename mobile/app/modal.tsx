import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { ScreenShell } from '@/components/ScreenShell';
import { StackPageHeader } from '@/components/StackPageHeader';
import { Text, View } from '@/components/Themed';

export default function ModalScreen() {
  return (
    <ScreenShell style={styles.screen}>
      <StackPageHeader title="Modal" />
      <View style={styles.container}>
        <Text style={styles.title}>Modal</Text>
        <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
        <EditScreenInfo path="app/modal.tsx" />

        {/* Use a light status bar on iOS to account for the black space above the modal */}
        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
