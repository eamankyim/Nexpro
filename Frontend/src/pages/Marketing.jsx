import { useMemo, useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Loader2, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import marketingService from '../services/marketingService';
import { showSuccess, showError, handleApiError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CARD_BORDER = { border: '1px solid #e5e7eb' };

const marketingFormSchema = z
  .object({
    channelEmail: z.boolean(),
    channelSms: z.boolean(),
    channelWhatsapp: z.boolean(),
    activeOnly: z.boolean(),
    dryRun: z.boolean(),
    subject: z.string(),
    emailBody: z.string(),
    smsBody: z.string(),
    whatsappTemplateName: z.string(),
    whatsappLanguage: z.string(),
    whatsappParamsText: z.string(),
    whatsappPrependCustomerName: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const any = data.channelEmail || data.channelSms || data.channelWhatsapp;
    if (!any) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one channel',
        path: ['channelEmail'],
      });
    }
    if (data.channelEmail) {
      if (!data.subject?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subject is required',
          path: ['subject'],
        });
      }
      if (!data.emailBody?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email body is required',
          path: ['emailBody'],
        });
      }
    }
    if (data.channelSms && !data.smsBody?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SMS text is required',
        path: ['smsBody'],
      });
    }
    if (data.channelWhatsapp && !data.whatsappTemplateName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Template name is required',
        path: ['whatsappTemplateName'],
      });
    }
  });

const defaultValues = {
  channelEmail: false,
  channelSms: false,
  channelWhatsapp: false,
  activeOnly: true,
  dryRun: false,
  subject: '',
  emailBody: '',
  smsBody: '',
  whatsappTemplateName: '',
  whatsappLanguage: 'en',
  whatsappParamsText: '',
  whatsappPrependCustomerName: false,
};

