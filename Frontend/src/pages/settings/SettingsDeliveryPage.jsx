import SettingsLayout from './SettingsLayout';
import SettingsDeliverySection from '../../components/settings/sections/SettingsDeliverySection';

const SettingsDeliveryPage = () => (
  <SettingsLayout
    title="Delivery fees"
    description="Enable delivery at checkout and configure distance-based fee bands."
  >
    <SettingsDeliverySection />
  </SettingsLayout>
);

export default SettingsDeliveryPage;
