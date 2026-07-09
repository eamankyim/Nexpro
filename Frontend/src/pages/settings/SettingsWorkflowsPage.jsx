import SettingsLayout from './SettingsLayout';
import SettingsWorkflowsSection from '../../components/settings/sections/SettingsWorkflowsSection';

const SettingsWorkflowsPage = () => (
  <SettingsLayout
    title="Workflows"
    description="Quote acceptance and automatic invoice sending when jobs are created."
  >
    <SettingsWorkflowsSection />
  </SettingsLayout>
);

export default SettingsWorkflowsPage;
