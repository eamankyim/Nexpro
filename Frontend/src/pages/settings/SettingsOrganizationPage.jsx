import SettingsLayout from './SettingsLayout';
import SettingsOrganizationSection from '../../components/settings/sections/SettingsOrganizationSection';

const SettingsOrganizationPage = () => (
  <SettingsLayout
    title="Organization"
    description="Business profile, branding, tax, and document defaults."
  >
    <SettingsOrganizationSection />
  </SettingsLayout>
);

export default SettingsOrganizationPage;
