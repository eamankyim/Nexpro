import SettingsLayout from './SettingsLayout';
import SettingsWhatsAppSection from '../../components/settings/sections/SettingsWhatsAppSection';

const SettingsWhatsAppPage = () => (
  <SettingsLayout
    title="WhatsApp"
    description="WhatsApp Business API connection, test connection, and message templates."
  >
    <SettingsWhatsAppSection />
  </SettingsLayout>
);

export default SettingsWhatsAppPage;
