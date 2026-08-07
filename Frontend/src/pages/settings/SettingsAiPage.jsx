import SettingsLayout from './SettingsLayout';
import SettingsAiSection from '../../components/settings/sections/SettingsAiSection';

const SettingsAiPage = () => (
  <SettingsLayout
    title="iBIS / AI"
    description="Workspace Anthropic API key for Ask iBIS, reports, and automations."
  >
    <SettingsAiSection />
  </SettingsLayout>
);

export default SettingsAiPage;