export default function Marketing() {
  const location = useLocation();
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const form = useForm({
    resolver: zodResolver(marketingFormSchema),
    defaultValues,
  });

  const activeOnly = form.watch('activeOnly');
  const channelEmail = form.watch('channelEmail');
  const channelSms = form.watch('channelSms');
  const channelWhatsapp = form.watch('channelWhatsapp');

  const { data: capResponse, isLoading: capLoading } = useQuery({
    queryKey: ['marketing', 'capabilities', activeTenantId],
    queryFn: () => marketingService.getCapabilities(),
    enabled: !!activeTenantId,
  });

  const { data: previewResponse, isLoading: previewLoading } = useQuery({
    queryKey: ['marketing', 'preview', activeTenantId, activeOnly],
    queryFn: () =>
      marketingService.getPreview({ activeOnly: activeOnly ? 'true' : 'false' }),
    enabled: !!activeTenantId,
  });

  const caps = capResponse?.data || {};
  const preview = previewResponse?.data || {};
  const contacts = useMemo(() => (Array.isArray(preview.contacts) ? preview.contacts : []), [preview.contacts]);

  /** Channels that are configured but not yet marked verified (first-time or after config change). */
  const unverifiedChannelHints = useMemo(() => {
    const items = [];
    if (caps.email?.available && caps.email?.verified !== true) {
      items.push({
        key: 'email',
        label: 'Email',
        to: '/settings?tab=integration&subtab=email',
      });
    }
    if (caps.sms?.available && caps.sms?.verified !== true) {
      items.push({
        key: 'sms',
        label: 'SMS',
        to: '/settings?tab=integration&subtab=sms',
      });
    }
    if (caps.whatsapp?.available && caps.whatsapp?.verified !== true) {
      items.push({
        key: 'whatsapp',
        label: 'WhatsApp',
        to: '/settings?tab=integration&subtab=whatsapp',
      });
    }
    return items;
  }, [caps]);

  const contactIdsFingerprint = useMemo(() => contacts.map((c) => c.id).join('|'), [contacts]);

  useEffect(() => {
    setSelectedIds(new Set(contacts.map((c) => c.id)));
  }, [contactIdsFingerprint]);

  const broadcastMutation = useMutation({
    mutationFn: (body) => marketingService.postBroadcast(body),
    onSuccess: (res) => {
      setLastResult(res?.data ?? null);
      queryClient.invalidateQueries({ queryKey: ['marketing'] });
      if (res?.data?.dryRun) {
        showSuccess('Dry run complete — no messages were sent');
      } else {
        showSuccess('Broadcast finished');
      }
    },
    onError: (err) => handleApiError(err, { context: 'Marketing broadcast' }),
  });

  const buildPayload = useCallback(
    (values) => {
      const channels = [];
      if (values.channelEmail) channels.push('email');
      if (values.channelSms) channels.push('sms');
      if (values.channelWhatsapp) channels.push('whatsapp');
      const whatsappParameters = values.whatsappParamsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        channels,
        activeOnly: values.activeOnly,
        dryRun: values.dryRun,
        subject: values.subject?.trim() || undefined,
        emailBody: values.emailBody || undefined,
        smsBody: values.smsBody?.trim() || undefined,
        whatsappTemplateName: values.whatsappTemplateName?.trim() || undefined,
        whatsappLanguage: values.whatsappLanguage?.trim() || 'en',
        whatsappParameters,
        whatsappPrependCustomerName: values.whatsappPrependCustomerName,
      };
      const allSelected =
        contacts.length > 0 &&
        selectedIds.size === contacts.length &&
        contacts.every((c) => selectedIds.has(c.id));
      if (!allSelected && selectedIds.size > 0) {
        payload.customerIds = Array.from(selectedIds);
      }
      return payload;
    },
    [contacts, selectedIds]
  );

  const validateAgainstCapabilities = useCallback(
    (values) => {
      if (values.channelEmail && !caps.email?.available) {
        showError('Email is not configured for this workspace');
        return false;
      }
      if (values.channelSms && !caps.sms?.available) {
        showError('SMS is not configured for this workspace');
        return false;
      }
      if (values.channelWhatsapp && !caps.whatsapp?.available) {
        showError('WhatsApp is not configured for this workspace');
        return false;
      }
      return true;
    },
    [caps]
  );

  const onValid = useCallback(
    (values) => {
      if (!validateAgainstCapabilities(values)) return;
      if (contacts.length === 0) {
        showError('No contacts in this audience. Add customers or turn off “Active customers only”.');
        return;
      }
      if (selectedIds.size === 0) {
        showError('Select at least one contact');
        return;
      }
      const payload = buildPayload(values);
      if (values.dryRun) {
        broadcastMutation.mutate(payload);
        return;
      }
      setPendingPayload(payload);
      setConfirmOpen(true);
    },
    [validateAgainstCapabilities, buildPayload, broadcastMutation, contacts.length, selectedIds.size]
  );

  const handleConfirmSend = useCallback(() => {
    if (pendingPayload) {
      broadcastMutation.mutate(pendingPayload);
    }
    setConfirmOpen(false);
    setPendingPayload(null);
  }, [pendingPayload, broadcastMutation]);

  const loading = capLoading || previewLoading;

  const reachSummary = useMemo(() => {
    if (loading) return null;
    const parts = [];
    if (preview.totalInWorkspace != null) parts.push(`${preview.totalInWorkspace} customers`);
    if (preview.batchSize != null) {
      parts.push(
        `${preview.batchSize} in send batch (max ${preview.maxRecipients ?? 500})`
      );
    }
    parts.push(`${preview.withEmail ?? 0} with email`);
    parts.push(`${preview.withSmsPhone ?? 0} with phone`);
    if (contacts.length > 0) {
      parts.push(`${selectedIds.size} selected for send`);
    }
    return parts.join(' · ');
  }, [preview, loading, contacts.length, selectedIds.size]);

  const allContactsSelected =
    contacts.length > 0 && selectedIds.size === contacts.length;
  const someContactsSelected = selectedIds.size > 0 && !allContactsSelected;

  const toggleContactSelected = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setSelectAllContacts = useCallback((selectAll) => {
    if (selectAll) {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [contacts]);

  const composeCardCount =
    (channelEmail ? 1 : 0) + (channelSms ? 1 : 0) + (channelWhatsapp ? 1 : 0);
  const whatsappAloneWide = channelWhatsapp && !channelEmail && !channelSms;

  useEffect(() => {
    const prefill = location.state?.prefill;
    if (!prefill || typeof prefill !== 'object') return;
    form.reset({
      ...defaultValues,
      ...prefill,
    });
  }, [location.state, form]);

  return (
    <div className="w-full space-y-4 md:space-y-6" data-tour="marketing-main">
      <div className="mb-2 md:mb-0">
        <div className="flex items-center gap-2">
          <Megaphone className="h-8 w-8 shrink-0" style={{ color: 'var(--color-primary)' }} aria-hidden />
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">Marketing</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-3xl">
          Bulk message customers. Configure channels in Settings. WhatsApp uses Meta-approved templates only.
        </p>
      </div>

      {unverifiedChannelHints.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-900">
          <Info className="h-4 w-4 text-amber-800 dark:text-amber-200" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">One-time channel check</AlertTitle>
          <AlertDescription className="text-sm text-amber-950/90 dark:text-amber-100/90">
            <p className="mb-2">
              These channels are enabled but not marked verified yet. Open each in Settings → Integrations and
              save (connection is tested on save), or send a successful broadcast — then you will not need to
              repeat this unless you change the integration.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {unverifiedChannelHints.map((row) => (
                <li key={row.key}>
                  <Link to={row.to} className="font-medium underline text-foreground">
                    {row.label}
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:items-stretch">
        <Alert className="border-border h-fit">
          <Info className="h-4 w-4" />
          <AlertTitle>Compliance</AlertTitle>
          <AlertDescription className="text-sm">
            Get consent for promotional messages and follow local rules.
          </AlertDescription>
        </Alert>

        <Card className="h-fit" style={CARD_BORDER}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Workspace reach</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <p>Loading…</p>
            ) : (
              <>
                <p>{reachSummary}</p>
                {preview.truncated && (
                  <p className="mt-2 text-xs">
                    Oldest customers are outside this batch (limit {preview.maxRecipients ?? 500}).
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onValid)} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:items-stretch">
            <Card style={CARD_BORDER}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="activeOnly"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3 gap-3">
                      <FormLabel className="!mt-0 cursor-pointer">Active customers only</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dryRun"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3 gap-3">
                      <FormLabel className="!mt-0 cursor-pointer">Dry run (optional)</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                    <p className="text-sm font-medium text-foreground">Contacts in this batch</p>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={previewLoading || contacts.length === 0}
                        onClick={() => setSelectAllContacts(true)}
                      >
                        Select all
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={previewLoading || contacts.length === 0}
                        onClick={() => setSelectAllContacts(false)}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  {previewLoading ? (
                    <p className="text-sm text-muted-foreground p-4">Loading contacts…</p>
                  ) : contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">
                      No contacts match this audience. Try turning off “Active customers only” or add customers.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10 px-2">
                              <Checkbox
                                checked={
                                  contacts.length === 0
                                    ? false
                                    : allContactsSelected
                                      ? true
                                      : someContactsSelected
                                        ? 'indeterminate'
                                        : false
                                }
                                onCheckedChange={(v) => {
                                  if (v === true) setSelectAllContacts(true);
                                  else setSelectAllContacts(false);
                                }}
                                aria-label="Select all contacts"
                              />
                            </TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="hidden md:table-cell">Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contacts.map((c) => {
                            const label = (c.name && String(c.name).trim()) || (c.company && String(c.company).trim()) || 'Customer';
                            return (
                              <TableRow key={c.id}>
                                <TableCell className="px-2 align-middle">
                                  <Checkbox
                                    checked={selectedIds.has(c.id)}
                                    onCheckedChange={() => toggleContactSelected(c.id)}
                                    aria-label={`Select ${label}`}
                                  />
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="font-medium text-foreground">{label}</div>
                                  {c.company && c.name ? (
                                    <div className="text-xs text-muted-foreground sm:hidden">{c.company}</div>
                                  ) : null}
                                  <div className="text-xs text-muted-foreground sm:hidden mt-1 space-y-0.5">
                                    {c.email ? <div>{c.email}</div> : null}
                                    {c.phone ? <div>{c.phone}</div> : null}
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                  {c.email || '—'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {c.phone || '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card style={CARD_BORDER}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Channels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="channelEmail"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!caps.email?.available}
                        />
                      </FormControl>
                      <div className="space-y-0.5 flex-1 min-w-0 leading-snug">
                        <FormLabel className="font-medium">Email</FormLabel>
                        {!caps.email?.available && (
                          <FormDescription className="text-xs">
                            {caps.email?.businessProfileEmailSet ? (
                              <>
                                Company email is saved under Workspace, but broadcasts need outbound mail in{' '}
                                <Link
                                  to="/settings?tab=integration&subtab=email"
                                  className="underline font-medium text-foreground"
                                >
                                  Settings → Integrations → Email
                                </Link>{' '}
                                (enable and add SMTP, SendGrid, or SES).
                              </>
                            ) : (
                              <>
                                Enable outbound email in{' '}
                                <Link
                                  to="/settings?tab=integration&subtab=email"
                                  className="underline font-medium text-foreground"
                                >
                                  Settings → Integrations → Email
                                </Link>
                                .
                              </>
                            )}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="channelSms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!caps.sms?.available}
                        />
                      </FormControl>
                      <div className="space-y-0.5 leading-snug">
                        <FormLabel className="font-medium">SMS</FormLabel>
                        {!caps.sms?.available && (
                          <FormDescription className="text-xs">Enable in Settings</FormDescription>
                        )}
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="channelWhatsapp"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          className="mt-0.5"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!caps.whatsapp?.available}
                        />
                      </FormControl>
                      <div className="space-y-0.5 leading-snug">
                        <FormLabel className="font-medium">WhatsApp</FormLabel>
                        {!caps.whatsapp?.available && (
                          <FormDescription className="text-xs">Enable in Settings</FormDescription>
                        )}
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {composeCardCount > 0 ? (
            <div
              className={cn(
                'grid gap-4 md:gap-6',
                composeCardCount >= 2 && 'lg:grid-cols-2',
                whatsappAloneWide && 'lg:grid-cols-1'
              )}
            >
              {channelEmail && (
                <Card style={CARD_BORDER}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Email</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input placeholder="Holiday hours" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emailBody"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={5} placeholder="Plain text" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {channelSms && (
                <Card style={CARD_BORDER}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">SMS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="smsBody"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea rows={5} maxLength={480} placeholder="Up to 480 characters" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {channelWhatsapp && (
                <Card
                  className={cn(
                    channelEmail && channelSms && 'lg:col-span-2'
                  )}
                  style={CARD_BORDER}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">WhatsApp template</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Name must match Meta. Variables: one line each. Toggle below adds customer name as {'{{1}}'}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="whatsappTemplateName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template name</FormLabel>
                            <FormControl>
                              <Input placeholder="seasonal_promo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="whatsappLanguage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Language code (optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="en" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="whatsappPrependCustomerName"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3 gap-3">
                          <FormLabel className="!mt-0 cursor-pointer text-sm">
                            Prepend customer name as first variable
                          </FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="whatsappParamsText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>More variables (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder="One line per variable"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="border-dashed border-border bg-muted/30" style={CARD_BORDER}>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Select at least one channel above to compose your message.
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset(defaultValues);
                setLastResult(null);
                setSelectedIds(new Set(contacts.map((c) => c.id)));
              }}
            >
              Reset form
            </Button>
            <Button
              type="submit"
              disabled={broadcastMutation.isPending}
              className="bg-brand hover:bg-brand-dark"
            >
              {broadcastMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working…
                </>
              ) : form.watch('dryRun') ? (
                'Run dry run'
              ) : (
                'Send broadcast'
              )}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setPendingPayload(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to customers?</AlertDialogTitle>
            <AlertDialogDescription>
              Send to {selectedIds.size} recipient{selectedIds.size === 1 ? '' : 's'}. Provider limits apply.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPayload(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lastResult && (
        <Card style={CARD_BORDER}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last result</CardTitle>
            <CardDescription>
              {lastResult.dryRun ? 'Dry run (no sends).' : 'Done.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2 font-mono">
            {['email', 'sms', 'whatsapp'].map((ch) => {
              const block = lastResult[ch];
              if (!block) return null;
              return (
                <div key={ch}>
                  <span className="font-semibold capitalize">{ch}</span>: sent {block.sent}, skipped{' '}
                  {block.skipped}, failed {block.failed?.length ?? 0}
                  {block.failed?.length > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {block.failed.slice(0, 8).map((f) => (
                        <li key={`${f.customerId}-${f.reason}`}>
                          {f.customerId}: {f.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
