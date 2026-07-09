import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsWorkflows } from '../../../hooks/useSettingsWorkflows';

/**
 * Quote accept workflow and auto-send invoice on job creation.
 */
const SettingsWorkflowsSection = () => {
  const {
    canManageOrganization,
    isStudioLike,
    quoteWorkflowEnabled,
    jobInvoiceData,
    updateQuoteWorkflowMutation,
    updateJobInvoiceMutation,
    handleQuoteWorkflowChange,
    handleAutoSendInvoiceOnJobCreation,
  } = useSettingsWorkflows();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to change workflow settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Quote workflow</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            When a customer accepts a quote via the view-quote link, choose what happens next.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5 pr-4">
              <Label className="text-base">
                {isStudioLike
                  ? 'Auto-create job and invoice when customer accepts'
                  : 'Auto-create sales invoice when customer accepts'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {isStudioLike
                  ? 'If on: accepting the quote creates a job and invoice, and the invoice is sent to the customer automatically. If off: only the acceptance is recorded.'
                  : 'If on: accepting the quote creates a sales invoice and sends it to the customer automatically. If off: only the acceptance is recorded.'}
              </p>
            </div>
            <Switch
              checked={quoteWorkflowEnabled}
              disabled={updateQuoteWorkflowMutation.isPending}
              onCheckedChange={handleQuoteWorkflowChange}
            />
          </div>
        </CardContent>
      </Card>

      {isStudioLike ? (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Job invoices</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Control automatic invoice sending when jobs are created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5 pr-4">
                <Label className="text-base">Auto-send invoice when a job is created</Label>
                <p className="text-xs text-muted-foreground">
                  After an invoice is auto-generated for a new job, mark it sent and notify the customer (email, WhatsApp, SMS) when channels are configured.
                </p>
              </div>
              <Switch
                checked={jobInvoiceData?.autoSendInvoiceOnJobCreation === true}
                disabled={updateJobInvoiceMutation.isPending}
                onCheckedChange={handleAutoSendInvoiceOnJobCreation}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default SettingsWorkflowsSection;
