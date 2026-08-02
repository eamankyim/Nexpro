import React, { useState, useEffect, lazy, Suspense } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasSeenOnboarding, setOnboardingCompleted } from '../utils/storage';
import { TOKEN_KEY } from '../config/env';
import { getMarketerSession } from '../api/absMarketer';

import SplashScreen from '../screens/auth/SplashScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import SignupProfileScreen from '../screens/auth/SignupProfileScreen';
import SignupPasswordScreen from '../screens/auth/SignupPasswordScreen';
import MarketerTabNavigator from './MarketerTabNavigator';

const BusinessDetailsScreen = lazy(() => import('../screens/marketer/BusinessDetailsScreen'));
const AddReferralScreen = lazy(() => import('../screens/marketer/AddReferralScreen'));
const MarketerReferralDetailsScreen = lazy(() => import('../screens/marketer/MarketerReferralDetailsScreen'));
const CashoutRequestScreen = lazy(() => import('../screens/marketer/CashoutRequestScreen'));
const PaymentMethodSetupScreen = lazy(() => import('../screens/marketer/PaymentMethodSetupScreen'));
const ProfileEditScreen = lazy(() => import('../screens/marketer/ProfileEditScreen'));
const ThemeSettingsScreen = lazy(() => import('../screens/marketer/ThemeSettingsScreen'));
const HelpSupportScreen = lazy(() => import('../screens/marketer/HelpSupportScreen'));
const AllActivitiesScreen = lazy(() => import('../screens/marketer/AllActivitiesScreen'));

const ScreenLoader = () => (
  <View style={styles.loader}>
    <ActivityIndicator size="large" color="#1CA700" />
  </View>
);

const Stack = createStackNavigator();

const RootNavigator: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuthAndOnboardingStatus();
  }, []);

  const checkAuthAndOnboardingStatus = async () => {
    try {
      const seen = await hasSeenOnboarding();
      setShowOnboarding(!seen);

      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          await getMarketerSession();
          setIsLoggedIn(true);
        } catch {
          await AsyncStorage.removeItem(TOKEN_KEY);
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
      }
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSplashFinish = () => setShowSplash(false);

  const handleOnboardingComplete = async () => {
    await setOnboardingCompleted();
    setShowOnboarding(false);
  };

  const handleLoginSuccess = () => setIsLoggedIn(true);

  const handleLogout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setIsLoggedIn(false);
  };

  if (isLoading || showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <NavigationContainer>
      <Suspense fallback={<ScreenLoader />}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {showOnboarding ? (
            <Stack.Screen name="Onboarding">
              {(props) => (
                <OnboardingScreen {...props} onComplete={handleOnboardingComplete} />
              )}
            </Stack.Screen>
          ) : !isLoggedIn ? (
            <>
              <Stack.Screen name="Login">
                {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
              </Stack.Screen>
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen name="SignupProfile" component={SignupProfileScreen} />
              <Stack.Screen name="SignupPassword">
                {(props) => (
                  <SignupPasswordScreen
                    {...props}
                    route={{
                      ...props.route,
                      params: { ...(props.route.params || {}), onLoginSuccess: handleLoginSuccess },
                    }}
                  />
                )}
              </Stack.Screen>
            </>
          ) : (
            <>
              <Stack.Screen name="MarketerTabs">
                {() => <MarketerTabNavigator onLogout={handleLogout} />}
              </Stack.Screen>
              <Stack.Screen name="BusinessDetails" component={BusinessDetailsScreen} />
              <Stack.Screen name="AddReferral" component={AddReferralScreen} />
              <Stack.Screen name="MarketerReferralDetails" component={MarketerReferralDetailsScreen} />
              <Stack.Screen name="CashoutRequest" component={CashoutRequestScreen} />
              <Stack.Screen name="PaymentMethodSetup" component={PaymentMethodSetupScreen} />
              <Stack.Screen name="Profile" component={ProfileEditScreen} />
              <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
              <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
              <Stack.Screen name="AllActivities" component={AllActivitiesScreen} />
            </>
          )}
        </Stack.Navigator>
      </Suspense>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});

export default RootNavigator;
