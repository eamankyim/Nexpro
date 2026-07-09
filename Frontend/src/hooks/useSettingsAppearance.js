import { useTheme } from '../context/ThemeContext';
import { useHintMode } from '../context/HintModeContext';

/**
 * Appearance settings state (extracted from Settings.jsx).
 * @returns {Object}
 */
export const useSettingsAppearance = () => {
  const { theme, setTheme } = useTheme();
  const { hintMode, setHintMode } = useHintMode();

  return {
    theme,
    setTheme,
    hintMode,
    setHintMode,
  };
};
