import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

const logoSource = require('@/assets/images/abs-logo-icon.png');

const PRIMARY = '#166534';

type AppBrandLogoProps = {
  size?: number;
  /** Product name beside the icon (e.g. ABS). Omit to show icon only. */
  appName?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  nameStyle?: StyleProp<TextStyle>;
};

/**
 * ABS product logo for auth screens — icon with optional name.
 */
export function AppBrandLogo({
  size = 44,
  appName,
  style,
  imageStyle,
  nameStyle,
}: AppBrandLogoProps) {
  return (
    <View style={[styles.row, style]}>
      <Image
        source={logoSource}
        style={[{ width: size, height: size }, imageStyle]}
        resizeMode="contain"
        accessibilityLabel={appName || 'ABS'}
      />
      {appName ? (
        <Text style={[styles.name, { fontSize: size * 0.55 }, nameStyle]}>{appName}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    alignSelf: 'center',
  },
  name: {
    fontWeight: '700',
    color: PRIMARY,
  },
});
