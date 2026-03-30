import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, PlayCircle, Plus, Trash2, Workflow } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import automationService from '../services/automationService';
import settingsService from '../services/settingsService';
import {
  ACTION_TYPE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  THRESHOLD_MODE_OPTIONS,
  TRIGGER_OPTIONS,
  actionRowsFromConfig,
  buildRulePayloadFromForm,
  conditionFormFromConfig,
  defaultActionFormRow,
  defaultTriggerForm,
  mergeTriggerForm,
  parseJsonObject,
  triggerLabel,
} from '../utils/automationForm';
import { handleApiError, showError, showSuccess } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import StatusChip from '@/components/StatusChip';

const CARD_BORDER = { border: '1px solid #e5e7eb' };

const MAX_ACTIONS = 5;
const DEFAULT_TASK_AUTOMATION = {
  leadFollowUpToTask: true,
  invoiceOverdueToTask: false,
  quoteNoResponseToTask: false,
  lowStockToTask: false,
  quoteNoResponseDays: 3,
};

function createInitialBuilder() {
  return {
    name: '',
    triggerType: 'invoice_due_in_days',
    triggerForm: defaultTriggerForm('invoice_due_in_days'),
    conditionForm: { minInvoiceAmount: '', weekdaysOnly: false },
    actionRows: [defaultActionFormRow('create_task')],
  };
}

const INITIAL_RAW_JSON = {
  triggerConfig: '{}',
  conditionConfig: '{}',
  actionConfig: '{"actions":[]}',
  scheduleConfig: '{}',
};

