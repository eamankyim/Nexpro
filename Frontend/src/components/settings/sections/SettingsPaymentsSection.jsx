import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ChevronDown, ChevronLeft, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useResponsive } from '../../../hooks/useResponsive';
import { useSettingsPayments } from '../../../hooks/useSettingsPayments';

const SettingsPaymentsSection = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
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
    mtnOtp,
    setMtnOtp,
    mtnGatePassword,
    setMtnGatePassword,
    mtnSaving,
    mtnTesting,
    mtnDisconnecting,
    isGoogleUser,
    handleSendPaymentOtp,
    handleVerifyPaymentPassword,
    onPaymentCollectionSubmit,
    updatePaymentCollectionMutation,
    handleMtnSendOtp,
    handleMtnTest,
    handleMtnSave,
    handleMtnDisconnect,
    pc,
    hasPaymentSubaccount,
    isMomoLinked,
    paymentAlreadyLinked,
    paymentSettlementMethod,
    paymentDestinationLabel,
    paymentDestinationValue,
  } = useSettingsPayments();

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
          Manage how customers pay this workspace through Paystack, MoMo, invoices, and POS. This is separate from your ABS subscription billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0">
        <Tabs
          value={paymentsSubTab}
          onValueChange={setPaymentsSection}
        >
          {isMobile ? (
            <Select
              value={paymentsSubTab}
              onValueChange={setPaymentsSection}
            >
              <SelectTrigger className="w-full mb-2 md:mb-4">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="settlements">Paystack settlement</SelectItem>
                <SelectItem value="mtn-collection">MTN MoMo API (direct)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="settlements" className="text-xs md:text-sm">
                Paystack settlement
              </TabsTrigger>
              <TabsTrigger value="mtn-collection" className="text-xs md:text-sm">
                MTN MoMo API
              </TabsTrigger>
            </TabsList>
          )}
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
            {paymentAlreadyLinked && (
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <Alert>
                  <AlertTitle>Payout destination linked</AlertTitle>
                  <AlertDescription>
                    Your share of customer card and MoMo payments is settled to the linked payout destination below.
                    Verify your identity to change it.
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
                    {hasPaymentSubaccount ? pc?.paystack_subaccount_code_masked || 'Linked' : 'Not linked'}
                  </DescriptionItem>
                </Descriptions>
              </div>
            )}
            {!paymentVerificationDone ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {paymentAlreadyLinked
                    ? 'Verify your identity to update the linked bank account or MoMo number for customer payment collections.'
                    : 'To receive card and MoMo payments from customers, link a bank account or MoMo number. You will verify your identity in the next step.'}
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    setPaymentVerifyPassword('');
                    setPaymentVerifyOtp('');
                    setPaymentOtpSent(false);
                    setPaymentVerifyModalOpen(true);
                  }}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {paymentAlreadyLinked ? 'Verify identity to change' : 'Link payment account'}
                </Button>
              </div>
            ) : (
          <div className="space-y-4">
            {isMomoLinked && (
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
                    onClick={() => {
                      setPaymentVerifyPassword('');
                      setPaymentVerifyOtp('');
                      setPaymentOtpSent(false);
                      setPaymentVerifyModalOpen(true);
                    }}
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
          <TabsContent value="mtn-collection" className="mt-0 md:mt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Direct MTN Request-to-Pay for POS and invoice “Pay with MoMo”. Workspace keys override platform MTN environment variables when saved.
            </p>
        {loadingPaymentCollection ? (
          <div className="flex items-center justify-center py-6 md:py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {pc?.mtn_collection?.encryptionConfigured === false && (
              <Alert variant="destructive">
                <AlertTitle>Server not ready for workspace MTN keys</AlertTitle>
                <AlertDescription>
                  The host must set <code className="text-xs">MOMO_CREDENTIALS_ENCRYPTION_KEY</code> (64 hex characters, e.g.{' '}
                  <code className="text-xs">openssl rand -hex 32</code>) before credentials can be stored.
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertTitle>Active MTN source</AlertTitle>
              <AlertDescription>
                {pc?.mtn_collection?.activeSource === 'tenant' && (
                  <>
                    This workspace&apos;s encrypted credentials are in use.
                    {pc.mtn_collection.subscriptionKeyMasked || pc.mtn_collection.apiUserMasked ? (
                      <>
                        {' '}
                        Subscription key: <strong>{pc.mtn_collection.subscriptionKeyMasked || '—'}</strong> · API user:{' '}
                        <strong>{pc.mtn_collection.apiUserMasked || '—'}</strong>
                      </>
                    ) : null}
                  </>
                )}
                {pc?.mtn_collection?.activeSource === 'platform' && (
                  <>Platform MTN env is active (no workspace keys or keys could not be read).</>
                )}
                {pc?.mtn_collection?.activeSource === 'none' && (
                  <>No MTN collection is configured. Add workspace keys below or configure platform MTN env.</>
                )}
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="mtn-subscription-key">Subscription Key</Label>
              <Input
                id="mtn-subscription-key"
                name="mtn-subscription-key"
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
                name="mtn-api-user"
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
                name="mtn-api-key"
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
                name="mtn-collection-url"
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
                name="mtn-callback-url"
                type="url"
                autoComplete="off"
                value={mtnCredForm.callbackUrl}
                onChange={(e) => setMtnCredForm((f) => ({ ...f, callbackUrl: e.target.value }))}
                placeholder="Webhook callback if different from default"
                data-form-type="other"
                data-lpignore="true"
              />
            </div>
            {!isGoogleUser && (
              <div className="space-y-2">
                <Label htmlFor="mtn-gate-password">Account password</Label>
                <Input
                  id="mtn-gate-password"
                  name="mtn-gate-password"
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
                name="mtn-otp"
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
              {pc?.mtn_collection?.configured ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleMtnDisconnect}
                  disabled={mtnDisconnecting || pc?.mtn_collection?.encryptionConfigured === false}
                >
                  {mtnDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                  Remove workspace keys
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={handleMtnTest}
                disabled={mtnTesting || pc?.mtn_collection?.encryptionConfigured === false}
              >
                {mtnTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                Test connection
              </Button>
              <Button
                type="button"
                onClick={handleMtnSave}
                disabled={mtnSaving || pc?.mtn_collection?.encryptionConfigured === false}
              >
                {mtnSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
                Save credentials
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Test, save, and remove require the email verification code. Test and save need all three secrets each time; saving replaces any previously stored workspace keys.
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
