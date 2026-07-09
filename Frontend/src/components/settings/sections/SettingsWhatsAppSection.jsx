import {
  ExternalLink,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettingsWhatsApp } from '../../../hooks/useSettingsWhatsApp';

/**
 * WhatsApp Business API configuration section.
 */
const SettingsWhatsAppSection = () => {
  const {
    canManageOrganization,
    whatsappForm,
    whatsappData,
    loadingWhatsApp,
    onWhatsAppSubmit,
    handleTestWhatsApp,
    handleWhatsAppEnabledChange,
    updateWhatsAppMutation,
    testWhatsAppMutation,
    whatsappTemplateLearnMoreOpen,
    setWhatsappTemplateLearnMoreOpen,
    resetWhatsAppForm,
  } = useSettingsWhatsApp();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to configure WhatsApp settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base md:text-2xl">WhatsApp Business API Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingWhatsApp ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Alert className="mb-3 md:mb-6 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">WhatsApp Integration</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Configure WhatsApp Business API to send automated notifications to customers. You&apos;ll need to set up a WhatsApp Business Account in Meta Business Manager first.
              </AlertDescription>
            </Alert>

            <Form {...whatsappForm}>
              <form onSubmit={whatsappForm.handleSubmit(onWhatsAppSubmit)} className="space-y-3 md:space-y-4">
                <FormField
                  control={whatsappForm.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-2 md:p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable WhatsApp</FormLabel>
                        <FormDescription>
                          Enable WhatsApp Business API integration. When turned on, a connection test runs to verify your settings.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => handleWhatsAppEnabledChange(checked, field.onChange)}
                          disabled={testWhatsAppMutation.isPending}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={whatsappForm.control}
                    name="phoneNumberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm md:text-base">
                          Phone Number ID
                          <span className="text-xs text-muted-foreground ml-1 md:ml-2">
                            (Your WhatsApp Business Phone Number ID from Meta Business Manager)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={whatsappForm.control}
                    name="businessAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Business Account ID
                          <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 123456789012345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={whatsappForm.control}
                  name="accessToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Access Token
                        <span className="text-xs text-muted-foreground ml-2">
                          (Your WhatsApp Business API Access Token - keep this secure)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter access token" {...field} />
                      </FormControl>
                      {whatsappData?.data?.accessTokenConfigured && !field.value?.trim() && (
                        <FormDescription>
                          A token is already stored in the database. Leave blank to keep using it.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <FormField
                    control={whatsappForm.control}
                    name="webhookVerifyToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Webhook Verify Token
                          <span className="text-xs text-muted-foreground ml-2">
                            (Set this in Meta Business Manager)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Your verify token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={whatsappForm.control}
                    name="templateNamespace"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Template Namespace
                          <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-2 justify-end mt-3 md:mt-0">
                  <Button type="button" variant="outline" size="sm" onClick={resetWhatsAppForm}>
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestWhatsApp}
                    loading={testWhatsAppMutation.isPending}
                  >
                    Test Connection
                  </Button>
                  <Button type="submit" size="sm" loading={updateWhatsAppMutation.isPending}>
                    Save Settings
                  </Button>
                </div>
              </form>
            </Form>

            <Separator className="my-3 md:my-6">
              <span className="text-sm font-medium">Message Templates</span>
            </Separator>
            <Alert variant="destructive" className="mt-2 md:mt-4 py-2 px-3 md:py-4 md:px-4">
              <AlertTitle className="text-sm md:text-base">Template Setup Required</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    You need to create and approve the following message templates in Meta Business Manager before they can be used: invoice_notification, quote_delivery, order_confirmation, payment_reminder, low_stock_alert
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setWhatsappTemplateLearnMoreOpen(true)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Learn More
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            <Dialog open={whatsappTemplateLearnMoreOpen} onOpenChange={setWhatsappTemplateLearnMoreOpen}>
              <DialogContent className="sm:max-w-[32rem] sm:max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    How to Set Up WhatsApp Templates
                  </DialogTitle>
                </DialogHeader>
                <DialogBody className="overflow-y-auto space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Create these templates in Meta Business Manager so your shop can send customers bills, receipts, quotes, and stock alerts via WhatsApp. Template approval usually takes 24–48 hours.
                  </p>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Where to go</p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Meta for Developers</a></li>
                      <li>Open your WhatsApp app or create one</li>
                      <li>Go to WhatsApp → Message Templates</li>
                      <li>Create each template below (use exact names)</li>
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Template names</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li><strong>invoice_notification</strong> – Bill/receipt with Mobile Money link</li>
                      <li><strong>quote_delivery</strong> – Quote/proposal</li>
                      <li><strong>order_confirmation</strong> – Order confirmation for shop</li>
                      <li><strong>payment_reminder</strong> – Reminder for overdue bills</li>
                      <li><strong>low_stock_alert</strong> – Stock running low alert</li>
                    </ul>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use Category: <strong>UTILITY</strong> and Language: <strong>English</strong> for all templates.
                  </p>
                  <div className="rounded-lg border border-gray-200 bg-muted/50 p-3">
                    <a
                      href="https://www.facebook.com/business/help"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Meta Business Help Centre
                    </a>
                  </div>
                </DialogBody>
                <DialogFooter>
                  <Button onClick={() => setWhatsappTemplateLearnMoreOpen(false)}>
                    Got it
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SettingsWhatsAppSection;
