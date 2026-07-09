import SettingsLayout from './SettingsLayout';
import SettingsProfileSection from '../../components/settings/sections/SettingsProfileSection';

const SettingsProfilePage = () => (
  <SettingsLayout
    title="Profile"
    description="Personal information, password, and profile photo."
  >
    <SettingsProfileSection />
  </SettingsLayout>
);

export default SettingsProfilePage;
