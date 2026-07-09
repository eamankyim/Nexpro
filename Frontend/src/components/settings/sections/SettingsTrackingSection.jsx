import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsTracking } from '../../../hooks/useSettingsTracking';

/**
 * Public customer tracking page toggles and share URL.
 */
const SettingsTrackingSection = () => {
  const {
    canManageOrganization,
    isStudioLike,
    loadingJobInvoice,
    jobInvoiceData,
    publicTrackingUrl,
    updateJobInvoiceMutation,
    handleCopyTrackingUrl,
    handleCustomerTrackingToggle,
    handleEmailTrackingOnJobCreation,
  } = useSettingsTracking();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to change tracking settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base md:text-lg">
          {isStudioLike ? 'Jobs & customer tracking' : 'Customer tracking (public)'}
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {isStudioLike
            ? 'Control the public page where customers check status with ID and phone (no login).'
            : 'Share one link with customers: they enter order ID and phone to see status — no login.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingJobInvoice ? (
          <p className="text-sm text-muted-foreground">Loading tracking settings…</p>
        ) : (
          <>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">
                  {isStudioLike ? 'Customer job tracking page' : 'Customer order tracking page'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isStudioLike
                    ? 'Allow customers to use a secure public page (no login): job number + phone, or links from messages.'
                    : 'Allow customers to use a secure public page (no login) with order number + phone.'}
                </p>
              </div>
              <Switch
                checked={jobInvoiceData?.customerJobTrackingEnabled === true}
                disabled={updateJobInvoiceMutation.isPending}
                onCheckedChange={handleCustomerTrackingToggle}
              />
            </div>

            {jobInvoiceData?.customerJobTrackingEnabled === true && publicTrackingUrl ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Share with customers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Send this link by SMS, WhatsApp, or email. Customers open it, then enter their{' '}
                  {isStudioLike ? 'job number' : 'order number'} and phone — no account required.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input value={publicTrackingUrl} readOnly className="font-mono text-xs sm:text-sm" />
                  <Button
                    type="button"
                    variant="secondaryStroke"
                    className="shrink-0"
                    onClick={handleCopyTrackingUrl}
                  >
                    Copy link
                  </Button>
                </div>
              </div>
            ) : jobInvoiceData?.customerJobTrackingEnabled === true && !publicTrackingUrl ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-border bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
                Public tracking is on, but your workspace slug is missing. Save organization settings or contact support so the share link can be generated.
              </p>
            ) : null}

            {isStudioLike ? (
              <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base">Email customer tracking link when a job is created</Label>
                  <p className="text-xs text-muted-foreground">
                    Sends an email to the customer with a view &amp; track button. Requires a customer email and workspace email configured under Email settings.
                  </p>
                </div>
                <Switch
                  checked={jobInvoiceData?.emailCustomerJobTrackingOnJobCreation === true}
                  disabled={
                    updateJobInvoiceMutation.isPending
                    || jobInvoiceData?.customerJobTrackingEnabled !== true
                  }
                  onCheckedChange={handleEmailTrackingOnJobCreation}
                />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsTrackingSection;
