import SettingsLayout from './SettingsLayout';
import SettingsSmsSection from '../../components/settings/sections/SettingsSmsSection';

const SettingsSmsPage = () => (
  <SettingsLayout
    title="SMS"
    description="Platform usage, provider connection, and customer message templates."
  >
    <SettingsSmsSection />
  </SettingsLayout>
);

export default SettingsSmsPage;
