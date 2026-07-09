import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsDelivery } from '../../../hooks/useSettingsDelivery';

/**
 * POS delivery fee bands and checkout requirements.
 */
const SettingsDeliverySection = () => {
  const {
    canManageOrganization,
    loadingDeliverySettings,
    deliverySettings,
    deliverySettingsEditing,
    deliveryDraft,
    updateDeliverySettingsMutation,
    handleDeliveryDraftChange,
    handleDeliveryBandChange,
    handleAddDeliveryBand,
    handleRemoveDeliveryBand,
    handleSaveDeliverySettings,
    startDeliveryEdit,
    cancelDeliveryEdit,
  } = useSettingsDelivery();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to change delivery settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base md:text-lg">Delivery settings</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Delivery availability and fee bands for POS checkout.
            </CardDescription>
          </div>
          {!loadingDeliverySettings && !deliverySettingsEditing && (
            <Button
              type="button"
              variant="secondaryStroke"
              size="sm"
              className="shrink-0 self-start sm:self-auto"
              onClick={startDeliveryEdit}
            >
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loadingDeliverySettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-border p-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading delivery settings...
          </div>
        ) : deliverySettingsEditing ? (
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">Enable delivery</Label>
                <p className="text-xs text-muted-foreground">
                  Allow staff to add a delivery fee during POS checkout.
                </p>
              </div>
              <Switch
                checked={deliveryDraft.enabled}
                onCheckedChange={(checked) => handleDeliveryDraftChange(
                  checked
                    ? { enabled: true }
                    : { enabled: false, requireSelectionAtCheckout: false }
                )}
              />
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">Require selection at checkout</Label>
                <p className="text-xs text-muted-foreground">
                  Require staff to select a delivery band before completing a sale.
                </p>
              </div>
              <Switch
                checked={deliveryDraft.requireSelectionAtCheckout}
                onCheckedChange={(checked) => handleDeliveryDraftChange({ requireSelectionAtCheckout: checked })}
                disabled={!deliveryDraft.enabled}
              />
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <Label className="text-base">Delivery bands</Label>
                  <p className="text-xs text-muted-foreground">Set distance ranges and fees in GHS.</p>
                </div>
                <Button type="button" variant="secondaryStroke" size="sm" onClick={handleAddDeliveryBand}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add band
                </Button>
              </div>
              <div className="space-y-3">
                {(deliveryDraft.bands || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-3">
                    No delivery bands yet.
                  </p>
                ) : (
                  deliveryDraft.bands.map((band) => (
                    <div key={band.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border border-border p-3">
                      <div className="md:col-span-4">
                        <Label className="text-xs text-muted-foreground">Label</Label>
                        <Input value={band.label} onChange={(event) => handleDeliveryBandChange(band.id, 'label', event.target.value)} placeholder="Nearby" className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Min km</Label>
                        <Input type="number" min="0" step="0.01" value={band.minKm} onChange={(event) => handleDeliveryBandChange(band.id, 'minKm', event.target.value)} placeholder="0" className="mt-1" />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Max km</Label>
                        <Input type="number" min="0" step="0.01" value={band.maxKm} onChange={(event) => handleDeliveryBandChange(band.id, 'maxKm', event.target.value)} placeholder="5" className="mt-1" />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Fee (GHS)</Label>
                        <Input type="number" min="0" step="0.01" value={band.fee} onChange={(event) => handleDeliveryBandChange(band.id, 'fee', event.target.value)} placeholder="12.50" className="mt-1" />
                      </div>
                      <div className="md:col-span-1 flex md:items-end">
                        <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-red-600 hover:text-red-700" onClick={() => handleRemoveDeliveryBand(band.id)} aria-label="Remove delivery band">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelDeliveryEdit}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#166534] hover:bg-[#14532d]"
                loading={updateDeliverySettingsMutation.isPending || updateDeliverySettingsMutation.isLoading}
                onClick={handleSaveDeliverySettings}
              >
                Save delivery settings
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Enable delivery</Label>
                <p className="text-xs text-muted-foreground">Allow delivery fees during checkout.</p>
              </div>
              <span className="text-sm font-medium shrink-0">{deliverySettings.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label className="text-base">Require selection at checkout</Label>
                <p className="text-xs text-muted-foreground">Require staff to pick a delivery band before sale completion.</p>
              </div>
              <span className="text-sm font-medium shrink-0">{deliverySettings.requireSelectionAtCheckout ? 'Yes' : 'No'}</span>
            </div>
            <div className="rounded-lg border border-border p-3">
              <Label className="text-base">Delivery bands</Label>
              <div className="mt-3 space-y-2">
                {(deliverySettings.bands || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No delivery bands configured.</p>
                ) : (
                  deliverySettings.bands.map((band) => (
                    <div key={band.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{band.label}</p>
                        <p className="text-xs text-muted-foreground">{band.minKm} km - {band.maxKm} km</p>
                      </div>
                      <span className="text-sm font-semibold text-[#166534]">GHS {Number(band.fee || 0).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsDeliverySection;
