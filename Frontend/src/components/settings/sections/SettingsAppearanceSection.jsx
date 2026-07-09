import { Lightbulb, Moon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import SidebarMenusSettings from '../SidebarMenusSettings';
import { useSettingsAppearance } from '../../../hooks/useSettingsAppearance';

/**
 * Appearance settings section (dark mode, hints, sidebar menus).
 */
const SettingsAppearanceSection = () => {
  const { theme, setTheme, hintMode, setHintMode } = useSettingsAppearance();

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base md:text-2xl">Appearance</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Customize how the app looks on your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          <div className="flex items-center justify-between py-1 md:py-0">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-sm md:text-base">Dark mode</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Use dark theme for a more comfortable view in low light.
                </p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>

          <div className="flex items-center justify-between py-1 md:py-0">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-sm md:text-base">Hint Mode</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Show hints when hovering over buttons, icons, and stats.
                </p>
              </div>
            </div>
            <Switch checked={hintMode} onCheckedChange={setHintMode} />
          </div>
        </CardContent>
      </Card>

      <SidebarMenusSettings />
    </div>
  );
};

export default SettingsAppearanceSection;
