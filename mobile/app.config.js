export default {
  expo: {
    name: 'ABS Go',
    slug: 'abs',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'abs',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#166534',
    },
    ios: {
      bundleIdentifier: 'com.absghana.app',
      buildNumber: '1',
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'ABS Go (African Business Suite) uses the camera to scan products and attach business images when you choose to use those features.',
        NSPhotoLibraryUsageDescription: 'ABS Ghana (African Business Suite) uses your photo library to upload logos, profile photos, receipts, and other business images you choose.',
      },
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.absghana.app',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router', 'expo-secure-store', 'expo-audio', 'expo-camera'],
    experiments: { typedRoutes: true },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001',
      eas: {
        projectId: '8dff9445-6979-427f-b84e-aae48f077d82',
      },
    },
  },
};
