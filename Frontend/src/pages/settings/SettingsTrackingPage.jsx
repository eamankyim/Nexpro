import SettingsLayout from './SettingsLayout';
import SettingsTrackingSection from '../../components/settings/sections/SettingsTrackingSection';

const SettingsTrackingPage = () => (
  <SettingsLayout
    title="Customer tracking"
    description="Public tracking page toggles and shareable customer link."
  >
    <SettingsTrackingSection />
  </SettingsLayout>
);

export default SettingsTrackingPage;
