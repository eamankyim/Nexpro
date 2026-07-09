import SettingsLayout from './SettingsLayout';
import SettingsTrackingSection from '../../components/settings/sections/SettingsTrackingSection';

const SettingsTrackingPage = () => (
  <SettingsLayout
    title="Customer tracking"
    description="Public tracking page toggles, shareable customer link, and email or SMS notifications when jobs are created."
  >
    <SettingsTrackingSection />
  </SettingsLayout>
);

export default SettingsTrackingPage;
