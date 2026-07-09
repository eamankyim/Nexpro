import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Mail, Phone, Search, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import customerService from '../../services/customerService';
import { useDebounce } from '../../hooks/useDebounce';
import { DEBOUNCE_DELAYS } from '../../constants';
import { messagingActionRequirements } from '../../utils/automationForm';
import { validatePhone } from '../../utils/phoneUtils';
import { showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const CARD_BORDER = { border: '1px solid #e5e7eb' };

/**
 * Prompt for a real recipient before running messaging automation tests.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function(boolean): void} props.onOpenChange
 * @param {Record<string, unknown>[]} props.actionRows
 * @param {boolean} props.isSubmitting
 * @param {function(Record<string, unknown>): void} props.onConfirm
 */
export default function AutomationTestRecipientDialog({
  open,
  onOpenChange,
  actionRows,
  isSubmitting = false,
  onConfirm,
}) {
  const { activeTenantId } = useAuth();
  const { needsPhone, needsEmail } = useMemo(
    () => messagingActionRequirements(actionRows),
    [actionRows]
  );

  const [mode, setMode] = useState('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const debouncedSearch = useDebounce(searchQuery, DEBOUNCE_DELAYS.SEARCH);

  const customersQuery = useQuery({
    queryKey: ['automations', 'test-recipient-customers', activeTenantId, debouncedSearch],
    queryFn: () => customerService.getCustomers({
      search: debouncedSearch.trim() || undefined,
      limit: 25,
      isActive: true,
    }),
    enabled: open && mode === 'customer' && !!activeTenantId,
  });

  const customers = useMemo(() => {
    const data = customersQuery.data?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.customers)) return data.customers;
    if (Array.isArray(customersQuery.data?.customers)) return customersQuery.data.customers;
    return [];
  }, [customersQuery.data]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const resetForm = useCallback(() => {
    setMode('customer');
    setSearchQuery('');
    setSelectedCustomerId('');
    setManualName('');
    setManualPhone('');
    setManualEmail('');
  }, []);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const buildRecipient = useCallback(() => {
    if (mode === 'customer') {
      if (!selectedCustomer) return null;
      return {
        customerId: selectedCustomer.id,
        name: selectedCustomer.name || selectedCustomer.company || 'Customer',
        company: selectedCustomer.company || selectedCustomer.name || '',
        phone: selectedCustomer.phone || '',
        email: selectedCustomer.email || '',
        dateOfBirth: selectedCustomer.dateOfBirth || selectedCustomer.birthday || undefined,
      };
    }

    return {
      name: manualName.trim() || 'Test Customer',
      phone: manualPhone.trim(),
      email: manualEmail.trim(),
    };
  }, [mode, selectedCustomer, manualName, manualPhone, manualEmail]);

  const handleConfirm = useCallback(() => {
    const recipient = buildRecipient();
    if (!recipient) {
      showError('Select a customer to run this test.');
      return;
    }

    if (needsPhone) {
      const phone = String(recipient.phone || '').trim();
      if (!phone) {
        showError('Enter a phone number for this SMS/WhatsApp test.');
        return;
      }
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.valid) {
        showError(phoneCheck.error || 'Enter a valid phone number.');
        return;
      }
      recipient.phone = phoneCheck.normalized || phone;
    }

    if (needsEmail) {
      const email = String(recipient.email || '').trim();
      if (!email) {
        showError('Enter an email address for this email test.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Enter a valid email address.');
        return;
      }
      recipient.email = email;
    }

    onConfirm(recipient);
  }, [buildRecipient, needsEmail, needsPhone, onConfirm]);

  const requirementText = useMemo(() => {
    if (needsPhone && needsEmail) return 'Choose who should receive the test SMS/WhatsApp and email.';
    if (needsPhone) return 'Choose who should receive the test SMS or WhatsApp message.';
    if (needsEmail) return 'Choose who should receive the test email.';
    return 'Choose a recipient for this test run.';
  }, [needsEmail, needsPhone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" aria-hidden />
            Test recipient
          </DialogTitle>
          <DialogDescription>{requirementText}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <RadioGroup value={mode} onValueChange={setMode} className="grid gap-3">
            <label
              htmlFor="automation-test-mode-customer"
              className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
              style={CARD_BORDER}
            >
              <RadioGroupItem id="automation-test-mode-customer" value="customer" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Select a customer</p>
                <p className="text-xs text-muted-foreground">Use an existing customer phone or email from your workspace.</p>
              </div>
            </label>
            <label
              htmlFor="automation-test-mode-manual"
              className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
              style={CARD_BORDER}
            >
              <RadioGroupItem id="automation-test-mode-manual" value="manual" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Enter details manually</p>
                <p className="text-xs text-muted-foreground">Use your own phone or email to verify delivery.</p>
              </div>
            </label>
          </RadioGroup>

          {mode === 'customer' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="automation-test-customer-search">Search customers</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="automation-test-customer-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, phone, or email"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl p-2" style={CARD_BORDER}>
                {customersQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Loading customers...
                  </div>
                ) : customers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No customers found.</p>
                ) : (
                  customers.map((customer) => {
                    const isSelected = customer.id === selectedCustomerId;
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-[#166534] bg-emerald-50'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{customer.name || customer.company || 'Customer'}</p>
                        <p className="text-xs text-muted-foreground">
                          {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedCustomer ? (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700" style={CARD_BORDER}>
                  <p className="font-medium text-foreground">{selectedCustomer.name || selectedCustomer.company}</p>
                  {needsPhone ? (
                    <p className="mt-1 flex items-center gap-2 text-xs">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {selectedCustomer.phone || 'No phone on file'}
                    </p>
                  ) : null}
                  {needsEmail ? (
                    <p className="mt-1 flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {selectedCustomer.email || 'No email on file'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="automation-test-manual-name">Customer name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="automation-test-manual-name"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="e.g. Kofi Mensah"
                    className="pl-9"
                  />
                </div>
              </div>
              {needsPhone ? (
                <div className="space-y-1.5">
                  <Label htmlFor="automation-test-manual-phone">Phone number</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="automation-test-manual-phone"
                      value={manualPhone}
                      onChange={(event) => setManualPhone(event.target.value)}
                      placeholder="e.g. 0244123456"
                      className="pl-9"
                    />
                  </div>
                </div>
              ) : null}
              {needsEmail ? (
                <div className="space-y-1.5">
                  <Label htmlFor="automation-test-manual-email">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="automation-test-manual-email"
                      type="email"
                      value={manualEmail}
                      onChange={(event) => setManualEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="pl-9"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" className="bg-brand hover:bg-brand-dark" onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Run test
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
