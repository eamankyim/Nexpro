import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const COLORS = ['#166534', '#22c55e', '#fbbf24', '#f59e0b', '#ffffff', '#d1d5db'];
const NUM_PIECES = 48;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Lightweight confetti burst for success moments. Runs once when mounted.
 */
export function ConfettiBurst() {
  const masterAnim = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(
    () =>
      Array.from({ length: NUM_PIECES }, (_, i) => ({
        id: i,
        left: (Math.random() * (SCREEN_WIDTH + 60)) - 30,
        start: Math.random() * 0.4,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.floor(Math.random() * 6),
        rotation: Math.random() * 360,
        drift: (Math.random() - 0.5) * 80,
      })),
    []
  );

  useEffect(() => {
    Animated.timing(masterAnim, {
      toValue: 1,
      duration: 4500,
      useNativeDriver: true,
    }).start();
  }, [masterAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.piece,
            {
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              transform: [
                {
                  translateY: masterAnim.interpolate({
                    inputRange: [p.start, 1],
                    outputRange: [0, 700],
                  }),
                },
                {
                  rotate: masterAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${p.rotation + 720}deg`],
                  }),
                },
                {
                  translateX: masterAnim.interpolate({
                    inputRange: [p.start, 1],
                    outputRange: [0, p.drift],
                  }),
                },
              ],
              opacity: masterAnim.interpolate({
                inputRange: [p.start, Math.min(p.start + 0.5, 1), 1],
                outputRange: [1, 0.8, 0],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: -20,
  },
});
