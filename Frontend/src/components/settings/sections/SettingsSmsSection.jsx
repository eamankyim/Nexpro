import dayjs from 'dayjs';
import { useResponsive } from '../../../hooks/useResponsive';
import {
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useSettingsSms } from '../../../hooks/useSettingsSms';
import SettingsDeliveryRulesTable from '../SettingsDeliveryRulesTable';

/**
 * SMS settings section with Overview / Provider / Templates sub-tabs.
 */
const SettingsSmsSection = () => {
  const {
    canManageOrganization,
    smsForm,
    loadingSMS,
    smsSubTab,
    setSmsSection,
    selectedSmsTemplateKey,
    setSelectedSmsTemplateKey,
    smsTemplateDraft,
    setSmsTemplateDraft,
    smsTemplatesList,
    selectedSmsTemplate,
    loadingSmsTemplates,
    smsTemplatePreviewText,
    smsTemplateCharCount,
    smsTemplateSegmentCount,
    insertSmsTemplateVariable,
    handleSaveSmsTemplate,
    handleResetSmsTemplate,
    updateSmsTemplateMutation,
    resetSmsTemplateMutation,
    onSMSSubmit,
    handleTestSMS,
    handleSMSEnabledChange,
    updateSMSMutation,
    testSMSMutation,
    smsPlatformInfo,
    platformSmsActive,
    ownSmsActive,
    switchingToOwnSms,
    showPlatformSmsUsage,
    noSmsAvailable,
    smsUsagePercent,
    smsData,
  } = useSettingsSms();
  const { isMobile } = useResponsive();

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You need admin or manager permissions to configure SMS settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base md:text-2xl flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
          SMS
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Platform usage, your own provider connection, and editable customer SMS templates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={smsSubTab} onValueChange={setSmsSection}>
          {isMobile ? (
            <Select value={smsSubTab} onValueChange={setSmsSection}>
              <SelectTrigger className="w-full mb-3">
                <SelectValue placeholder="SMS section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Overview</SelectItem>
                <SelectItem value="provider">Provider</SelectItem>
                <SelectItem value="templates">Templates</SelectItem>
                <SelectItem value="delivery-rules">Delivery rules</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="grid grid-cols-4 w-full mb-3 md:mb-4">
              <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="provider" className="text-xs md:text-sm">Provider</TabsTrigger>
              <TabsTrigger value="templates" className="text-xs md:text-sm">Templates</TabsTrigger>
              <TabsTrigger value="delivery-rules" className="text-xs md:text-sm">Delivery rules</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="overview" className="mt-0 space-y-3 md:space-y-4">
            {loadingSMS ? (
              <div className="flex items-center justify-center py-6 md:py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                <Alert className="py-2 px-3 md:py-4 md:px-4">
                  <AlertTitle className="text-sm md:text-base">How SMS works</AlertTitle>
                  <AlertDescription className="text-xs md:text-sm space-y-2">
                    <p>
                      <span className="font-medium text-foreground">Default:</span>{' '}
                      Customer SMS uses ABS platform SMS—no setup required. Messages include your shop name and count toward a{' '}
                      {smsPlatformInfo?.monthlyLimit ?? 100}/month limit.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Optional:</span>{' '}
                      Connect your own provider under the Provider tab to use your sender ID and remove the platform limit.
                    </p>
                  </AlertDescription>
                </Alert>

                <div className="rounded-lg border border-gray-200 p-3 md:p-4 space-y-2">
                  <p className="text-sm font-medium">Current mode</p>
                  {platformSmsActive && <Badge variant="secondary">ABS platform SMS (default)</Badge>}
                  {ownSmsActive && <Badge variant="secondary">Your own SMS provider</Badge>}
                  {noSmsAvailable && <Badge variant="outline">No SMS configured</Badge>}
                  {switchingToOwnSms && (
                    <p className="text-xs text-muted-foreground">
                      You are switching to your own provider—save Provider settings after a successful connection test.
                    </p>
                  )}
                </div>

                {showPlatformSmsUsage && (
                  <div className="rounded-lg border border-[#166534]/25 bg-[#166534]/5 p-3 md:p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm md:text-base font-medium text-[#166534]">Platform usage</p>
                        <p className="text-xs md:text-sm text-foreground">
                          {smsPlatformInfo.sentThisMonth ?? 0} / {smsPlatformInfo.monthlyLimit} messages this month
                          {' · '}
                          {smsPlatformInfo.remaining} remaining
                          {smsPlatformInfo.senderId ? ` · sender ${smsPlatformInfo.senderId}` : ''}
                        </p>
                        {smsPlatformInfo.resetsAt && (
                          <p className="text-xs text-muted-foreground">
                            Resets {dayjs(smsPlatformInfo.resetsAt).format('MMM D, YYYY')}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {smsPlatformInfo.remaining} left
                      </Badge>
                    </div>
                    <Progress value={smsUsagePercent} className="h-2" />
                  </div>
                )}

                <Alert className="border-gray-200">
                  <Send className="h-4 w-4" />
                  <AlertTitle className="text-sm">Delivery rules</AlertTitle>
                  <AlertDescription className="text-xs md:text-sm space-y-2">
                    <p>
                      Choose which events may send SMS in the Delivery rules tab.
                      Templates only control message wording—not whether SMS is sent.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSmsSection('delivery-rules')}
                    >
                      Go to Delivery Rules
                    </Button>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>

          <TabsContent value="provider" className="mt-0 space-y-3 md:space-y-4">
            {loadingSMS ? (
              <div className="flex items-center justify-center py-6 md:py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {ownSmsActive && (
                  <Alert className="border-gray-200 py-2 px-3 md:py-4 md:px-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="text-sm md:text-base">Using your own SMS provider</AlertTitle>
                    <AlertDescription className="text-xs md:text-sm">
                      Customer SMS is sent through your configured provider. Platform SMS limits no longer apply.
                    </AlertDescription>
                  </Alert>
                )}
                {switchingToOwnSms && (
                  <Alert className="border-gray-200 py-2 px-3 md:py-4 md:px-4">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="text-sm md:text-base">Switching to your own provider</AlertTitle>
                    <AlertDescription className="text-xs md:text-sm">
                      Save after the connection test succeeds to start using your provider.
                    </AlertDescription>
                  </Alert>
                )}
                {noSmsAvailable && (
                  <Alert className="py-2 px-3 md:py-4 md:px-4">
                    <AlertTitle className="text-sm md:text-base">No SMS available</AlertTitle>
                    <AlertDescription className="text-xs md:text-sm text-muted-foreground">
                      Platform SMS is not enabled. Connect your own provider below or contact ABS support.
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs md:text-sm font-medium text-foreground">Your own SMS provider (optional)</p>

                <Form {...smsForm}>
                  <form onSubmit={smsForm.handleSubmit(onSMSSubmit)} className="space-y-3 md:space-y-4">
                    <FormField
                      control={smsForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-200 p-2 md:p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Use my own SMS provider</FormLabel>
                            <FormDescription>
                              Connect Termii, Arkesel, Twilio, or Africa&apos;s Talking. A connection test runs when you turn this on.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => handleSMSEnabledChange(checked, field.onChange)}
                              disabled={testSMSMutation.isPending}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={smsForm.control}
                      name="provider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMS Provider</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="termii">Termii</SelectItem>
                                <SelectItem value="arkesel">Arkesel</SelectItem>
                                <SelectItem value="twilio">Twilio</SelectItem>
                                <SelectItem value="africas_talking">Africa&apos;s Talking</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {(smsForm.watch('provider') === 'termii' || smsForm.watch('provider') === 'arkesel') && (
                      <>
                        <FormField
                          control={smsForm.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                API Key
                                <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                              </FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Your SMS API key" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={smsForm.control}
                          name="senderId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Sender ID
                                <span className="text-xs text-muted-foreground ml-2">(Required, 3-11 characters)</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. MyShop" maxLength={11} {...field} />
                              </FormControl>
                              <FormDescription>
                                Must be registered and approved with your SMS provider (required for Ghana numbers). Connection test only checks the API key.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {smsForm.watch('provider') === 'twilio' && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <FormField
                            control={smsForm.control}
                            name="accountSid"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Account SID
                                  <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={smsForm.control}
                            name="fromNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  From Number
                                  <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="+1234567890" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={smsForm.control}
                          name="authToken"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Auth Token
                                <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                              </FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Enter auth token" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {smsForm.watch('provider') === 'africas_talking' && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={smsForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Username
                                  <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="sandbox" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={smsForm.control}
                            name="fromNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  From Number
                                  <span className="text-xs text-muted-foreground ml-2">(Required)</span>
                                </FormLabel>
                                <FormControl>
                                  <Input placeholder="+1234567890" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={smsForm.control}
                          name="apiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                API Key
                                <span className="text-xs text-muted-foreground ml-2">(Required - keep this secure)</span>
                              </FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Enter API key" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          smsForm.reset();
                          if (smsData?.data) {
                            smsForm.reset({
                              enabled: smsData.data.enabled || false,
                              provider: smsData.data.provider || 'termii',
                              senderId: smsData.data.senderId || '',
                              apiKey: '',
                              accountSid: smsData.data.accountSid || '',
                              authToken: '',
                              fromNumber: smsData.data.fromNumber || '',
                              username: smsData.data.username || '',
                            });
                          }
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestSMS}
                        loading={testSMSMutation.isLoading}
                      >
                        Test Connection
                      </Button>
                      <Button type="submit" loading={updateSMSMutation.isLoading}>
                        Save Settings
                      </Button>
                    </div>
                  </form>
                </Form>
              </>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-0 space-y-3 md:space-y-4">
            <Alert className="border-gray-200">
              <Send className="h-4 w-4" />
              <AlertTitle className="text-sm">Delivery rules</AlertTitle>
              <AlertDescription className="text-xs md:text-sm">
                Templates control wording only. Turn SMS on or off per event in the Delivery rules tab.
              </AlertDescription>
            </Alert>

            {loadingSmsTemplates ? (
              <div className="flex items-center justify-center py-6 md:py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : smsTemplatesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No SMS templates available.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sms-template-event">Message event</Label>
                  <Select value={selectedSmsTemplateKey} onValueChange={setSelectedSmsTemplateKey}>
                    <SelectTrigger id="sms-template-event">
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {smsTemplatesList.map((template) => (
                        <SelectItem key={template.eventKey} value={template.eventKey}>
                          {template.label}
                          {template.isCustom ? ' (custom)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSmsTemplate?.description ? (
                    <p className="text-xs text-muted-foreground">{selectedSmsTemplate.description}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedSmsTemplate?.variables || []).map((varName) => (
                      <Button
                        key={varName}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-mono"
                        onClick={() => insertSmsTemplateVariable(varName)}
                      >
                        {`{${varName}}`}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tap a variable to insert it. Your shop name is added automatically as a prefix when sent.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="sms-template-body">Message template</Label>
                    {selectedSmsTemplate?.isCustom ? (
                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <Textarea
                    id="sms-template-body"
                    value={smsTemplateDraft}
                    onChange={(e) => setSmsTemplateDraft(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {smsTemplateCharCount} characters · ~{smsTemplateSegmentCount} segment{smsTemplateSegmentCount !== 1 ? 's' : ''} (160 chars each)
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 md:p-4 space-y-2 bg-muted/30">
                  <p className="text-sm font-medium">Preview (sample data)</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{smsTemplatePreviewText || '—'}</p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSmsTemplate}
                    loading={resetSmsTemplateMutation.isPending}
                    disabled={!selectedSmsTemplate?.isCustom}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to default
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveSmsTemplate}
                    loading={updateSmsTemplateMutation.isPending}
                  >
                    Save template
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="delivery-rules" className="mt-0 space-y-3 md:space-y-4">
            <SettingsDeliveryRulesTable channel="sms" smsContext />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SettingsSmsSection;
