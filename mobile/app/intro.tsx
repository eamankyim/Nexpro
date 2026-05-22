import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  Pressable,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { AppIcon } from '@/components/AppIcon';
import { SPLASH_INTRO_SLIDES, type SplashIntroSlide } from '@/config/splashIntro';
import { markIntroOnboardingComplete } from '@/utils/introOnboarding';

import { BRAND_GREEN } from '@/constants/brand';

export default function IntroScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef<FlatList<SplashIntroSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastSlide = activeIndex === SPLASH_INTRO_SLIDES.length - 1;

  const finishIntro = useCallback(async () => {
    await markIntroOnboardingComplete();
    if (user) {
      router.replace('/');
    } else {
      router.replace('/login');
    }
  }, [user]);

  const handleSkip = useCallback(() => {
    finishIntro();
  }, [finishIntro]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      finishIntro();
      return;
    }
    const nextIndex = activeIndex + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  }, [activeIndex, isLastSlide, finishIntro]);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      setActiveIndex(index);
    },
    [width]
  );

  const renderSlide = useCallback(
    ({ item }: { item: SplashIntroSlide }) => (
      <View style={[styles.slide, { width }]}>
        <ImageBackground
          source={item.image}
          style={styles.backgroundImage}
          resizeMode="cover"
          accessibilityLabel={item.title}
        >
          <View style={styles.scrim} />
          <View style={styles.copyWrap}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        </ImageBackground>
      </View>
    ),
    [width]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={styles.carousel}
        data={SPLASH_INTRO_SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScrollToIndexFailed={({ index }) => {
          listRef.current?.scrollToOffset({ offset: width * index, animated: true });
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.dots}>
          {SPLASH_INTRO_SLIDES.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, index === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? 'Get started' : 'Next slide'}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <AppIcon name={isLastSlide ? 'check' : 'chevron-right'} size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  carousel: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  skipText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  slide: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  copyWrap: {
    paddingHorizontal: 24,
    paddingBottom: 128,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: BRAND_GREEN,
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  primaryButton: {
    width: 56,
    height: 56,
    backgroundColor: BRAND_GREEN,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
