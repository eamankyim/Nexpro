import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsInventory } from '../../../hooks/useSettingsInventory';

/**
 * Inventory cost automation settings.
 */
const SettingsInventorySection = () => {
  const {
    canManageOrganization,
    loadingJobInvoice,
    jobInvoiceData,
    updateJobInvoiceMutation,
    handleAutoCreateExpenseChange,
  } = useSettingsInventory();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to change inventory settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Inventory &amp; cost automation</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Automatically log product cost as an expense when new products are added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingJobInvoice ? (
          <p className="text-sm text-muted-foreground">Loading inventory settings…</p>
        ) : (
          <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5 pr-4">
              <Label className="text-base">Auto-create expense from product cost</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, creating a product with cost price creates a paid and approved expense entry automatically.
              </p>
            </div>
            <Switch
              checked={jobInvoiceData?.autoCreateExpenseFromProductCost === true}
              disabled={updateJobInvoiceMutation.isPending}
              onCheckedChange={handleAutoCreateExpenseChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsInventorySection;
