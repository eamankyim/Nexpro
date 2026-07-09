import SettingsLayout from './SettingsLayout';
import SettingsEmailSection from '../../components/settings/sections/SettingsEmailSection';

const SettingsEmailPage = () => (
  <SettingsLayout
    title="Email"
    description="Platform vs own provider, SMTP, SendGrid, SES, and test connection."
  >
    <SettingsEmailSection />
  </SettingsLayout>
);

export default SettingsEmailPage;
