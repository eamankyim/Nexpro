import SettingsLayout from './SettingsLayout';
import SettingsInventorySection from '../../components/settings/sections/SettingsInventorySection';

const SettingsInventoryPage = () => (
  <SettingsLayout
    title="Inventory"
    description="Automatically create expenses from product cost when products are added."
  >
    <SettingsInventorySection />
  </SettingsLayout>
);

export default SettingsInventoryPage;
