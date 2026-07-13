import SettingsLayout from './SettingsLayout';
import SettingsInventorySection from '../../components/settings/sections/SettingsInventorySection';

const SettingsInventoryPage = () => (
  <SettingsLayout
    title="Inventory"
    description="How product cost relates to COGS and profit — operating expenses stay separate."
  >
    <SettingsInventorySection />
  </SettingsLayout>
);

export default SettingsInventoryPage;
