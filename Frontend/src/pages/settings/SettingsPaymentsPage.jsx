import SettingsLayout from './SettingsLayout';
import SettingsPaymentsSection from '../../components/settings/sections/SettingsPaymentsSection';

const SettingsPaymentsPage = () => (
  <SettingsLayout
    title="Payments"
    description="Paystack settlements, MTN MoMo collection, charge history, and payout destination."
  >
    <SettingsPaymentsSection />
  </SettingsLayout>
);

export default SettingsPaymentsPage;
