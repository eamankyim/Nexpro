import SettingsLayout from './SettingsLayout';
import SettingsSabitoPartnersSection from '../../components/settings/sections/SettingsSabitoPartnersSection';

const SettingsSabitoPartnersPage = () => (
  <SettingsLayout
    title="Sabito Partners"
    description="Enable the Partner Program, set commissions, approve marketers, and mark monthly payouts."
  >
    <SettingsSabitoPartnersSection />
  </SettingsLayout>
);

export default SettingsSabitoPartnersPage;
