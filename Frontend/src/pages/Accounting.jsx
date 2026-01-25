import { useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { showSuccess, showError } from '../utils/toast';
// Removed Ant Design imports - using shadcn/ui only
import { Plus, RefreshCw, Eye, Loader2, MinusCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import accountingService from '../services/accountingService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import TableSkeleton from '../components/TableSkeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required'),
  name: z.string().min(1, 'Account name is required'),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense', 'cogs', 'other']),
  category: z.string().optional(),
  description: z.string().optional(),
});

const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional(),
}).refine((data) => (data.debit > 0 && data.credit === 0) || (data.debit === 0 && data.credit > 0), {
  message: 'Either debit or credit must be greater than 0, but not both',
  path: ['debit'],
});

const journalEntrySchema = z.object({
  date: z.date({ required_error: 'Date is required' }),
  reference: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  lines: z.array(journalLineSchema).min(2, 'At least 2 journal lines required'),
}).refine((data) => {
  const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  return Math.abs(totalDebits - totalCredits) < 0.01; // Allow small floating point differences
}, {
  message: 'Total debits must equal total credits',
  path: ['lines'],
});

const accountTypeLabels = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
  cogs: 'Cost of Goods Sold',
  other: 'Other'
};


const Accounting = () => {
  const queryClient = useQueryClient();
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [journalModalVisible, setJournalModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDrawerVisible, setAccountDrawerVisible] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null);
  const [journalDrawerVisible, setJournalDrawerVisible] = useState(false);

  const accountForm = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: '',
      name: '',
      type: 'asset',
      category: '',
      description: '',
    },
  });

  const journalForm = useForm({
    resolver: zodResolver(journalEntrySchema),
    defaultValues: {
      date: new Date(),
      reference: '',
      description: '',
      lines: [{ accountId: '', debit: 0, credit: 0, description: '' }],
    },
  });

  const { fields: journalFields, append: appendJournalLine, remove: removeJournalLine } = useFieldArray({
    control: journalForm.control,
    name: 'lines',
  });

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountingService.getAccounts()
  });

  const journalQuery = useQuery({
    queryKey: ['journalEntries'],
    queryFn: () => accountingService.getJournalEntries()
  });

  const trialBalanceQuery = useQuery({
    queryKey: ['trialBalance'],
    queryFn: () => accountingService.getTrialBalance()
  });

  const createAccountMutation = useMutation({
    mutationFn: accountingService.createAccount,
    onSuccess: () => {
      showSuccess('Account created');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setAccountModalVisible(false);
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to create account');
    }
  });

  const createJournalMutation = useMutation({
    mutationFn: accountingService.createJournalEntry,
    onSuccess: () => {
      showSuccess('Journal entry created');
      queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
      queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
      setJournalModalVisible(false);
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to create journal entry');
    }
  });

  const accounts = accountsQuery.data?.data || [];
  const journalEntries = journalQuery.data?.data || [];
  const trialBalance = trialBalanceQuery.data?.data || [];
  const totals = trialBalanceQuery.data?.summary || { debit: 0, credit: 0 };

  const handleViewAccount = (account) => {
    setSelectedAccount(account);
    setAccountDrawerVisible(true);
  };

  const handleOpenAccountModal = () => {
    accountForm.reset();
    setAccountModalVisible(true);
  };

  const handleOpenJournalModal = () => {
    journalForm.reset();
    setJournalModalVisible(true);
  };

  const onSubmitAccount = (data) => {
    createAccountMutation.mutate(data);
  };

  const onSubmitJournal = (data) => {
    createJournalMutation.mutate(data);
  };

  const accountColumns = useMemo(() => [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (value) => accountTypeLabels[value] || value
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (value) => value || '—'
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value) => <Badge className={value ? 'bg-green-600' : 'bg-red-600'}>{value ? 'Active' : 'Inactive'}</Badge>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewAccount(record);
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      )
    }
  ], []);

  const handleViewJournalEntry = async (id) => {
    try {
      const response = await accountingService.getJournalEntry(id);
      setSelectedJournalEntry(response.data || response);
      setJournalDrawerVisible(true);
    } catch (error) {
      showError(null, 'Failed to load journal entry');
    }
  };

  // Helper function to render table from columns and dataSource
  const renderTable = (columns, dataSource, rowKey = 'id', options = {}) => {
    const { pagination: tablePagination, summary } = options;
    const pageSize = tablePagination?.pageSize || 10;
    const current = tablePagination?.current || 1;
    const total = tablePagination?.total || dataSource?.length || 0;
    const showPagination = tablePagination !== false && total > pageSize;
    
    const startIndex = (current - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = showPagination ? (dataSource?.slice(startIndex, endIndex) || []) : (dataSource || []);

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead 
                  key={col.key || col.dataIndex} 
                  style={{ width: col.width, textAlign: col.align }}
                >
                  {col.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((record) => (
                <TableRow key={record[rowKey]}>
                  {columns.map((col) => {
                    const value = col.dataIndex 
                      ? (Array.isArray(col.dataIndex) 
                          ? col.dataIndex.reduce((obj, key) => obj?.[key], record)
                          : record[col.dataIndex])
                      : null;
                    const renderedValue = col.render ? col.render(value, record) : value;
                    return (
                      <TableCell 
                        key={col.key || col.dataIndex}
                        style={{ textAlign: col.align }}
                      >
                        {renderedValue}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
          {summary && (
            <TableFooter>
              <TableRow>
                {summary(paginatedData)}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    );
  };

  const journalColumns = useMemo(() => [
    {
      title: 'Date',
      dataIndex: 'entryDate',
      key: 'entryDate',
      render: (value) => dayjs(value).format('MMM DD, YYYY')
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference'
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (value) => <Badge className={value === 'posted' ? 'bg-green-600' : 'bg-gray-600'}>{value.toUpperCase()}</Badge>
    },
    {
      title: 'Lines',
      dataIndex: 'lines',
      key: 'lines',
      render: (lines) => (
        <div>
          {lines && lines.length > 0 ? (
            <>
              {lines.slice(0, 2).map((line) => (
                <div key={line.id}>
                  <strong>{line.account?.code}</strong> — {line.account?.name}{' '}
                  <span className="text-muted-foreground">
                    {line.debit > 0 ? `Debit GHS ${parseFloat(line.debit).toFixed(2)}` : `Credit GHS ${parseFloat(line.credit).toFixed(2)}`}
                  </span>
                </div>
              ))}
              {lines.length > 2 && (
                <span className="text-muted-foreground text-xs">
                  +{lines.length - 2} more line{lines.length - 2 > 1 ? 's' : ''}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">No lines</span>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewJournalEntry(record.id);
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      )
    }
  ], []);

  const trialColumns = useMemo(() => [
    {
      title: 'Account',
      key: 'account',
      render: (_, record) => (
        <div>
          <strong>{record.account?.code}</strong> — {record.account?.name}
        </div>
      )
    },
    {
      title: 'Debit',
      dataIndex: 'debit',
      key: 'debit',
      align: 'right',
      render: (value) => (value ? `GHS ${parseFloat(value).toFixed(2)}` : '—')
    },
    {
      title: 'Credit',
      dataIndex: 'credit',
      key: 'credit',
      align: 'right',
      render: (value) => (value ? `GHS ${parseFloat(value).toFixed(2)}` : '—')
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (value) => `GHS ${parseFloat(value || 0).toFixed(2)}`
    }
  ], []);

  const accountOptions = accounts.map((account) => ({
    label: `${account.code} — ${account.name}`,
    value: account.id
  }));


  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Accounting</h1>
          <p className="text-muted-foreground">Manage your chart of accounts, journal entries, and trial balance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['journalEntries'] });
            queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleOpenAccountModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Account
          </Button>
          <Button onClick={handleOpenJournalModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Journal Entry
          </Button>
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          {accountsQuery.isLoading ? (
            <Card>
              <div className="p-4">
                <TableSkeleton rows={8} cols={5} />
              </div>
            </Card>
          ) : (
            renderTable(accountColumns, accounts, 'id')
          )}
        </TabsContent>
        <TabsContent value="journal">
          {journalQuery.isLoading ? (
            <Card>
              <div className="p-4">
                <TableSkeleton rows={8} cols={5} />
              </div>
            </Card>
          ) : (
            renderTable(journalColumns, journalEntries, 'id')
          )}
        </TabsContent>
        <TabsContent value="trial">
          {trialBalanceQuery.isLoading ? (
            <Card>
              <div className="p-4">
                <TableSkeleton rows={8} cols={4} />
              </div>
            </Card>
          ) : (
            <>
              {renderTable(trialColumns, trialBalance, 'id', {
                pagination: false,
                summary: () => (
                  <>
                    <TableCell><strong>Total</strong></TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <strong>GHS {parseFloat(totals.debit || 0).toFixed(2)}</strong>
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <strong>GHS {parseFloat(totals.credit || 0).toFixed(2)}</strong>
                    </TableCell>
                    <TableCell />
                  </>
                )
              })}
              <Separator className="my-6" />
              <Descriptions column={2}>
                <DescriptionItem label="Total Debit">GHS {parseFloat(totals.debit || 0).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Total Credit">GHS {parseFloat(totals.credit || 0).toFixed(2)}</DescriptionItem>
                <DescriptionItem label="Balanced?">
                  <Badge className={Math.abs((totals.debit || 0) - (totals.credit || 0)) < 0.01 ? 'bg-green-600' : 'bg-red-600'}>
                    {Math.abs((totals.debit || 0) - (totals.credit || 0)) < 0.01 ? 'Yes' : 'No'}
                  </Badge>
                </DescriptionItem>
              </Descriptions>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={accountDrawerVisible} onOpenChange={(open) => {
        if (!open) {
          setAccountDrawerVisible(false);
          setSelectedAccount(null);
        }
      }}>
        <SheetContent className="w-full sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>
              {selectedAccount
                ? `${selectedAccount.code} — ${selectedAccount.name}`
                : 'Account'}
            </SheetTitle>
          </SheetHeader>
          {selectedAccount ? (
            <Descriptions column={1} className="mt-6">
              <DescriptionItem label="Code">{selectedAccount.code}</DescriptionItem>
              <DescriptionItem label="Name">{selectedAccount.name}</DescriptionItem>
              <DescriptionItem label="Type">{accountTypeLabels[selectedAccount.type] || selectedAccount.type}</DescriptionItem>
              <DescriptionItem label="Category">{selectedAccount.category || '—'}</DescriptionItem>
              <DescriptionItem label="Status">
                <Badge className={selectedAccount.isActive ? 'bg-green-600' : 'bg-red-600'}>
                  {selectedAccount.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </DescriptionItem>
              <DescriptionItem label="Description">{selectedAccount.description || '—'}</DescriptionItem>
              <DescriptionItem label="Created At">
                {selectedAccount.createdAt ? dayjs(selectedAccount.createdAt).format('MMM DD, YYYY HH:mm') : '—'}
              </DescriptionItem>
              <DescriptionItem label="Updated At">
                {selectedAccount.updatedAt ? dayjs(selectedAccount.updatedAt).format('MMM DD, YYYY HH:mm') : '—'}
              </DescriptionItem>
            </Descriptions>
          ) : (
            <p className="text-muted-foreground mt-6">Select an account to view details.</p>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={journalDrawerVisible} onOpenChange={(open) => {
        if (!open) {
          setJournalDrawerVisible(false);
          setSelectedJournalEntry(null);
        }
      }}>
        <SheetContent className="w-full sm:max-w-[1000px]">
          <SheetHeader>
            <SheetTitle>Journal Entry Details</SheetTitle>
          </SheetHeader>
          {selectedJournalEntry ? (
            <>
              <Descriptions column={2} className="mt-6 mb-6">
                <DescriptionItem label="Reference" span={2}>
                  <strong>{selectedJournalEntry.reference || '—'}</strong>
                </DescriptionItem>
                <DescriptionItem label="Date">
                  {dayjs(selectedJournalEntry.entryDate).format('MMM DD, YYYY')}
                </DescriptionItem>
                <DescriptionItem label="Status">
                  <Badge className={selectedJournalEntry.status === 'posted' ? 'bg-green-600' : 'bg-gray-600'}>
                    {selectedJournalEntry.status?.toUpperCase() || 'DRAFT'}
                  </Badge>
                </DescriptionItem>
                <DescriptionItem label="Source">
                  {selectedJournalEntry.source || '—'}
                </DescriptionItem>
                <DescriptionItem label="Description" span={2}>
                  {selectedJournalEntry.description || '—'}
                </DescriptionItem>
                {selectedJournalEntry.creator && (
                  <DescriptionItem label="Created By">
                    {selectedJournalEntry.creator?.name || '—'}
                  </DescriptionItem>
                )}
                {selectedJournalEntry.approver && (
                  <DescriptionItem label="Approved By">
                    {selectedJournalEntry.approver?.name || '—'}
                  </DescriptionItem>
                )}
              </Descriptions>

              <Separator className="my-6">
                <h3 className="text-lg font-semibold">Journal Entry Lines</h3>
              </Separator>

            {renderTable([
                {
                  title: 'Account',
                  key: 'account',
                  width: 300,
                  render: (_, line) => (
                    <div>
                      <strong>{line.account?.code || '—'}</strong>
                      <br />
                      <span className="text-muted-foreground text-xs">
                        {line.account?.name || '—'}
                      </span>
                    </div>
                  )
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true
                },
                {
                  title: 'Debit',
                  dataIndex: 'debit',
                  key: 'debit',
                  align: 'right',
                  width: 150,
                  render: (value) => (
                    value > 0 ? (
                      <strong className="text-green-600">
                        GHS {parseFloat(value || 0).toFixed(2)}
                      </strong>
                    ) : (
                      <span className="text-muted-foreground">GHS 0.00</span>
                    )
                  )
                },
                {
                  title: 'Credit',
                  dataIndex: 'credit',
                  key: 'credit',
                  align: 'right',
                  width: 150,
                  render: (value) => (
                    value > 0 ? (
                      <strong className="text-red-600">
                        GHS {parseFloat(value || 0).toFixed(2)}
                      </strong>
                    ) : (
                      <span className="text-muted-foreground">GHS 0.00</span>
                    )
                  )
                }
              ], selectedJournalEntry.lines || [], 'id', {
                pagination: false,
                summary: (pageData) => {
                  const totalDebit = pageData.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);
                  const totalCredit = pageData.reduce((sum, line) => sum + parseFloat(line.credit || 0), 0);
                  
                  return (
                    <>
                      <TableCell colSpan={2}>
                        <strong>Total</strong>
                      </TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <strong className="text-green-600">
                          GHS {totalDebit.toFixed(2)}
                        </strong>
                      </TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <strong className="text-red-600">
                          GHS {totalCredit.toFixed(2)}
                        </strong>
                      </TableCell>
                    </>
                  );
                }
              })}
          </>
        ) : (
          <p className="text-muted-foreground mt-6">Select a journal entry to view details.</p>
        )}
        </SheetContent>
      </Sheet>

      <Dialog open={accountModalVisible} onOpenChange={(open) => {
        if (!open) setAccountModalVisible(false);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
            <DialogDescription>
              Create a new chart of accounts entry
            </DialogDescription>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(onSubmitAccount)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={accountForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Code</FormLabel>
                      <FormControl>
                        <Input placeholder="1000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Cash at Bank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={accountForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(accountTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Current Assets / Operating Expenses" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={accountForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Optional description of the account" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAccountModalVisible(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccountMutation.isLoading}>
                  {createAccountMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={journalModalVisible} onOpenChange={(open) => {
        if (!open) setJournalModalVisible(false);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>
              Create a new journal entry with balanced debit and credit lines
            </DialogDescription>
          </DialogHeader>
          <Form {...journalForm}>
            <form onSubmit={journalForm.handleSubmit(onSubmitJournal)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={journalForm.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="AUTOMATIC" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={journalForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <DatePicker
                          date={field.value}
                          onSelect={(date) => field.onChange(date)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={journalForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Narration" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Journal Lines</Label>
                {journalFields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-12 md:col-span-4">
                        <FormField
                          control={journalForm.control}
                          name={`lines.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Account</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {accountOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={journalForm.control}
                          name={`lines.${index}.debit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Debit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <FormField
                          control={journalForm.control}
                          name={`lines.${index}.credit`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Credit</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  value={field.value || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-10 md:col-span-3">
                        <FormField
                          control={journalForm.control}
                          name={`lines.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Line description" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeJournalLine(index)}
                        >
                          <MinusCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendJournalLine({ accountId: '', debit: 0, credit: 0, description: '' })}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setJournalModalVisible(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createJournalMutation.isLoading}>
                  {createJournalMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Journal Entry
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Accounting;

