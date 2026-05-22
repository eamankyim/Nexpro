import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type TrendDirection = 'up' | 'down' | 'flat';

type MiniSparklineProps = {
  color: string;
  trend?: TrendDirection;
  width?: number;
  height?: number;
};

/**
 * Lightweight sparkline for dashboard metric cards.
 * Uses deterministic points from trend direction (no time-series API required).
 */
export function MiniSparkline({
  color,
  trend = 'flat',
  width = 120,
  height = 28,
}: MiniSparklineProps) {
  const path = useMemo(() => buildSparklinePath(trend, width, height), [trend, width, height]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function buildSparklinePath(trend: TrendDirection, width: number, height: number): string {
  const padY = 4;
  const innerH = height - padY * 2;
  const steps = 7;
  const ratios =
    trend === 'up'
      ? [0.72, 0.68, 0.62, 0.58, 0.48, 0.38, 0.28, 0.18]
      : trend === 'down'
        ? [0.2, 0.28, 0.34, 0.42, 0.52, 0.6, 0.68, 0.78]
        : [0.5, 0.48, 0.52, 0.5, 0.49, 0.51, 0.5, 0.5];

  const points = ratios.slice(0, steps + 1).map((ratio, index) => {
    const x = (index / steps) * width;
    const y = padY + ratio * innerH;
    return { x, y };
  });

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