function AutomationTriggerFields({ triggerType, value, onPatch }) {
  const tf = value || {};
  const num = (v, fallback) => (v === '' || v === undefined || v === null ? fallback : Number(v));

  switch (triggerType) {
    case 'invoice_due_in_days':
      return (
        <div className="space-y-1.5">
          <Label htmlFor="auto-days-before-due">Days before due date</Label>
          <Input
            id="auto-days-before-due"
            type="number"
            min={0}
            max={365}
            value={tf.daysBeforeDue ?? ''}
            onChange={(e) => onPatch({ daysBeforeDue: e.target.value === '' ? '' : num(e.target.value, 0) })}
          />
          <p className="text-xs text-muted-foreground">0 = on the due date; 2 = two days before.</p>
        </div>
      );
    case 'invoice_overdue':
      return (
        <div className="space-y-1.5">
          <Label htmlFor="auto-days-after-due">Days after due date</Label>
          <Input
            id="auto-days-after-due"
            type="number"
            min={0}
            max={365}
            value={tf.daysAfterDue ?? ''}
            onChange={(e) => onPatch({ daysAfterDue: e.target.value === '' ? '' : num(e.target.value, 0) })}
          />
        </div>
      );
    case 'low_stock_detected':
      return (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Threshold</Label>
            <Select
              value={tf.thresholdMode === 'fixed' ? 'fixed' : 'reorder_level'}
              onValueChange={(v) => onPatch({ thresholdMode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tf.thresholdMode === 'fixed' && (
            <div className="space-y-1.5">
              <Label htmlFor="auto-fixed-threshold">Minimum quantity (alert below this)</Label>
              <Input
                id="auto-fixed-threshold"
                type="number"
                min={0}
                value={tf.fixedThreshold ?? ''}
                onChange={(e) => onPatch({ fixedThreshold: e.target.value === '' ? '' : num(e.target.value, 0) })}
              />
            </div>
          )}
        </div>
      );
    case 'quote_no_response':
      return (
        <div className="space-y-1.5">
          <Label htmlFor="auto-silent-days">Days without response</Label>
          <Input
            id="auto-silent-days"
            type="number"
            min={1}
            max={365}
            value={tf.silentDays ?? ''}
            onChange={(e) => onPatch({ silentDays: e.target.value === '' ? '' : num(e.target.value, 7) })}
          />
        </div>
      );
    case 'customer_inactive_days':
      return (
        <div className="space-y-1.5">
          <Label htmlFor="auto-inactive-days">Days since last activity</Label>
          <Input
            id="auto-inactive-days"
            type="number"
            min={1}
            max={730}
            value={tf.inactiveDays ?? ''}
            onChange={(e) => onPatch({ inactiveDays: e.target.value === '' ? '' : num(e.target.value, 30) })}
          />
        </div>
      );
    default:
      return null;
  }
}

function AutomationActionFields({ row, onPatch }) {
  const r = row || {};
  switch (r.type) {
    case 'create_task':
      return (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="auto-task-title">Task title</Label>
            <Input
              id="auto-task-title"
              value={r.title ?? ''}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Follow up"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={r.priority || 'medium'} onValueChange={(v) => onPatch({ priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-task-desc">Description (optional)</Label>
            <Textarea
              id="auto-task-desc"
              rows={2}
              value={r.description ?? ''}
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-task-link">Link path (optional)</Label>
            <Input
              id="auto-task-link"
              value={r.link ?? ''}
              onChange={(e) => onPatch({ link: e.target.value })}
              placeholder="/materials"
            />
          </div>
        </div>
      );
    case 'send_email_platform':
      return (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="auto-email-subject">Subject</Label>
            <Input
              id="auto-email-subject"
              value={r.subject ?? ''}
              onChange={(e) => onPatch({ subject: e.target.value })}
              placeholder="Invoice due soon"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-email-body">Message</Label>
            <Textarea
              id="auto-email-body"
              rows={4}
              value={r.body ?? ''}
              onChange={(e) => onPatch({ body: e.target.value })}
              placeholder="Plain text or simple HTML supported by your email setup."
            />
          </div>
        </div>
      );
    case 'send_sms':
      return (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label htmlFor="auto-sms-body">SMS message</Label>
          <Textarea
            id="auto-sms-body"
            rows={3}
            value={r.body ?? ''}
            onChange={(e) => onPatch({ body: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Requires customer phone on the record when the rule runs.</p>
        </div>
      );
    case 'send_whatsapp':
      return (
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="auto-wa-template">Template name</Label>
            <Input
              id="auto-wa-template"
              value={r.templateName ?? ''}
              onChange={(e) => onPatch({ templateName: e.target.value })}
              placeholder="hello_world"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-wa-lang">Language code</Label>
            <Input
              id="auto-wa-lang"
              value={r.language ?? 'en'}
              onChange={(e) => onPatch({ language: e.target.value })}
              placeholder="en"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auto-wa-params">Template parameters (optional)</Label>
            <Input
              id="auto-wa-params"
              value={r.parametersText ?? ''}
              onChange={(e) => onPatch({ parametersText: e.target.value })}
              placeholder="Comma-separated values"
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function Automations() {
  const { activeTenantId } = useAuth();
  const queryClient = useQueryClient();
  const [builder, setBuilder] = useState(createInitialBuilder);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [useJsonOverride, setUseJsonOverride] = useState(false);
  const [rawJson, setRawJson] = useState(INITIAL_RAW_JSON);
  const [taskAutomationDraft, setTaskAutomationDraft] = useState(DEFAULT_TASK_AUTOMATION);

  useEffect(() => {
    if (useJsonOverride) setAdvancedOpen(true);
  }, [useJsonOverride]);

  const templatesQuery = useQuery({
    queryKey: ['automations', 'templates'],
    queryFn: () => automationService.getTemplates(),
    enabled: !!activeTenantId,
  });
  const rulesQuery = useQuery({
    queryKey: ['automations', 'rules', activeTenantId],
    queryFn: () => automationService.getRules(),
    enabled: !!activeTenantId,
  });
  const runsQuery = useQuery({
    queryKey: ['automations', 'runs', activeTenantId, selectedRuleId],
    queryFn: () => automationService.getRuns(selectedRuleId ? { ruleId: selectedRuleId } : {}),
    enabled: !!activeTenantId,
  });
  const organizationQuery = useQuery({
    queryKey: ['settings', 'organization', activeTenantId],
    queryFn: () => settingsService.getOrganizationSettings(),
    enabled: !!activeTenantId,
  });

  const templates = templatesQuery.data?.data || [];
  const rules = rulesQuery.data?.data || [];
  const runs = runsQuery.data?.data || [];
  const organization = organizationQuery.data?.data ?? organizationQuery.data ?? {};

  useEffect(() => {
    const cfg = organization?.taskAutomation || {};
    setTaskAutomationDraft({
      leadFollowUpToTask: cfg?.leadFollowUpToTask !== false,
      invoiceOverdueToTask: cfg?.invoiceOverdueToTask === true,
      quoteNoResponseToTask: cfg?.quoteNoResponseToTask === true,
      lowStockToTask: cfg?.lowStockToTask === true,
      quoteNoResponseDays: Number.parseInt(cfg?.quoteNoResponseDays, 10) || 3,
    });
  }, [organization?.taskAutomation]);

  const ruleNameById = useMemo(() => {
    const m = new Map();
    for (const r of rules) {
      if (r?.id) m.set(r.id, r.name || 'Rule');
    }
    return m;
  }, [rules]);

  const createMutation = useMutation({
    mutationFn: (payload) => automationService.createRule(payload),
    onSuccess: () => {
      showSuccess('Automation rule created');
      setBuilder(createInitialBuilder());
      setUseJsonOverride(false);
      setRawJson(INITIAL_RAW_JSON);
      setAdvancedOpen(false);
      queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] });
    },
    onError: (error) => handleApiError(error, { context: 'Create automation rule' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => automationService.toggleRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations', 'rules'] });
    },
    onError: (error) => handleApiError(error, { context: 'Toggle automation rule' }),
  });

  const testMutation = useMutation({
    mutationFn: (id) => automationService.testRule(id, {}),
    onSuccess: () => {
      showSuccess('Test run created');
      queryClient.invalidateQueries({ queryKey: ['automations', 'runs'] });
    },
    onError: (error) => handleApiError(error, { context: 'Test automation rule' }),
  });
  const saveTaskAutomationMutation = useMutation({
    mutationFn: (payload) => settingsService.updateOrganization({ taskAutomation: payload }),
    onSuccess: () => {
      showSuccess('Task automations updated');
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
    },
    onError: (error) => handleApiError(error, { context: 'Update task automations' }),
  });

  const applyTemplate = useCallback((t) => {
    const tt = t.triggerType || 'invoice_due_in_days';
    setBuilder({
      name: t.name || '',
      triggerType: tt,
      triggerForm: mergeTriggerForm(tt, t.triggerConfig || {}),
      conditionForm: conditionFormFromConfig(t.conditionConfig || {}),
      actionRows: actionRowsFromConfig(t.actionConfig),
    });
    setUseJsonOverride(false);
    setAdvancedOpen(false);
  }, []);

  const patchTriggerForm = useCallback((patch) => {
    setBuilder((b) => ({ ...b, triggerForm: { ...b.triggerForm, ...patch } }));
  }, []);

  const patchConditionForm = useCallback((patch) => {
    setBuilder((b) => ({ ...b, conditionForm: { ...b.conditionForm, ...patch } }));
  }, []);

  const patchActionRow = useCallback((index, patch) => {
    setBuilder((b) => {
      const actionRows = b.actionRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...b, actionRows };
    });
  }, []);

  const setActionType = useCallback((index, type) => {
    setBuilder((b) => {
      const next = [...b.actionRows];
      next[index] = defaultActionFormRow(type);
      return { ...b, actionRows: next };
    });
  }, []);

  const addActionRow = useCallback(() => {
    setBuilder((b) => {
      if (b.actionRows.length >= MAX_ACTIONS) return b;
      return { ...b, actionRows: [...b.actionRows, defaultActionFormRow('create_task')] };
    });
  }, []);

  const removeActionRow = useCallback((index) => {
    setBuilder((b) => {
      if (b.actionRows.length <= 1) return b;
      return { ...b, actionRows: b.actionRows.filter((_, i) => i !== index) };
    });
  }, []);

  const syncRawJsonFromForm = useCallback(() => {
    const payload = buildRulePayloadFromForm({
      name: builder.name || 'Preview',
      triggerType: builder.triggerType,
      triggerForm: builder.triggerForm,
      conditionForm: builder.conditionForm,
      actionRows: builder.actionRows,
    });
    setRawJson({
      triggerConfig: JSON.stringify(payload.triggerConfig, null, 2),
      conditionConfig: JSON.stringify(payload.conditionConfig, null, 2),
      actionConfig: JSON.stringify(payload.actionConfig, null, 2),
      scheduleConfig: JSON.stringify(payload.scheduleConfig, null, 2),
    });
  }, [builder]);

  const handleToggleJsonOverride = useCallback(
    (checked) => {
      if (checked) {
        syncRawJsonFromForm();
      }
      setUseJsonOverride(checked);
      if (checked) setAdvancedOpen(true);
    },
    [syncRawJsonFromForm]
  );

  const ruleSummary = useMemo(() => {
    if (useJsonOverride) return 'Using raw JSON — review the Advanced section before saving.';
    try {
      const p = buildRulePayloadFromForm({
        name: builder.name || '…',
        triggerType: builder.triggerType,
        triggerForm: builder.triggerForm,
        conditionForm: builder.conditionForm,
        actionRows: builder.actionRows,
      });
      const when = triggerLabel(builder.triggerType);
      const cond = [];
      if (p.conditionConfig.minInvoiceAmount != null) cond.push(`invoice amount ≥ ${p.conditionConfig.minInvoiceAmount}`);
      if (p.conditionConfig.weekdaysOnly) cond.push('weekdays only');
      const condStr = cond.length ? ` if ${cond.join(' and ')}` : '';
      const acts = (p.actionConfig.actions || []).map((a) => a.type?.replace(/_/g, ' ') || 'action');
      return `When “${when}”${condStr}, then: ${acts.join(', ') || 'nothing'}.`;
    } catch {
      return '';
    }
  }, [builder, useJsonOverride]);

  const handleCreateRule = useCallback(() => {
    const name = builder.name.trim();
    if (!name) {
      showError('Enter a rule name.');
      return;
    }

    if (useJsonOverride) {
      let triggerConfig;
      let conditionConfig;
      let actionConfig;
      let scheduleConfig;
      try {
        triggerConfig = parseJsonObject(rawJson.triggerConfig, 'Trigger config');
        conditionConfig = parseJsonObject(rawJson.conditionConfig, 'Condition config');
        actionConfig = parseJsonObject(rawJson.actionConfig, 'Action config');
        scheduleConfig = parseJsonObject(rawJson.scheduleConfig, 'Schedule config');
        if (!Array.isArray(actionConfig.actions)) {
          throw new Error('Action config must include an "actions" array.');
        }
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Invalid JSON');
        return;
      }
      createMutation.mutate({
        name,
        triggerType: builder.triggerType,
        triggerConfig,
        conditionConfig,
        actionConfig,
        scheduleConfig,
      });
      return;
    }

    const payload = buildRulePayloadFromForm({
      name,
      triggerType: builder.triggerType,
      triggerForm: builder.triggerForm,
      conditionForm: builder.conditionForm,
      actionRows: builder.actionRows,
    });
    createMutation.mutate(payload);
  }, [builder, useJsonOverride, rawJson, createMutation]);

  const selectedTriggerMeta = useMemo(
    () => TRIGGER_OPTIONS.find((o) => o.value === builder.triggerType),
    [builder.triggerType]
  );
  const taskAutomationDirty = useMemo(() => {
    const cfg = organization?.taskAutomation || {};
    const baseline = {
      leadFollowUpToTask: cfg?.leadFollowUpToTask !== false,
      invoiceOverdueToTask: cfg?.invoiceOverdueToTask === true,
      quoteNoResponseToTask: cfg?.quoteNoResponseToTask === true,
      lowStockToTask: cfg?.lowStockToTask === true,
      quoteNoResponseDays: Number.parseInt(cfg?.quoteNoResponseDays, 10) || 3,
    };
    return JSON.stringify(taskAutomationDraft) !== JSON.stringify(baseline);
  }, [organization?.taskAutomation, taskAutomationDraft]);

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="mb-2 md:mb-0">
        <div className="flex items-center gap-2">
          <Workflow className="h-8 w-8 shrink-0" style={{ color: 'var(--color-primary)' }} aria-hidden />
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">Automations</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-3xl">
          Choose what starts the rule, fine-tune options, then pick one or more actions. No JSON required unless you
          open Advanced. Integration credentials stay in Settings.
        </p>
      </div>

      <Card style={CARD_BORDER}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Task automations</CardTitle>
          <CardDescription>
            Move legacy task-creation behavior from Settings into this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Lead follow-up to task</p>
                <p className="text-xs text-muted-foreground">Create task when a lead follow-up date is set.</p>
              </div>
              <Switch
                checked={taskAutomationDraft.leadFollowUpToTask}
                onCheckedChange={(v) => setTaskAutomationDraft((d) => ({ ...d, leadFollowUpToTask: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Invoice overdue to task</p>
                <p className="text-xs text-muted-foreground">Create task when invoice becomes overdue.</p>
              </div>
              <Switch
                checked={taskAutomationDraft.invoiceOverdueToTask}
                onCheckedChange={(v) => setTaskAutomationDraft((d) => ({ ...d, invoiceOverdueToTask: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Quote no response to task</p>
                <p className="text-xs text-muted-foreground">Create task when quotes stay silent.</p>
              </div>
              <Switch
                checked={taskAutomationDraft.quoteNoResponseToTask}
                onCheckedChange={(v) => setTaskAutomationDraft((d) => ({ ...d, quoteNoResponseToTask: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Low stock to task</p>
                <p className="text-xs text-muted-foreground">Create task when inventory falls below threshold.</p>
              </div>
              <Switch
                checked={taskAutomationDraft.lowStockToTask}
                onCheckedChange={(v) => setTaskAutomationDraft((d) => ({ ...d, lowStockToTask: v }))}
              />
            </div>
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="task-auto-quote-days">Quote no response days</Label>
            <Input
              id="task-auto-quote-days"
              type="number"
              min={1}
              max={30}
              value={taskAutomationDraft.quoteNoResponseDays}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setTaskAutomationDraft((d) => ({
                  ...d,
                  quoteNoResponseDays: Number.isFinite(n) ? Math.max(1, Math.min(30, n)) : 3,
                }));
              }}
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => saveTaskAutomationMutation.mutate(taskAutomationDraft)}
              disabled={!taskAutomationDirty || saveTaskAutomationMutation.isPending || organizationQuery.isLoading}
            >
              {saveTaskAutomationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Save task automations'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <Card style={CARD_BORDER}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>Pre-filled triggers and actions — click Use template, then Create rule or adjust fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templatesQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading templates…
              </div>
            )}
            {!templatesQuery.isLoading && templates.length === 0 && (
              <p className="text-sm text-muted-foreground">No templates yet.</p>
            )}
            {!templatesQuery.isLoading &&
              templates.map((t) => (
                <div
                  key={t.key}
                  className="rounded-md border border-border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{triggerLabel(t.triggerType)}</p>
                  </div>
                  <Button type="button" variant="outline" className="shrink-0" onClick={() => applyTemplate(t)}>
                    Use template
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card style={CARD_BORDER}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create rule</CardTitle>
            <CardDescription>Trigger options below update automatically when you change the trigger type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-none">
            <div className="space-y-1.5">
              <Label htmlFor="automation-rule-name">Rule name</Label>
              <Input
                id="automation-rule-name"
                value={builder.name}
                onChange={(e) => setBuilder((b) => ({ ...b, name: e.target.value }))}
                placeholder="e.g. Invoice due reminder"
              />
            </div>

            <div className="space-y-1.5">
              <Label>When this happens (trigger)</Label>
              <Select
                value={builder.triggerType}
                onValueChange={(value) =>
                  setBuilder((b) => ({
                    ...b,
                    triggerType: value,
                    triggerForm: defaultTriggerForm(value),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTriggerMeta?.hint && !useJsonOverride && (
                <p className="text-xs text-muted-foreground">{selectedTriggerMeta.hint}</p>
              )}
            </div>

            {!useJsonOverride && (
              <>
                <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">Trigger settings</p>
                  <AutomationTriggerFields
                    triggerType={builder.triggerType}
                    value={builder.triggerForm}
                    onPatch={patchTriggerForm}
                  />
                </div>

                <div className="rounded-md border border-border p-3 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium text-foreground">Conditions (optional)</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="auto-min-amount">Minimum invoice amount (optional)</Label>
                    <Input
                      id="auto-min-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={builder.conditionForm.minInvoiceAmount}
                      onChange={(e) => patchConditionForm({ minInvoiceAmount: e.target.value })}
                      placeholder="Leave empty to skip"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="auto-weekdays" className="font-normal">
                      Only on weekdays (optional)
                    </Label>
                    <Switch
                      id="auto-weekdays"
                      checked={builder.conditionForm.weekdaysOnly}
                      onCheckedChange={(v) => patchConditionForm({ weekdaysOnly: v })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Then do this</p>
                  {builder.actionRows.map((row, index) => (
                    <div key={index} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <Label>Action {index + 1}</Label>
                          <Select value={row.type} onValueChange={(v) => setActionType(index, v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ACTION_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {builder.actionRows.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => removeActionRow(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" aria-hidden />
                            Remove
                          </Button>
                        )}
                      </div>
                      <AutomationActionFields row={row} onPatch={(p) => patchActionRow(index, p)} />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={addActionRow}
                    disabled={builder.actionRows.length >= MAX_ACTIONS}
                  >
                    <Plus className="h-4 w-4 mr-1" aria-hidden />
                    Add another action
                  </Button>
                </div>

                <div className="rounded-md border border-dashed border-border bg-background px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</p>
                  <p className="text-sm text-foreground mt-1">{ruleSummary}</p>
                </div>
              </>
            )}

            {useJsonOverride && (
              <p className="text-sm text-muted-foreground">
                Visual builder is off. Edit JSON in Advanced — rule name and trigger type above are still saved with the
                rule.
              </p>
            )}

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span>Advanced</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <Label htmlFor="auto-json-override" className="font-medium">
                      Edit as raw JSON
                    </Label>
                    <p className="text-xs text-muted-foreground">For power users. Turns off the visual builder until you turn this off.</p>
                  </div>
                  <Switch id="auto-json-override" checked={useJsonOverride} onCheckedChange={handleToggleJsonOverride} />
                </div>
                {useJsonOverride && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="raw-trigger">Trigger config (JSON)</Label>
                      <Textarea
                        id="raw-trigger"
                        className="font-mono text-xs"
                        rows={4}
                        spellCheck={false}
                        value={rawJson.triggerConfig}
                        onChange={(e) => setRawJson((r) => ({ ...r, triggerConfig: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="raw-condition">Condition config (JSON)</Label>
                      <Textarea
                        id="raw-condition"
                        className="font-mono text-xs"
                        rows={3}
                        spellCheck={false}
                        value={rawJson.conditionConfig}
                        onChange={(e) => setRawJson((r) => ({ ...r, conditionConfig: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="raw-action">Action config (JSON)</Label>
                      <Textarea
                        id="raw-action"
                        className="font-mono text-xs"
                        rows={8}
                        spellCheck={false}
                        value={rawJson.actionConfig}
                        onChange={(e) => setRawJson((r) => ({ ...r, actionConfig: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="raw-schedule">Schedule config (JSON) (optional)</Label>
                      <Textarea
                        id="raw-schedule"
                        className="font-mono text-xs"
                        rows={2}
                        spellCheck={false}
                        value={rawJson.scheduleConfig}
                        onChange={(e) => setRawJson((r) => ({ ...r, scheduleConfig: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={handleCreateRule}
                className="bg-brand hover:bg-brand-dark"
                disabled={createMutation.isPending || !builder.name.trim()}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Create rule'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card style={CARD_BORDER}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rules</CardTitle>
          <CardDescription>Turn rules on or off, run a test, and open run history per rule.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rulesQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading rules…
            </div>
          )}
          {!rulesQuery.isLoading && rules.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No rules yet. Use a <span className="font-medium text-foreground">template</span> or the form, then{' '}
                <span className="font-medium text-foreground">Create rule</span>.
              </p>
            </div>
          )}
          {!rulesQuery.isLoading &&
            rules.map((rule) => (
              <div key={rule.id} className="rounded-md border border-border p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{triggerLabel(rule.triggerType)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleMutation.mutate(rule.id)}
                      aria-label={rule.enabled ? `Disable rule ${rule.name}` : `Enable rule ${rule.name}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => testMutation.mutate(rule.id)}
                      disabled={testMutation.isPending}
                    >
                      <PlayCircle className="h-4 w-4 mr-1" aria-hidden />
                      Test
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={selectedRuleId === rule.id ? 'secondary' : 'ghost'}
                  type="button"
                  className={selectedRuleId === rule.id ? 'border border-border font-medium' : ''}
                  onClick={() => setSelectedRuleId((id) => (id === rule.id ? '' : rule.id))}
                >
                  {selectedRuleId === rule.id ? 'Showing runs for this rule' : 'View runs for this rule'}
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card style={CARD_BORDER}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Run history</CardTitle>
          <CardDescription>
            {selectedRuleId ? `Runs for: ${ruleNameById.get(selectedRuleId) || 'selected rule'}` : 'Latest runs for this workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {runsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading runs…
            </div>
          )}
          {!runsQuery.isLoading && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No runs yet. Enable a rule and use <span className="font-medium text-foreground">Test</span>, or wait for a
              scheduled trigger.
            </p>
          )}
          {!runsQuery.isLoading &&
            runs.map((run) => (
              <div key={run.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <StatusChip status={run.status || 'success'} />
                  <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</p>
                </div>
                {run.ruleId && (
                  <p className="text-xs text-muted-foreground mt-1">Rule: {ruleNameById.get(run.ruleId) || run.ruleId}</p>
                )}
                {run.error && <p className="text-xs text-red-600 mt-2">{run.error}</p>}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
