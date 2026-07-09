import SettingsLayout from './SettingsLayout';
import SettingsBillingSection from '../../components/settings/sections/SettingsBillingSection';

const SettingsBillingPage = () => (
  <SettingsLayout
    title="Billing & plan"
    description="ABS subscription plan, seats, trial status, and payment history."
  >
    <SettingsBillingSection />
  </SettingsLayout>
);

export default SettingsBillingPage;
