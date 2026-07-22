import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ChevronDown, ChevronLeft, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettingsPayments } from '../../../hooks/useSettingsPayments';
import { cn } from '@/lib/utils';

/**
 * @param {'connected'|'needs_setup'|'not_connected'} status
 */
function statusBadgeProps(status) {
  if (status === 'connected') {
    return { label: 'Connected', className: 'border-[#166534]/40 bg-[#166534]/10 text-[#166534]' };
  }
  if (status === 'needs_setup') {
    return { label: 'Needs setup', className: 'border-amber-600/40 bg-amber-500/10 text-amber-800' };
  }
  return { label: 'Not connected', className: 'border-gray-200 bg-gray-50 text-muted-foreground' };
}

const SettingsPaymentsSection = () => {
  const navigate = useNavigate();
  const {
    canManageOrganization,
    safeReturnTo,
    paymentsSubTab,
    setPaymentsSection,
    paymentCollectionForm,
    loadingPaymentCollection,
    loadingBanks,
    banksLoadError,
    refetchBanks,
    filteredBanksList,
    banksList,
    paystackTxFrom,
    setPaystackTxFrom,
    paystackTxTo,
    setPaystackTxTo,
    paystackTxPage,
    setPaystackTxPage,
    paystackTxPayload,
    loadingPaystackTx,
    paystackTxIsError,
    paystackTxError,
    refetchPaystackTx,
    paymentVerifyPassword,
    setPaymentVerifyPassword,
    paymentVerifyOtp,
    setPaymentVerifyOtp,
    paymentOtpSending,
    paymentOtpSent,
    paymentVerifyModalOpen,
    setPaymentVerifyModalOpen,
    paymentVerificationDone,
    paymentPasswordVerifying,
    bankSelectOpen,
    setBankSelectOpen,
    bankSearchQuery,
    setBankSearchQuery,
    mtnCredForm,
    setMtnCredForm,
    mtnShowAdvancedKeys,
    setMtnShowAdvancedKeys,
    mtnOtp,
    setMtnOtp,
    mtnGatePassword,
    setMtnGatePassword,
    mtnSaving,
    mtnTesting,
    mtnDisconnecting,
    hubtelCredForm,
    setHubtelCredForm,
    hubtelOtp,
    setHubtelOtp,
    hubtelGatePassword,
    setHubtelGatePassword,
    hubtelSaving,
    hubtelTesting,
    hubtelDisconnecting,
    isGoogleUser,
    handleSendPaymentOtp,
    handleVerifyPaymentPassword,
    openPaymentVerifyModal,
    onPaymentCollectionSubmit,
    updatePaymentCollectionMutation,
    handleMtnSendOtp,
    handleMtnTest,
    handleMtnSave,
    handleMtnDisconnect,
    handleHubtelSendOtp,
    handleHubtelTest,
    handleHubtelSave,
    handleHubtelDisconnect,
    pc,
    hasPaymentSubaccount,
    isMomoLinked,
    paymentSettlementMethod,
    paymentDestinationLabel,
    paymentDestinationValue,
  } = useSettingsPayments();

  const providerCards = useMemo(() => {
    const mtn = pc?.mtn_collection;
    let merchantStatus = 'not_connected';
    if (mtn?.merchantId) {
      merchantStatus = 'connected';
    } else if (mtn?.hasApiCredentials) {
      merchantStatus = 'needs_setup';
    }

    const paystackStatus = hasPaymentSubaccount ? 'connected' : 'not_connected';

    let hubtelStatus = 'not_connected';
    if (pc?.hubtel_collection?.encryptionConfigured === false && !pc?.hubtel_collection?.configured) {
      hubtelStatus = 'needs_setup';
    } else if (pc?.hubtel_collection?.configured) {
      hubtelStatus = 'connected';
    }

    return [
      {
        id: 'merchant-id',
        title: 'Merchant ID',
        description: 'Customers pay into your MTN MoMo merchant account',
        status: merchantStatus,
      },
      {
        id: 'settlements',
        title: 'Paystack',
        description: 'Settle card and MoMo payouts via Paystack',
        status: paystackStatus,
      },
      {
        id: 'hubtel',
        title: 'Hubtel',
        description: 'Customers pay into your Hubtel account',
        status: hubtelStatus,
      },
    ];
  }, [hasPaymentSubaccount, pc]);

  if (!canManageOrganization) {
    return (
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>You need admin or manager role to manage payment collection.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      {safeReturnTo ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto mb-4"
          onClick={() => navigate(safeReturnTo)}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to store setup
        </Button>
      ) : null}
      <Card className="border border-gray-200">
        <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
          <CardTitle className="text-base md:text-2xl flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment collections
          </CardTitle>
          <CardDescription className="mt-1 md:mt-0 text-xs md:text-sm">
            Choose how customers pay this workspace. Connect a Merchant ID, Paystack settlement, or Hubtel.
            This is separate from your ABS subscription billing.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:p-6 pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {providerCards.map((card) => {
              const badge = statusBadgeProps(card.status);
              const selected = paymentsSubTab === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setPaymentsSection(card.id)}
                  className={cn(
                    'text-left rounded-lg border p-4 transition-colors min-h-[44px]',
                    'hover:border-[#166534]/50 hover:bg-[#166534]/5',
                    selected ? 'border-[#166534] bg-[#166534]/5' : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px]', badge.className)}>
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{card.description}</p>
                </button>
              );
            })}
          </div>

          <Tabs value={paymentsSubTab} onValueChange={setPaymentsSection}>
            <TabsContent value="settlements" className="mt-0 md:mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Track customer card and MoMo payments collected for this workspace, then choose where Paystack should settle your payout. ABS subscription charges are not shown here.
            </p>
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Paystack customer charges</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Money customers paid this workspace through Paystack from invoices, POS, or payment links. Open Paystack for balances, settlements, and MoMo transfer history.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="paystack-tx-from" className="text-xs">
                      From
                    </Label>
                    <Input
                      id="paystack-tx-from"
                      type="date"
                      value={paystackTxFrom}
                      onChange={(e) => setPaystackTxFrom(e.target.value)}
                      className="w-[11rem]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="paystack-tx-to" className="text-xs">
                      To
                    </Label>
                    <Input
                      id="paystack-tx-to"
                      type="date"
                      value={paystackTxTo}
                      onChange={(e) => setPaystackTxTo(e.target.value)}
                      className="w-[11rem]"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchPaystackTx()}>
                    Refresh
                  </Button>
                </div>
              </div>
              {loadingPaystackTx ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paystackTxIsError ? (
                <p className="text-sm text-destructive">
                  {paystackTxError?.response?.data?.message || paystackTxError?.message || 'Could not load Paystack data.'}
                </p>
              ) : (
                <>
                  {paystackTxPayload?.truncated ? (
                    <Alert>
                      <AlertTitle>Large result set</AlertTitle>
                      <AlertDescription>
                        Only part of Paystack&apos;s list was scanned. Use a shorter date range to include older charges.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {paystackTxPayload?.summary ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-md border border-gray-200 p-3">
                        <p className="text-xs text-muted-foreground">Successful charges</p>
                        <p className="font-semibold tabular-nums">{paystackTxPayload.summary.successfulCount}</p>
                      </div>
                      <div className="rounded-md border border-gray-200 p-3">
                        <p className="text-xs text-muted-foreground">Gross volume</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.grossVolumeMain).toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-md border border-gray-200 p-3">
                        <p className="text-xs text-muted-foreground">Fees (Paystack)</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.feesMain).toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-md border border-gray-200 p-3">
                        <p className="text-xs text-muted-foreground">Net (after fees)</p>
                        <p className="font-semibold tabular-nums">
                          {paystackTxPayload.summary.currency} {Number(paystackTxPayload.summary.netEstimateMain).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {paystackTxPayload?.disclaimer ? (
                    <p className="text-xs text-muted-foreground">{paystackTxPayload.disclaimer}</p>
                  ) : null}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paid</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(paystackTxPayload?.transactions || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground text-center py-6">
                            No matching Paystack charges in this range. Card payments from invoice or POS (with workspace metadata or subaccount) show here.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paystackTxPayload.transactions.map((row, idx) => (
                          <TableRow key={`${row.reference}-${row.paidAt || idx}`}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {row.paidAt ? dayjs(row.paidAt).format('MMM D, YYYY HH:mm') : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                            <TableCell className="capitalize">{row.channel || '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {paystackTxPayload.summary?.currency} {Number(row.amountMain).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {paystackTxPayload.summary?.currency} {Number(row.feesMain).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {paystackTxPayload?.pagination &&
                  paystackTxPayload.pagination.totalFiltered > (paystackTxPayload.pagination.perPage || 20) ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Page {paystackTxPayload.pagination.page} of{' '}
                        {Math.max(
                          1,
                          Math.ceil(
                            paystackTxPayload.pagination.totalFiltered / paystackTxPayload.pagination.perPage
                          )
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={paystackTxPage <= 1}
                          onClick={() => setPaystackTxPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            paystackTxPage >=
                            Math.ceil(
                              paystackTxPayload.pagination.totalFiltered / paystackTxPayload.pagination.perPage
                            )
                          }
                          onClick={() => setPaystackTxPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
        {loadingPaymentCollection ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <Dialog
              open={paymentVerifyModalOpen}
              onOpenChange={setPaymentVerifyModalOpen}
            >
              <DialogContent className="sm:max-w-[26rem]">
                <DialogDescription className="sr-only">Verify your identity to link bank or MoMo for receiving payments.</DialogDescription>
                <DialogHeader>
                  <DialogTitle>Verify your identity</DialogTitle>
                </DialogHeader>
                <DialogBody className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {isGoogleUser
                      ? 'Your account uses Google sign-in, so we will email a verification code instead of asking for a password.'
                      : 'Verify your password to continue.'}
                  </p>
                  {isGoogleUser ? (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendPaymentOtp}
                        disabled={paymentOtpSending}
                        className="w-full"
                      >
                        {paymentOtpSending ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                        {paymentOtpSent ? 'Send code again' : 'Send code to my email'}
                      </Button>
                      <div className="space-y-2">
                        <Label htmlFor="payment-verify-otp-modal">Email verification code</Label>
                        <Input
                          id="payment-verify-otp-modal"
                          name="payment-verification-otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={paymentVerifyOtp}
                          onChange={(e) => setPaymentVerifyOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456"
                          autoComplete="one-time-code"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="payment-verify-password-modal">Account password</Label>
                      <Input
                        id="payment-verify-password-modal"
                        name="payment-verification-password"
                        type="password"
                        value={paymentVerifyPassword}
                        onChange={(e) => setPaymentVerifyPassword(e.target.value)}
                        placeholder="•••••••••"
                        autoComplete="new-password"
                        data-form-type="other"
                        data-lpignore="true"
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={handleVerifyPaymentPassword}
                    disabled={
                      paymentPasswordVerifying ||
                      (!isGoogleUser && !paymentVerifyPassword.trim()) ||
                      (isGoogleUser && paymentVerifyOtp.replace(/\D/g, '').length !== 6)
                    }
                    className="w-full mt-2"
                  >
                    {paymentPasswordVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                    {isGoogleUser ? 'Verify code' : 'Verify password'}
                  </Button>
                </DialogBody>
              </DialogContent>
            </Dialog>
            {hasPaymentSubaccount && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <Alert>
                  <AlertTitle>Payout destination linked</AlertTitle>
                  <AlertDescription>
                    Your share of customer card and MoMo payments is settled to the linked payout destination below.
                    Contact support if you need to change it.
                  </AlertDescription>
                </Alert>
                <Descriptions>
                  <DescriptionItem label="Status">Linked</DescriptionItem>
                  <DescriptionItem label="Settlement method">{paymentSettlementMethod}</DescriptionItem>
                  <DescriptionItem label="Business / account name">{pc?.business_name || 'Not set'}</DescriptionItem>
                  <DescriptionItem label={paymentDestinationLabel}>{paymentDestinationValue}</DescriptionItem>
                  {pc?.settlement_type === 'momo' && (
                    <DescriptionItem label="MoMo provider">{pc?.momo_provider || 'Not set'}</DescriptionItem>
                  )}
                  {pc?.settlement_type === 'bank' && pc?.bank_code ? (
                    <DescriptionItem label="Bank code">{pc.bank_code}</DescriptionItem>
                  ) : null}
                  <DescriptionItem label="Contact email">{pc?.primary_contact_email || 'Not set'}</DescriptionItem>
                  <DescriptionItem label="Paystack subaccount">
                    {pc?.paystack_subaccount_code_masked || 'Linked'}
                  </DescriptionItem>
                </Descriptions>
              </div>
            )}
            {!paymentVerificationDone ? (
              <div className="space-y-4 py-4">
                {hasPaymentSubaccount ? (
                  <p className="text-sm text-muted-foreground">
                    A Paystack payout destination is already linked for this workspace. Contact support if you need to change it.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      To receive card and MoMo payments from customers, link a bank account or MoMo number. You will verify your identity in the next step.
                    </p>
                    <Button type="button" onClick={openPaymentVerifyModal}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Link payment account
                    </Button>
                  </>
                )}
              </div>
            ) : (
          <div className="space-y-4">
            {isMomoLinked && !hasPaymentSubaccount && (
              <>
                <Alert>
                  <AlertTitle>MoMo number linked</AlertTitle>
                  <AlertDescription>
                    Your share of Paystack payments is sent to your MoMo number. Provider: {pc?.momo_provider || '—'}. Number: {pc?.momo_phone_masked || '—'}. You can update the number below or switch to a bank account.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  To update, verify your identity first.{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-primary"
                    onClick={openPaymentVerifyModal}
                  >
                    Verify identity
                  </Button>
                </p>
              </>
            )}
          <Form {...paymentCollectionForm}>
            <form onSubmit={paymentCollectionForm.handleSubmit(onPaymentCollectionSubmit)} className="space-y-4">
              <FormField
                control={paymentCollectionForm.control}
                name="settlement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receive settlement via</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? 'bank'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Bank or MoMo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bank">Bank account</SelectItem>
                        <SelectItem value="momo">MoMo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Choose where to receive your share of payments.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentCollectionForm.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business / account name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Aseda Supermarket" />
                    </FormControl>
                    <FormDescription>Pre-filled from organization name when available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {paymentCollectionForm.watch('settlement_type') === 'momo' ? (
                <>
                  <FormField
                    control={paymentCollectionForm.control}
                    name="momo_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MoMo phone number *</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" inputMode="numeric" placeholder="0XXXXXXXXX or 233XXXXXXXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={paymentCollectionForm.control}
                    name="momo_provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MoMo provider *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ''}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select MoMo provider" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MTN">MTN MoMo</SelectItem>
                            <SelectItem value="AIRTEL">AirtelTigo Money</SelectItem>
                            <SelectItem value="VODAFONE">Vodafone Cash</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <>
                  <FormField
                    control={paymentCollectionForm.control}
                    name="bank_code"
                    render={({ field }) => {
                      const selectedBank = banksList.find((b) => b.code === field.value);
                      return (
                        <FormItem>
                          <FormLabel>Bank *</FormLabel>
                          <Popover open={bankSelectOpen} onOpenChange={(open) => { setBankSelectOpen(open); if (!open) setBankSearchQuery(''); }}>
                            <FormControl>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full justify-between font-normal h-10 min-h-[44px] md:min-h-[40px]"
                                >
                                  <span className={field.value ? '' : 'text-muted-foreground'}>
                                    {selectedBank ? (selectedBank.name || selectedBank.code) : 'Select bank'}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                            </FormControl>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <div className="p-2 border-b border-gray-200">
                                <Input
                                  placeholder="Search banks..."
                                  value={bankSearchQuery}
                                  onChange={(e) => setBankSearchQuery(e.target.value)}
                                  className="h-9"
                                  autoComplete="off"
                                />
                              </div>
                              <ScrollArea className="h-64">
                                <div className="p-1">
                                  {loadingBanks ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">Loading banks…</p>
                                  ) : banksLoadError || filteredBanksList.length === 0 ? (
                                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                                      <p className="mb-2">
                                        {banksLoadError
                                          ? 'Could not load banks.'
                                          : bankSearchQuery
                                            ? 'No banks match your search.'
                                            : 'Bank list unavailable. Use MoMo to receive payments, or try again later.'}
                                      </p>
                                      <Button type="button" variant="outline" size="sm" onClick={() => refetchBanks()}>
                                        Try again
                                      </Button>
                                    </div>
                                  ) : (
                                    filteredBanksList.map((bank, idx) => (
                                      <button
                                        key={bank.id ?? `bank-${bank.code}-${idx}`}
                                        type="button"
                                        className="flex w-full cursor-pointer items-center rounded-sm py-2 px-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                        onClick={() => {
                                          field.onChange(String(bank.code));
                                          paymentCollectionForm.setValue('bank_name', bank.name || '');
                                          setBankSelectOpen(false);
                                        }}
                                      >
                                        {bank.name || bank.code}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={paymentCollectionForm.control}
                    name="account_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account number *</FormLabel>
                        <FormControl>
                          <Input {...field} type="text" inputMode="numeric" placeholder="e.g. 0123456789" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <FormField
                control={paymentCollectionForm.control}
                name="primary_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact email (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="you@example.com" />
                    </FormControl>
                    <FormDescription>Pre-filled from business/organization details when available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={
                  updatePaymentCollectionMutation.isPending ||
                  (!isGoogleUser && !paymentVerifyPassword.trim())
                }
              >
                {updatePaymentCollectionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : paymentCollectionForm.watch('settlement_type') === 'momo' ? (
                  'Save MoMo destination'
                ) : (
                  'Save bank destination'
                )}
              </Button>
            </form>
          </Form>
        </div>
        )}
          </>
        )}
          </TabsContent>

            <TabsContent value="merchant-id" className="mt-0 md:mt-1 space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your MTN MoMo Merchant ID so customers can pay into your merchant account from POS and invoices.
              </p>
              {loadingPaymentCollection ? (
                <div className="flex items-center justify-center py-6 md:py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {pc?.mtn_collection?.encryptionConfigured === false && (
                    <Alert variant="destructive">
                      <AlertTitle>Server not ready for API credentials</AlertTitle>
                      <AlertDescription>
                        You can still save your Merchant ID. To store Collection API keys for automated Request-to-Pay, the host must set{' '}
                        <code className="text-xs">MOMO_CREDENTIALS_ENCRYPTION_KEY</code> (64 hex characters).
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <AlertTitle>Merchant connection</AlertTitle>
                    <AlertDescription>
                      {pc?.mtn_collection?.merchantId ? (
                        <>
                          Connected Merchant ID: <strong>{pc.mtn_collection.merchantId}</strong>
                          {pc.mtn_collection.hasApiCredentials
                            ? ' · Automated collection credentials are saved.'
                            : ' · Add API credentials below if you want automated Request-to-Pay.'}
                        </>
                      ) : pc?.mtn_collection?.hasApiCredentials ? (
                        <>API credentials are saved, but add your Merchant ID to finish connecting.</>
                      ) : pc?.mtn_collection?.activeSource === 'platform' ? (
                        <>No Merchant ID yet. Platform MTN keys may still collect if configured on the server.</>
                      ) : (
                        <>No Merchant ID connected yet. Enter yours below to get started.</>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="mtn-merchant-id">Merchant ID</Label>
                    <Input
                      id="mtn-merchant-id"
                      name="mtn-merchant-id"
                      type="text"
                      autoComplete="off"
                      value={mtnCredForm.merchantId}
                      onChange={(e) => setMtnCredForm((f) => ({ ...f, merchantId: e.target.value }))}
                      placeholder="Paste your MTN MoMo Merchant ID"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      Find this in your MTN MoMo Business / merchant portal. This is the main identity for your workspace.
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                      onClick={() => setMtnShowAdvancedKeys((v) => !v)}
                    >
                      <span>API credentials for automated collection (optional)</span>
                      <ChevronDown className={cn('h-4 w-4 transition-transform', mtnShowAdvancedKeys && 'rotate-180')} />
                    </button>
                    {mtnShowAdvancedKeys ? (
                      <div className="space-y-3 border-t border-gray-200 px-4 py-4">
                        <p className="text-xs text-muted-foreground">
                          Required only for automated Request-to-Pay from ABS. Get these from the MTN MoMo Developer portal for your merchant.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-subscription-key">Subscription Key</Label>
                          <Input
                            id="mtn-subscription-key"
                            type="password"
                            autoComplete="off"
                            value={mtnCredForm.subscriptionKey}
                            onChange={(e) => setMtnCredForm((f) => ({ ...f, subscriptionKey: e.target.value }))}
                            placeholder="From MTN MoMo Developer portal"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-api-user">API User (UUID)</Label>
                          <Input
                            id="mtn-api-user"
                            type="text"
                            autoComplete="off"
                            value={mtnCredForm.apiUser}
                            onChange={(e) => setMtnCredForm((f) => ({ ...f, apiUser: e.target.value }))}
                            placeholder="API user UUID"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-api-key">API Key</Label>
                          <Input
                            id="mtn-api-key"
                            type="password"
                            autoComplete="off"
                            value={mtnCredForm.apiKey}
                            onChange={(e) => setMtnCredForm((f) => ({ ...f, apiKey: e.target.value }))}
                            placeholder="API key"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-environment">Environment</Label>
                          <Select
                            value={mtnCredForm.environment}
                            onValueChange={(v) => setMtnCredForm((f) => ({ ...f, environment: v }))}
                          >
                            <SelectTrigger id="mtn-environment">
                              <SelectValue placeholder="Sandbox or production" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sandbox">Sandbox</SelectItem>
                              <SelectItem value="production">Production</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-collection-url">Collection API URL (optional)</Label>
                          <Input
                            id="mtn-collection-url"
                            type="url"
                            autoComplete="off"
                            value={mtnCredForm.collectionApiUrl}
                            onChange={(e) => setMtnCredForm((f) => ({ ...f, collectionApiUrl: e.target.value }))}
                            placeholder="Override collection base URL if needed"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mtn-callback-url">Callback URL (optional)</Label>
                          <Input
                            id="mtn-callback-url"
                            type="url"
                            autoComplete="off"
                            value={mtnCredForm.callbackUrl}
                            onChange={(e) => setMtnCredForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                            placeholder="Webhook callback if different from default"
                            data-form-type="other"
                            data-lpignore="true"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!isGoogleUser && (
                    <div className="space-y-2">
                      <Label htmlFor="mtn-gate-password">Account password</Label>
                      <Input
                        id="mtn-gate-password"
                        type="password"
                        autoComplete="current-password"
                        value={mtnGatePassword}
                        onChange={(e) => setMtnGatePassword(e.target.value)}
                        placeholder="Required to send verification code"
                        data-form-type="other"
                        data-lpignore="true"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleMtnSendOtp}>
                      Send verification code
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mtn-otp">Verification code</Label>
                    <Input
                      id="mtn-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={mtnOtp}
                      onChange={(e) => setMtnOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code from email"
                      className="max-w-[12rem] tabular-nums tracking-widest"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {pc?.mtn_collection?.configured || pc?.mtn_collection?.merchantId ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleMtnDisconnect}
                        disabled={mtnDisconnecting}
                      >
                        {mtnDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                        Disconnect
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleMtnTest}
                      disabled={
                        mtnTesting ||
                        pc?.mtn_collection?.encryptionConfigured === false ||
                        !mtnCredForm.subscriptionKey ||
                        !mtnCredForm.apiUser ||
                        !mtnCredForm.apiKey
                      }
                    >
                      {mtnTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                      Test connection
                    </Button>
                    <Button type="button" onClick={handleMtnSave} disabled={mtnSaving || !mtnCredForm.merchantId.trim()}>
                      {mtnSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                      Connect Merchant ID
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connect your Merchant ID with the email verification code. API credentials are optional and only needed for automated collection.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="hubtel" className="mt-0 md:mt-1 space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Hubtel merchant so customers can pay into your Hubtel account. Use Client ID and Client Secret from your Hubtel API account.
              </p>
              {loadingPaymentCollection ? (
                <div className="flex items-center justify-center py-6 md:py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {pc?.hubtel_collection?.encryptionConfigured === false && (
                    <Alert variant="destructive">
                      <AlertTitle>Server not ready for Hubtel keys</AlertTitle>
                      <AlertDescription>
                        The host must set <code className="text-xs">MOMO_CREDENTIALS_ENCRYPTION_KEY</code> (64 hex characters) before
                        Hubtel credentials can be stored.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Alert>
                    <AlertTitle>Hubtel status</AlertTitle>
                    <AlertDescription>
                      {pc?.hubtel_collection?.configured ? (
                        <>
                          Connected. Client ID: <strong>{pc.hubtel_collection.clientIdMasked || '—'}</strong>
                          {pc.hubtel_collection.merchantAccountNumber
                            ? ` · Merchant account: ${pc.hubtel_collection.merchantAccountNumber}`
                            : ''}
                          {pc.hubtel_collection.posSalesId
                            ? ` · POS Sales ID: ${pc.hubtel_collection.posSalesId}`
                            : ''}
                        </>
                      ) : (
                        <>Not connected. Enter your Hubtel Client ID and Client Secret below.</>
                      )}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="hubtel-client-id">Client ID</Label>
                    <Input
                      id="hubtel-client-id"
                      type="text"
                      autoComplete="off"
                      value={hubtelCredForm.clientId}
                      onChange={(e) => setHubtelCredForm((f) => ({ ...f, clientId: e.target.value }))}
                      placeholder="Hubtel Client ID"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubtel-client-secret">Client Secret</Label>
                    <Input
                      id="hubtel-client-secret"
                      type="password"
                      autoComplete="off"
                      value={hubtelCredForm.clientSecret}
                      onChange={(e) => setHubtelCredForm((f) => ({ ...f, clientSecret: e.target.value }))}
                      placeholder="Hubtel Client Secret"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubtel-merchant-account">Merchant account number (optional)</Label>
                    <Input
                      id="hubtel-merchant-account"
                      type="text"
                      autoComplete="off"
                      value={hubtelCredForm.merchantAccountNumber}
                      onChange={(e) => setHubtelCredForm((f) => ({ ...f, merchantAccountNumber: e.target.value }))}
                      placeholder="e.g. HM2707170067"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubtel-pos-sales-id">POS Sales ID (optional)</Label>
                    <Input
                      id="hubtel-pos-sales-id"
                      type="text"
                      autoComplete="off"
                      value={hubtelCredForm.posSalesId}
                      onChange={(e) => setHubtelCredForm((f) => ({ ...f, posSalesId: e.target.value }))}
                      placeholder="Used for Receive Money / POS collections"
                      data-form-type="other"
                      data-lpignore="true"
                    />
                  </div>

                  {!isGoogleUser && (
                    <div className="space-y-2">
                      <Label htmlFor="hubtel-gate-password">Account password</Label>
                      <Input
                        id="hubtel-gate-password"
                        type="password"
                        autoComplete="current-password"
                        value={hubtelGatePassword}
                        onChange={(e) => setHubtelGatePassword(e.target.value)}
                        placeholder="Required to send verification code"
                        data-form-type="other"
                        data-lpignore="true"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleHubtelSendOtp}>
                      Send verification code
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hubtel-otp">Verification code</Label>
                    <Input
                      id="hubtel-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={hubtelOtp}
                      onChange={(e) => setHubtelOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code from email"
                      className="max-w-[12rem] tabular-nums tracking-widest"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {pc?.hubtel_collection?.configured ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleHubtelDisconnect}
                        disabled={hubtelDisconnecting || pc?.hubtel_collection?.encryptionConfigured === false}
                      >
                        {hubtelDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                        Disconnect
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleHubtelTest}
                      disabled={hubtelTesting || pc?.hubtel_collection?.encryptionConfigured === false}
                    >
                      {hubtelTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                      Test connection
                    </Button>
                    <Button
                      type="button"
                      onClick={handleHubtelSave}
                      disabled={hubtelSaving || pc?.hubtel_collection?.encryptionConfigured === false}
                    >
                      {hubtelSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                      Save credentials
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Test, save, and disconnect require the email verification code. Saving replaces previously stored Hubtel credentials.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
};

export default SettingsPaymentsSection;
