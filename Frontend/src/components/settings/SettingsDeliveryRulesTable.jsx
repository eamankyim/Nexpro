import { Loader2, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSettingsDeliveryRules } from '../../hooks/useSettingsDeliveryRules';

/**
 * Delivery rules table for one or all channels.
 * @param {Object} props
 * @param {'sms'|'email'|'whatsapp'|null} [props.channel] - Limit to one channel column
 * @param {boolean} [props.smsContext] - Shorter copy when embedded in SMS settings
 */
const SettingsDeliveryRulesTable = ({ channel = null, smsContext = false }) => {
  const {
    canManageOrganization,
    loadingMessageDeliveryRules,
    deliveryRulesByCategory,
    handleDeliveryRuleToggle,
    updateMessageDeliveryRulesMutation,
  } = useSettingsDeliveryRules({ channel });

  if (!canManageOrganization) return null;

  const channels = channel ? [channel] : ['email', 'sms', 'whatsapp'];
  const channelLabels = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp' };

  return (
    <div className="space-y-4">
      {!smsContext && (
        <Alert className="border-gray-200">
          <AlertTitle>SMS templates are editable separately</AlertTitle>
          <AlertDescription className="text-xs md:text-sm">
            Use SMS settings to customize message text. This table controls which channels are allowed per event.
            Locked toggles are required for security or account messages and cannot be turned off.
          </AlertDescription>
        </Alert>
      )}
      {smsContext && (
        <p className="text-xs md:text-sm text-muted-foreground">
          Choose which events may send SMS. Templates control wording only.
        </p>
      )}
      {loadingMessageDeliveryRules ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Loading delivery rules…
        </div>
      ) : deliveryRulesByCategory.length === 0 ? (
        <p className="text-sm text-muted-foreground">No delivery rules available.</p>
      ) : (
        deliveryRulesByCategory.map(({ category, label, rows }) => (
          <div key={category} className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 md:px-4 md:py-2.5 bg-muted/50 border-b border-gray-200 text-sm font-medium">
              {label}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Message</TableHead>
                  {channels.map((ch) => (
                    <TableHead key={ch} className="text-center w-20">
                      {channelLabels[ch]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <div className="font-medium text-sm">{row.label}</div>
                      {row.description ? (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                      ) : null}
                    </TableCell>
                    {channels.map((ch) => {
                      const allowed = row.allowedChannels?.includes(ch);
                      const locked = row.locked?.[ch] === true;
                      const checked = row.channels?.[ch] === true;
                      if (!allowed) {
                        return (
                          <TableCell key={ch} className="text-center text-muted-foreground text-xs">
                            —
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={ch} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={checked}
                              disabled={locked || updateMessageDeliveryRulesMutation.isPending}
                              onCheckedChange={(value) => handleDeliveryRuleToggle(row.key, ch, value)}
                              aria-label={`${row.label} ${ch}`}
                            />
                            {locked ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Lock className="h-3 w-3" aria-hidden />
                                Required
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  );
};

export default SettingsDeliveryRulesTable;
