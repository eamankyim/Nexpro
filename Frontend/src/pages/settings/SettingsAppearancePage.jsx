import SettingsLayout from './SettingsLayout';
import SettingsAppearanceSection from '../../components/settings/sections/SettingsAppearanceSection';

const SettingsAppearancePage = () => (
  <SettingsLayout
    title="Appearance"
    description="Dark mode, hints, and sidebar menu visibility."
  >
    <SettingsAppearanceSection />
  </SettingsLayout>
);

export default SettingsAppearancePage;
