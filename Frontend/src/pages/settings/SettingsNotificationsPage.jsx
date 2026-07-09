import SettingsLayout from './SettingsLayout';
import SettingsNotificationsSection from '../../components/settings/sections/SettingsNotificationsSection';

const SettingsNotificationsPage = () => (
  <SettingsLayout
    title="Notifications"
    description="In-app bell and email notification preferences for your account."
  >
    <SettingsNotificationsSection />
  </SettingsLayout>
);

export default SettingsNotificationsPage;
