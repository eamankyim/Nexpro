import {
  buildStoreColorCssVars,
  getTemplateTheme,
  normalizeTemplateId,
  resolveStoreBrandColors,
} from './registry';

/**
 * Applies template theme CSS variables and shell class around storefront content.
 * Colors customize the chosen template's tokens (not a separate theme).
 *
 * @param {{
 *   templateId?: string,
 *   primaryColor?: string|null,
 *   secondaryColor?: string|null,
 *   tertiaryColor?: string|null,
 *   colors?: Record<string, string|null|undefined>,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function TemplateThemeProvider({
  templateId,
  primaryColor,
  secondaryColor,
  tertiaryColor,
  colors,
  children,
}) {
  const theme = getTemplateTheme(templateId);
  const colorSource = colors || {
    primaryColor,
    secondaryColor,
    tertiaryColor,
    primary: primaryColor,
    secondary: secondaryColor,
    tertiary: tertiaryColor,
  };
  const resolved = resolveStoreBrandColors(templateId, colorSource);
  const cssVars = buildStoreColorCssVars(templateId, resolved);

  return (
    <div
      className={theme.shellClass}
      data-store-template={normalizeTemplateId(templateId)}
      style={cssVars}
    >
      {children}
    </div>
  );
}

export { getTemplateTheme, resolveStoreBrandColors, buildStoreColorCssVars };
