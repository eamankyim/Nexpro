import SettingsLayout from './SettingsLayout';
import SettingsDeliveryRulesSection from '../../components/settings/sections/SettingsDeliveryRulesSection';

const SettingsDeliveryRulesPage = () => (
  <SettingsLayout
    title="Delivery rules"
    description="Choose which channels send each system message."
  >
    <SettingsDeliveryRulesSection />
  </SettingsLayout>
);

export default SettingsDeliveryRulesPage;
