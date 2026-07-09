import SettingsLayout from './SettingsLayout';
import SettingsInvoicesReceiptsSection from '../../components/settings/sections/SettingsInvoicesReceiptsSection';

const SettingsInvoicesReceiptsPage = () => (
  <SettingsLayout
    title="Invoices & receipts"
    description="Auto-send preferences, quote and job invoice workflow, POS receipt behavior, print format, and invoice preview."
  >
    <SettingsInvoicesReceiptsSection />
  </SettingsLayout>
);

export default SettingsInvoicesReceiptsPage;
