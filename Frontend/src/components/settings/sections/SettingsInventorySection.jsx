import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsInventory } from '../../../hooks/useSettingsInventory';

/**
 * Inventory settings — barcode/camera scanning and cost guidance.
 */
const SettingsInventorySection = () => {
  const {
    canManageOrganization,
    isLoading,
    scanningEnabled,
    updatePOSConfigMutation,
    handleScanningEnabledToggle,
  } = useSettingsInventory();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to view inventory settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Barcode &amp; camera scanning</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Control whether staff can use the device camera to scan product barcodes and QR codes at
            POS and when receiving stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading scanning settings…</p>
          ) : (
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">Enable barcode &amp; camera scanning</Label>
                <p className="text-xs text-muted-foreground">
                  When off, scan buttons and camera views are hidden. Staff can still type barcodes
                  manually where supported.
                </p>
              </div>
              <Switch
                checked={scanningEnabled}
                disabled={updatePOSConfigMutation.isPending}
                onCheckedChange={handleScanningEnabledToggle}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Inventory &amp; cost</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Product cost is counted as COGS when items sell — not as an operating expense.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            When you set a cost price on a product, ABS uses it for inventory value and cost of goods
            sold (COGS). Profit is calculated as sales − operating expenses − COGS.
          </p>
          <p>
            Use Expenses only for true operating costs (rent, salaries, utilities, marketing, and
            similar). Do not record inventory purchases as expenses — that would double-count cost
            against profit.
          </p>
          <p>
            If you previously had auto-created inventory expenses from product cost, those historical
            entries are left unchanged. You can archive or adjust them in Expenses if needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsInventorySection;
