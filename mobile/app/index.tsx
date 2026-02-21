import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      logger.debug('Index', 'Auth loading...');
      return;
    }
    if (user) {
      logger.info('Index', 'User logged in, redirecting to tabs');
      router.replace('/(tabs)');
    } else {
      logger.info('Index', 'No user, redirecting to login');
      router.replace('/login');
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#166534" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
