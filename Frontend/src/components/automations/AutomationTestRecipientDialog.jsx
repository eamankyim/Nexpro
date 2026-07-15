import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Mail, Phone, Search, User, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import customerService from '../../services/customerService';
import employeeService from '../../services/employeeService';
import userService from '../../services/userService';
import { useDebounce } from '../../hooks/useDebounce';
import { DEBOUNCE_DELAYS } from '../../constants';
import { isStaffAutomationAudience, messagingActionRequirements } from '../../utils/automationForm';
import { validatePhone } from '../../utils/phoneUtils';
import { showError } from '../../utils/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const CARD_BORDER = { border: '1px solid #e5e7eb' };

function membershipRole(user) {
  const membership = Array.isArray(user?.tenantMemberships) ? user.tenantMemberships[0] : null;
  return membership?.role || user?.role || '';
}

/**
 * Prompt for a real recipient before running messaging automation tests.
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function(boolean): void} props.onOpenChange
 * @param {Record<string, unknown>[]} props.actionRows
 * @param {string} [props.triggerType]
 * @param {boolean} props.isSubmitting
 * @param {function(Record<string, unknown>): void} props.onConfirm
 */
export default function AutomationTestRecipientDialog({
  open,
  onOpenChange,
  actionRows,
  triggerType = '',
  isSubmitting = false,
  onConfirm,
}) {
  const { activeTenantId } = useAuth();
  const isStaffAudience = useMemo(
    () => isStaffAutomationAudience({ triggerType, actionRows }),
    [triggerType, actionRows]
  );
  const { needsPhone, needsEmail } = useMemo(
    () => messagingActionRequirements(actionRows),
    [actionRows]
  );

  const pickerMode = isStaffAudience ? 'member' : 'customer';
  const [mode, setMode] = useState(pickerMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  const debouncedSearch = useDebounce(searchQuery, DEBOUNCE_DELAYS.SEARCH);

  const customersQuery = useQuery({
    queryKey: ['automations', 'test-recipient-customers', activeTenantId, debouncedSearch],
    queryFn: () => {
      const params = { limit: 25, isActive: true };
      const search = debouncedSearch.trim();
      if (search) params.search = search;
      return customerService.getCustomers(params);
    },
    enabled: open && !isStaffAudience && mode === 'customer' && !!activeTenantId,
  });

  const membersQuery = useQuery({
    queryKey: ['automations', 'test-recipient-members', activeTenantId, debouncedSearch],
    queryFn: () => {
      const params = { limit: 50 };
      const search = debouncedSearch.trim();
      if (search) params.search = search;
      return userService.getAll(params);
    },
    enabled: open && isStaffAudience && mode === 'member' && !!activeTenantId,
  });

  const employeesQuery = useQuery({
    queryKey: ['automations', 'test-recipient-employee-phones', activeTenantId],
    queryFn: () => employeeService.getEmployees({ status: 'active', limit: 500 }),
    enabled: open && isStaffAudience && needsPhone && !!activeTenantId,
  });

  const customers = useMemo(() => {
    const data = customersQuery.data?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.customers)) return data.customers;
    if (Array.isArray(customersQuery.data?.customers)) return customersQuery.data.customers;
    return [];
  }, [customersQuery.data]);

  const phoneByUserId = useMemo(() => {
    const map = new Map();
    const data = employeesQuery.data?.data;
    const employees = Array.isArray(data)
      ? data
      : (Array.isArray(data?.employees) ? data.employees : []);
    for (const employee of employees) {
      if (!employee?.userId || !employee?.phone) continue;
      if (!map.has(employee.userId)) {
        map.set(employee.userId, String(employee.phone).trim());
      }
    }
    return map;
  }, [employeesQuery.data]);

  const members = useMemo(() => {
    const payload = membersQuery.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
    return rows.map((user) => ({
      ...user,
      phone: phoneByUserId.get(user.id) || user.phone || '',
      role: membershipRole(user),
    }));
  }, [membersQuery.data, phoneByUserId]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const resetForm = useCallback(() => {
    setMode(isStaffAudience ? 'member' : 'customer');
    setSearchQuery('');
    setSelectedCustomerId('');
    setSelectedMemberId('');
    setManualName('');
    setManualPhone('');
    setManualEmail('');
  }, [isStaffAudience]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (open) setMode(isStaffAudience ? 'member' : 'customer');
  }, [open, isStaffAudience]);

  const buildRecipient = useCallback(() => {
    if (isStaffAudience) {
      if (mode === 'member') {
        if (!selectedMember) return null;
        return {
          userId: selectedMember.id,
          name: selectedMember.name || selectedMember.email || 'Team member',
          email: selectedMember.email || '',
          phone: selectedMember.phone || '',
          audience: 'internal',
          forceTestRecipient: true,
        };
      }

      return {
        name: manualName.trim() || 'Test Staff',
        phone: manualPhone.trim(),
        email: manualEmail.trim(),
        audience: 'internal',
        forceTestRecipient: true,
      };
    }

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
  }, [
    isStaffAudience,
    mode,
    selectedMember,
    selectedCustomer,
    manualName,
    manualPhone,
    manualEmail,
  ]);

  const handleConfirm = useCallback(() => {
    const recipient = buildRecipient();
    if (!recipient) {
      showError(isStaffAudience ? 'Select a team member to run this test.' : 'Select a customer to run this test.');
      return;
    }

    if (needsPhone) {
      const phone = String(recipient.phone || '').trim();
      if (!phone) {
        showError(
          isStaffAudience
            ? 'Enter a phone number for this SMS/WhatsApp test (or pick a member with an Employee phone).'
            : 'Enter a phone number for this SMS/WhatsApp test.'
        );
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
        showError(
          isStaffAudience
            ? 'Enter an email address for this email test (or pick a member with an email).'
            : 'Enter an email address for this email test.'
        );
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('Enter a valid email address.');
        return;
      }
      recipient.email = email;
    }

    onConfirm(recipient);
  }, [buildRecipient, isStaffAudience, needsEmail, needsPhone, onConfirm]);

  const requirementText = useMemo(() => {
    if (isStaffAudience) {
      if (needsPhone && needsEmail) return 'Choose which team member should receive the test SMS/WhatsApp and email.';
      if (needsPhone) return 'Choose which team member should receive the test SMS or WhatsApp message.';
      if (needsEmail) return 'Choose which team member should receive the test email.';
      return 'Choose a team member for this test run.';
    }
    if (needsPhone && needsEmail) return 'Choose who should receive the test SMS/WhatsApp and email.';
    if (needsPhone) return 'Choose who should receive the test SMS or WhatsApp message.';
    if (needsEmail) return 'Choose who should receive the test email.';
    return 'Choose a recipient for this test run.';
  }, [isStaffAudience, needsEmail, needsPhone]);

  const listLoading = isStaffAudience ? membersQuery.isLoading : customersQuery.isLoading;
  const listEmpty = isStaffAudience ? members.length === 0 : customers.length === 0;

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
            {isStaffAudience ? (
              <label
                htmlFor="automation-test-mode-member"
                className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                style={CARD_BORDER}
              >
                <RadioGroupItem id="automation-test-mode-member" value="member" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Select a team member</p>
                  <p className="text-xs text-muted-foreground">
                    Use a workspace user email{needsPhone ? ' (and Employee phone for SMS/WhatsApp)' : ''}.
                  </p>
                </div>
              </label>
            ) : (
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
            )}
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

          {mode === 'member' && isStaffAudience ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="automation-test-member-search">Search team members</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="automation-test-member-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name or email"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl p-2" style={CARD_BORDER}>
                {listLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Loading team members...
                  </div>
                ) : listEmpty ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No team members found.</p>
                ) : (
                  members.map((member) => {
                    const isSelected = member.id === selectedMemberId;
                    const roleLabel = member.role ? String(member.role) : '';
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-[#166534] bg-emerald-50'
                            : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">
                          {member.name || member.email || 'Team member'}
                          {roleLabel ? (
                            <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{roleLabel}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[member.email, needsPhone ? member.phone : null].filter(Boolean).join(' · ') || 'No contact details'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedMember ? (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700" style={CARD_BORDER}>
                  <p className="font-medium text-foreground">{selectedMember.name || selectedMember.email}</p>
                  {needsPhone ? (
                    <p className="mt-1 flex items-center gap-2 text-xs">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {selectedMember.phone || 'No Employee phone on file'}
                    </p>
                  ) : null}
                  {needsEmail ? (
                    <p className="mt-1 flex items-center gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {selectedMember.email || 'No email on file'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === 'customer' && !isStaffAudience ? (
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
                {listLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Loading customers...
                  </div>
                ) : listEmpty ? (
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
          ) : null}

          {mode === 'manual' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="automation-test-manual-name">
                  {isStaffAudience ? 'Name (optional)' : 'Customer name'}
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="automation-test-manual-name"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder={isStaffAudience ? 'e.g. Ama Mensah' : 'e.g. Kofi Mensah'}
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
          ) : null}

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
