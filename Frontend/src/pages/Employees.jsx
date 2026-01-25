import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
// Removed Ant Design imports - using shadcn/ui only
import PhoneNumberInput from '../components/PhoneNumberInput';
import {
  Plus,
  Users,
  FilePlus,
  Trash2,
  Upload as UploadIcon,
  Building2,
  DollarSign,
  History,
  Mail,
  Phone,
  Loader2,
  Search
} from 'lucide-react';
import dayjs from 'dayjs';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import employeeService from '../services/employeeService';
import customDropdownService from '../services/customDropdownService';
import { API_BASE_URL } from '../services/api';
import { showSuccess, showError, showWarning } from '../utils/toast';
import ActionColumn from '../components/ActionColumn';
import StatusChip from '../components/StatusChip';
import TableSkeleton from '../components/TableSkeleton';
import DetailSkeleton from '../components/DetailSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Descriptions, DescriptionItem } from '@/components/ui/descriptions';
import { DatePicker } from '@/components/ui/date-picker';
import { Timeline as CustomTimeline, TimelineItem, TimelineIndicator, TimelineContent, TimelineTitle, TimelineDescription, TimelineTime } from '@/components/ui/timeline';
import { Steps, Step } from '@/components/ui/steps';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const resolveFileUrl = (path = '') => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  if (path.startsWith('/')) {
    return `${API_BASE_URL}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
};


const employmentTypes = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'national_service', label: 'National Service' }
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'probation', label: 'Probation' },
  { value: 'terminated', label: 'Terminated' }
];

const ghanaBanks = [
  'Absa Bank Ghana',
  'Access Bank Ghana',
  'Agricultural Development Bank (ADB)',
  'CalBank',
  'Ecobank Ghana',
  'Fidelity Bank Ghana',
  'GCB Bank',
  'Guarantee Trust Bank (GTBank)',
  'National Investment Bank (NIB)',
  'Prudential Bank',
  'Stanbic Bank Ghana',
  'Standard Chartered Bank Ghana',
  'Societe Generale Ghana',
  'United Bank for Africa (UBA)',
  'Zenith Bank Ghana',
  'Mobile Money',
  'Other'
];

const relationshipOptions = [
  'Spouse',
  'Father',
  'Mother',
  'Son',
  'Daughter',
  'Brother',
  'Sister',
  'Grandparent',
  'Uncle',
  'Aunt',
  'Cousin',
  'Friend',
  'Guardian'
];

const EmployeeForm = ({ currentStep, form }) => {
  const [customRelationships, setCustomRelationships] = useState([]);
  const [showRelationshipOtherInputs, setShowRelationshipOtherInputs] = useState({});
  const [relationshipOtherValues, setRelationshipOtherValues] = useState({});
  const [customBanks, setCustomBanks] = useState([]);
  const [showBankOtherInput, setShowBankOtherInput] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [showDepartmentCreateInput, setShowDepartmentCreateInput] = useState(false);
  const [newDepartmentValue, setNewDepartmentValue] = useState('');
  const [jobTitles, setJobTitles] = useState([]);
  const [showJobTitleCreateInput, setShowJobTitleCreateInput] = useState(false);
  const [newJobTitleValue, setNewJobTitleValue] = useState('');

  // Load custom relationships, banks, departments, and job titles on mount
  useEffect(() => {
    const loadCustomOptions = async () => {
      try {
        const [relationships, banks, depts, titles] = await Promise.all([
          customDropdownService.getCustomOptions('employee_relationship'),
          customDropdownService.getCustomOptions('employee_bank'),
          customDropdownService.getCustomOptions('department'),
          customDropdownService.getCustomOptions('job_title')
        ]);
        setCustomRelationships(relationships || []);
        setCustomBanks(banks || []);
        setDepartments(depts || []);
        setJobTitles(titles || []);
      } catch (error) {
        console.error('Failed to load custom options:', error);
      }
    };
    loadCustomOptions();
  }, []);

  // Handle relationship change (including "Other")
  const handleRelationshipChange = (value, fieldPath) => {
    if (value === '__OTHER__') {
      setShowRelationshipOtherInputs(prev => ({ ...prev, [fieldPath]: true }));
    } else {
      setShowRelationshipOtherInputs(prev => {
        const newState = { ...prev };
        delete newState[fieldPath];
        return newState;
      });
    }
  };

  // Save custom relationship
  const handleSaveCustomRelationship = async (customValue, fieldPath) => {
    if (!customValue || !customValue.trim()) {
      showWarning('Please enter a relationship name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('employee_relationship', customValue.trim());
      if (saved) {
        // Add to custom relationships
        setCustomRelationships(prev => {
          if (prev.find(r => r.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setValue(fieldPath, saved.value);
        
        // Clear the "Other" input
        setShowRelationshipOtherInputs(prev => {
          const newState = { ...prev };
          delete newState[fieldPath];
          return newState;
        });
        setRelationshipOtherValues(prev => {
          const newState = { ...prev };
          delete newState[fieldPath];
          return newState;
        });
        
        showSuccess(`"${saved.label}" added to relationships`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save custom relationship');
    }
  };

  // Get merged relationship options
  const getMergedRelationshipOptions = () => {
    const merged = [...relationshipOptions];
    customRelationships.forEach(rel => {
      if (!merged.includes(rel.value)) {
        merged.push(rel.value);
      }
    });
    return merged;
  };

  // Get merged bank options
  const getMergedBankOptions = () => {
    const merged = [...ghanaBanks.filter(b => b !== 'Other')];
    customBanks.forEach(bank => {
      if (!merged.includes(bank.value)) {
        merged.push(bank.value);
      }
    });
    return merged;
  };

  // Handle department change (including "Create Department")
  const handleDepartmentChange = (value) => {
    if (value === '__CREATE__') {
      setShowDepartmentCreateInput(true);
    } else {
      setShowDepartmentCreateInput(false);
    }
  };

  // Save custom department
  const handleSaveCustomDepartment = async () => {
    if (!newDepartmentValue || !newDepartmentValue.trim()) {
      showWarning('Please enter a department name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('department', newDepartmentValue.trim());
      if (saved) {
        // Add to departments
        setDepartments(prev => {
          if (prev.find(d => d.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        // Set the value in the form
        form.setValue('department', saved.value);
        
        // Clear the input
        setShowDepartmentCreateInput(false);
        setNewDepartmentValue('');
        
        showSuccess(`"${saved.label}" department added`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save department');
    }
  };

  // Handle job title change (including "Create Job Title")
  const handleJobTitleChange = (value) => {
    if (value === '__CREATE__') {
      setShowJobTitleCreateInput(true);
    } else {
      setShowJobTitleCreateInput(false);
    }
  };

  // Save custom job title
  const handleSaveCustomJobTitle = async () => {
    if (!newJobTitleValue || !newJobTitleValue.trim()) {
      showWarning('Please enter a job title');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('job_title', newJobTitleValue.trim());
      if (saved) {
        setJobTitles(prev => {
          if (prev.find(t => t.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        form.setValue('jobTitle', saved.value);
        setShowJobTitleCreateInput(false);
        setNewJobTitleValue('');
        showSuccess(`"${saved.label}" job title added`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save job title');
    }
  };

  // Handle bank change (including "Other")
  const handleBankChange = (value) => {
    if (value === '__OTHER__') {
      setShowBankOtherInput(true);
    } else {
      setShowBankOtherInput(false);
    }
  };

  // Save custom bank
  const handleSaveCustomBank = async (customValue) => {
    if (!customValue || !customValue.trim()) {
      showWarning('Please enter a bank name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('employee_bank', customValue.trim());
      if (saved) {
        setCustomBanks(prev => {
          if (prev.find(b => b.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        form.setValue('bankName', saved.value);
        setShowBankOtherInput(false);
        form.setValue('customBankName', undefined);
        showSuccess(`"${saved.label}" added to banks`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save custom bank');
    }
  };

  return (
    <>
    {currentStep === 0 && (
      <>
        <Separator className="my-4" />
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="First Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Last Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <PhoneNumberInput placeholder="Enter phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="my-4" />
        <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select value={field.value} onValueChange={(value) => {
                  if (value === '__CREATE__') {
                    handleDepartmentChange('__CREATE__');
                  } else {
                    handleDepartmentChange(value);
                    field.onChange(value);
                  }
                }}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select or create department" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                    <Separator className="my-2" />
                    <SelectItem value="__CREATE__" onSelect={(e) => {
                      e.preventDefault();
                      setShowDepartmentCreateInput(true);
                    }}>
                      <Button variant="ghost" className="w-full justify-start" onClick={(e) => {
                        e.preventDefault();
                        setShowDepartmentCreateInput(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Department
                      </Button>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="jobTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <Select value={field.value} onValueChange={(value) => {
                  if (value === '__CREATE__') {
                    handleJobTitleChange('__CREATE__');
                  } else {
                    handleJobTitleChange(value);
                    field.onChange(value);
                  }
                }}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select or create job title" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {jobTitles.map((title) => (
                      <SelectItem key={title.value} value={title.value}>
                        {title.label}
                      </SelectItem>
                    ))}
                    <Separator className="my-2" />
                    <SelectItem value="__CREATE__" onSelect={(e) => {
                      e.preventDefault();
                      setShowJobTitleCreateInput(true);
                    }}>
                      <Button variant="ghost" className="w-full justify-start" onClick={(e) => {
                        e.preventDefault();
                        setShowJobTitleCreateInput(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Job Title
                      </Button>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {showDepartmentCreateInput && (
          <div className="mb-4">
            <Label>New Department Name</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter department name"
                value={newDepartmentValue}
                onChange={(e) => setNewDepartmentValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveCustomDepartment();
                  }
                }}
                autoFocus
                className="flex-1"
              />
              <Button type="button" onClick={handleSaveCustomDepartment}>
                Save
              </Button>
            </div>
          </div>
        )}
        {showJobTitleCreateInput && (
          <div className="mb-4">
            <Label>New Job Title</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Enter job title"
                value={newJobTitleValue}
                onChange={(e) => setNewJobTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveCustomJobTitle();
                  }
                }}
                autoFocus
                className="flex-1"
              />
              <Button type="button" onClick={handleSaveCustomJobTitle}>
                Save
              </Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employment Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((option) => (
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
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="hireDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hire Date</FormLabel>
                <FormControl>
                  <DatePicker
                    date={field.value ? (dayjs.isDayjs(field.value) ? field.value.toDate() : new Date(field.value)) : undefined}
                    onDateChange={(date) => {
                      field.onChange(date ? dayjs(date) : null);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Separator className="my-4" />
        <h3 className="text-lg font-semibold mb-4">Compensation</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="salaryType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salary Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="salaryAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Amount</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10">GHS</span>
                    <Input
                      type="number"
                      className="w-full pl-16"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={field.value || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === '' ? 0 : parseFloat(value) || 0);
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="payFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pay Frequency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank / Wallet</FormLabel>
                <Select 
                  value={field.value} 
                  onValueChange={(value) => {
                    if (value === '__OTHER__') {
                      handleBankChange('__OTHER__');
                    } else {
                      handleBankChange(value);
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank or mobile money" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getMergedBankOptions().map((bank) => (
                      <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                    ))}
                    <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {showBankOtherInput && (
          <div className="mb-4">
            <Label>Enter Bank Name</Label>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="e.g., New Bank, Credit Union"
                value={form.getValues('customBankName') || ''}
                onChange={(e) => form.setValue('customBankName', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveCustomBank(form.getValues('customBankName'));
                  }
                }}
                className="flex-1"
              />
              <Button onClick={() => handleSaveCustomBank(form.getValues('customBankName'))}>
                Save
              </Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="bankAccountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input placeholder="Account Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankAccountNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account / Momo Number</FormLabel>
                <FormControl>
                  <Input placeholder="Account or Mobile Money Number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </>
    )}

    {currentStep === 1 && (
      <>
        <Separator className="my-4" />
        <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="emergencyContact.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input placeholder="Full Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergencyContact.relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relationship</FormLabel>
                <Select 
                  value={field.value} 
                  onValueChange={(value) => {
                    handleRelationshipChange(value, 'emergencyContact.relationship');
                    field.onChange(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getMergedRelationshipOptions().map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {showRelationshipOtherInputs['emergencyContact.relationship'] && (
                  <div className="mt-2">
                    <Label>Enter Relationship</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="e.g., Step-sister, In-law"
                        value={relationshipOtherValues['emergencyContact.relationship'] || ''}
                        onChange={(e) => setRelationshipOtherValues(prev => ({ ...prev, 'emergencyContact.relationship': e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveCustomRelationship(relationshipOtherValues['emergencyContact.relationship'], 'emergencyContact.relationship');
                          }
                        }}
                        className="flex-1"
                      />
                      <Button onClick={() => handleSaveCustomRelationship(relationshipOtherValues['emergencyContact.relationship'], 'emergencyContact.relationship')}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="emergencyContact.phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <PhoneNumberInput placeholder="Enter contact phone" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="emergencyContact.email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Contact Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="my-4" />
        <h3 className="text-lg font-semibold mb-4">Next of Kin</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="nextOfKin.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Full Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextOfKin.relationship"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Relationship</FormLabel>
                <Select 
                  value={field.value} 
                  onValueChange={(value) => {
                    handleRelationshipChange(value, 'nextOfKin.relationship');
                    field.onChange(value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getMergedRelationshipOptions().map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {showRelationshipOtherInputs['nextOfKin.relationship'] && (
                  <div className="mt-2">
                    <Label>Enter Relationship</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="e.g., Step-sister, In-law"
                        value={relationshipOtherValues['nextOfKin.relationship'] || ''}
                        onChange={(e) => setRelationshipOtherValues(prev => ({ ...prev, 'nextOfKin.relationship': e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveCustomRelationship(relationshipOtherValues['nextOfKin.relationship'], 'nextOfKin.relationship');
                          }
                        }}
                        className="flex-1"
                      />
                      <Button onClick={() => handleSaveCustomRelationship(relationshipOtherValues['nextOfKin.relationship'], 'nextOfKin.relationship')}>
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <FormField
            control={form.control}
            name="nextOfKin.phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <PhoneNumberInput placeholder="Enter phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextOfKin.email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Internal notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </>
    )}
  </>
  );
};

const Employees = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    employmentType: 'all'
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10
  });
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [formStep, setFormStep] = useState(0);
  
  const employeeSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
    employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern', 'temporary', 'national_service']).default('full_time'),
    status: z.enum(['active', 'on_leave', 'probation', 'terminated']).default('active'),
    hireDate: z.any().optional(),
    endDate: z.any().optional(),
    salaryType: z.enum(['salary', 'hourly', 'commission']).default('salary'),
    salaryAmount: z.number().min(0, 'Enter a base amount').default(0),
    payFrequency: z.enum(['monthly', 'biweekly', 'weekly', 'daily']).default('monthly'),
    bankName: z.string().optional(),
    customBankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    emergencyContact: z.object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
    nextOfKin: z.object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    }).optional(),
    notes: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employmentType: 'full_time',
      status: 'active',
      salaryType: 'salary',
      payFrequency: 'monthly',
      salaryAmount: 0,
    },
  });
  
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState(null);
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewMimeType, setDocumentPreviewMimeType] = useState(null);

  const formSteps = [
    { key: 'basic', title: 'Employment Details' },
    { key: 'emergency', title: 'Emergency & Next of Kin' }
  ];

  const defaultFormValues = {
    employmentType: 'full_time',
    status: 'active',
    salaryType: 'salary',
    payFrequency: 'monthly'
  };

  const employeeQuery = useQuery({
    queryKey: ['employees', pagination.current, pagination.pageSize, filters],
    queryFn: () =>
      employeeService.getEmployees({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters
      })
  });

  const resetFormState = () => {
    setFormStep(0);
    form.reset(defaultFormValues);
    setEditingEmployee(null);
  };

  const fetchEmployeeDetails = async (id) => {
    setDrawerLoading(true);
    try {
      const response = await employeeService.getEmployee(id);
      setViewingEmployee(response.data || response);
    } catch (error) {
      showError(null, 'Failed to load employee details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: employeeService.createEmployee,
    onSuccess: () => {
      showSuccess('Employee created');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setModalVisible(false);
      resetFormState();
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to create employee');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => employeeService.updateEmployee(id, payload),
    onSuccess: (_, variables) => {
      showSuccess('Employee updated');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (viewingEmployee?.id === variables.id) {
        fetchEmployeeDetails(variables.id);
      }
      setModalVisible(false);
      resetFormState();
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to update employee');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, payload }) => employeeService.archiveEmployee(id, payload),
    onSuccess: (_, variables) => {
      showSuccess('Employee archived');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (viewingEmployee?.id === variables.id) {
        setDrawerVisible(false);
      }
    },
    onError: (error) => {
      showError(error, error?.response?.data?.message || 'Failed to archive employee');
    }
  });

  const handleOpenCreate = () => {
    resetFormState();
    setModalVisible(true);
  };

  const handleOpenEdit = (record) => {
    setFormStep(0);
    setEditingEmployee(record);
    form.reset({
      ...record,
      hireDate: record.hireDate ? dayjs(record.hireDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null
    });
    setModalVisible(true);
  };

  const onSubmit = async (values) => {
    // Ensure firstName and lastName are present and not empty
    const firstName = values.firstName?.trim();
    const lastName = values.lastName?.trim();
    
    if (!firstName || !lastName) {
      if (formStep !== 0) {
        setFormStep(0);
      }
      showError(null, 'First Name and Last Name are required');
      return;
    }

    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email?.trim() || null,
      phone: values.phone || null,
      department: values.department || null,
      jobTitle: values.jobTitle || null,
      employmentType: values.employmentType || 'full_time',
      status: values.status || 'active',
      hireDate: values.hireDate ? (dayjs.isDayjs(values.hireDate) ? values.hireDate.format('YYYY-MM-DD') : values.hireDate) : null,
      endDate: values.endDate ? (dayjs.isDayjs(values.endDate) ? values.endDate.format('YYYY-MM-DD') : values.endDate) : null,
      salaryType: values.salaryType || 'salary',
      salaryAmount: values.salaryAmount || 0,
      payFrequency: values.payFrequency || 'monthly',
      bankName: values.bankName || null,
      customBankName: values.customBankName || null,
      bankAccountName: values.bankAccountName || null,
      bankAccountNumber: values.bankAccountNumber || null,
      emergencyContact: values.emergencyContact || {},
      nextOfKin: values.nextOfKin || {},
      notes: values.notes || null
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleView = async (record) => {
    // Set viewing employee immediately with data from table row
    setViewingEmployee(record);
    // Open drawer immediately
    setDrawerVisible(true);
    // Load full details asynchronously
    setDrawerLoading(true);
    try {
      await fetchEmployeeDetails(record.id);
    } catch (error) {
      // Error handling is already in fetchEmployeeDetails
    }
    // Note: drawerLoading is set to false in fetchEmployeeDetails finally block
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    resetFormState();
  };

  const handleNextStep = async () => {
    // Validate only fields on the current step
    if (formStep === 0) {
      // Validate all step 1 fields before proceeding to step 2
      // Required fields: firstName, lastName, salaryAmount
      const fieldsToValidate = ['firstName', 'lastName', 'salaryAmount'];
      
      // If email is provided, validate its format
      const currentValues = form.getValues();
      if (currentValues.email) {
        fieldsToValidate.push('email');
      }
      
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) {
        return;
      }
    } else {
      // Validate all fields if on other steps
      const isValid = await form.trigger();
      if (!isValid) {
        return;
      }
    }
    setFormStep((prev) => Math.min(prev + 1, formSteps.length - 1));
  };

  const handlePrevStep = () => {
    setFormStep((prev) => Math.max(prev - 1, 0));
  };

  const handleUploadDocument = async ({ file }) => {
    if (!viewingEmployee) return;
    setDocumentUploading(true);
    try {
      const response = await employeeService.uploadDocument(viewingEmployee.id, file);
      const newDoc = response.data || response;
      setViewingEmployee((prev) => ({
        ...prev,
        documents: [newDoc, ...(prev.documents || [])]
      }));
      showSuccess('Document uploaded');
    } catch (error) {
      showError(error, error?.response?.data?.message || 'Failed to upload document');
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleOpenDocumentPreview = async (doc) => {
    revokePreviewUrl();
    setDocumentPreview(doc);
    setDocumentPreviewVisible(true);
    setDocumentPreviewLoading(true);

    try {
      const resolvedUrl = resolveFileUrl(doc.fileUrl);
      const token = localStorage.getItem('token');
      const response = await fetch(resolvedUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setDocumentPreviewUrl(objectUrl);
      setDocumentPreviewMimeType(blob.type || null);
    } catch (error) {
      console.error('Failed to load document preview', error);
      showError(null, 'Unable to load document preview.');
    } finally {
      setDocumentPreviewLoading(false);
    }
  };

  const handleCloseDocumentPreview = () => {
    setDocumentPreviewVisible(false);
    revokePreviewUrl();
    setDocumentPreview(null);
  };

  const handleDeleteDocument = async (documentId) => {
    if (!viewingEmployee) return;
    try {
      await employeeService.deleteDocument(viewingEmployee.id, documentId);
      setViewingEmployee((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((doc) => doc.id !== documentId)
      }));
      showSuccess('Document removed');
    } catch (error) {
      showError(null, 'Failed to delete document');
    }
  };

  const handleAddHistory = async (payload) => {
    if (!viewingEmployee) return;
    try {
      const response = await employeeService.addHistory(viewingEmployee.id, payload);
      const history = response.data || response;
      setViewingEmployee((prev) => ({
        ...prev,
        history: [history, ...(prev.history || [])]
      }));
      showSuccess('History entry added');
    } catch (error) {
      showError(null, 'Failed to add history entry');
    }
  };

  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'firstName',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{`${record.firstName} ${record.lastName}`}</div>
          <div style={{ color: '#888', fontSize: 12 }}>{record.jobTitle || '—'}</div>
        </div>
      )
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (value) => value || '—'
    },
    {
      title: 'Employment Type',
      dataIndex: 'employmentType',
      key: 'employmentType',
      render: (value) => value?.replace('_', ' ').toUpperCase()
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <StatusChip status={status} />
      )
    },
    {
      title: 'Hire Date',
      dataIndex: 'hireDate',
      key: 'hireDate',
      render: (date) => (date ? dayjs(date).format('MMM DD, YYYY') : '—')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <ActionColumn
          record={record}
          onView={handleView}
          extraActions={[
            {
              label: 'Edit',
              onClick: () => handleOpenEdit(record),
              icon: <FilePlus className="h-4 w-4" />
            },
            {
              label: 'Archive',
              onClick: () => archiveMutation.mutate({ id: record.id, payload: {} }),
              icon: <Trash2 className="h-4 w-4" />,
              danger: true
            }
          ]}
        />
      )
    }
  ], [handleView, archiveMutation]);

  const employees = employeeQuery.data?.data || [];
  const total = employeeQuery.data?.count || 0;

  const organization = employeeQuery.data?.organization || {};

  // Helper function to render table from columns and dataSource with server-side pagination
  const renderTable = (columns, dataSource, rowKey = 'id', options = {}) => {
    const { pagination: tablePagination, loading, onChange } = options;
    const pageSize = tablePagination?.pageSize || 10;
    const current = tablePagination?.current || 1;
    const total = tablePagination?.total || dataSource?.length || 0;
    const showPagination = tablePagination !== false && total > pageSize;

    if (loading) {
      return <TableSkeleton rows={pageSize} cols={columns.length} />;
    }

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
            {dataSource.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              dataSource.map((record) => (
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
        </Table>
        {showPagination && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {((current - 1) * pageSize) + 1} to {Math.min(current * pageSize, total)} of {total} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange && onChange({ current: current - 1, pageSize })}
                disabled={current === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {current} of {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange && onChange({ current: current + 1, pageSize })}
                disabled={current >= Math.ceil(total / pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDocumentPreviewContent = () => {
    if (!documentPreview) {
      return null;
    }

    const originalPath = documentPreview.fileUrl || '';
    const mimeType = documentPreviewMimeType || '';
    const url = documentPreviewUrl;

    const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp|svg)$/i.test(originalPath);
    const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(originalPath);

    if (documentPreviewLoading || !url) {
      return (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="text-center">
          <img
            src={url}
            alt={documentPreview.title || 'Document image'}
            className="max-h-[60vh] object-contain mx-auto"
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <iframe
          title={documentPreview.title || 'Document PDF'}
          src={`${url}#toolbar=1`}
          className="w-full h-[70vh] border-0"
        />
      );
    }

    return (
      <div className="flex flex-col">
        <p className="text-muted-foreground">Preview not available. You can download the file instead.</p>
      </div>
    );
  };

  const revokePreviewUrl = () => {
    if (documentPreviewUrl && documentPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(documentPreviewUrl);
    }
    setDocumentPreviewUrl(null);
    setDocumentPreviewMimeType(null);
  };

  useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employees</h1>
          <p className="text-muted-foreground">Manage your team, payroll readiness, and HR records.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}>
            <Users className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Employee
          </Button>
        </div>
      </div>

      <Card className="mb-4 shadow-none">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, department, email"
                value={filters.search}
                onChange={(e) => {
                  setPagination((prev) => ({ ...prev, current: 1 }));
                  setFilters((prev) => ({ ...prev, search: e.target.value }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPagination((prev) => ({ ...prev, current: 1 }));
                  }
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, status: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.employmentType}
              onValueChange={(value) => {
                setPagination((prev) => ({ ...prev, current: 1 }));
                setFilters((prev) => ({ ...prev, employmentType: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Employment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {employmentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {renderTable(columns, employees, 'id', {
        pagination: {
          ...pagination,
          total,
        },
        loading: employeeQuery.isLoading,
        onChange: (pag) => setPagination(pag)
      })}

      <Dialog open={modalVisible} onOpenChange={(open) => {
        if (!open) handleModalCancel();
      }}>
        <DialogContent className="max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'New Employee'}</DialogTitle>
          </DialogHeader>
          <Steps current={formStep} className="mb-6">
            {formSteps.map((step, index) => (
              <Step key={index} title={step.title} />
            ))}
          </Steps>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <EmployeeForm currentStep={formStep} form={form} />
            </form>
          </Form>
          <DialogFooter>
            {formStep > 0 && (
              <Button variant="outline" onClick={handlePrevStep}>
                Previous
              </Button>
            )}
            {formStep < formSteps.length - 1 && (
              <Button onClick={handleNextStep}>
                Next
              </Button>
            )}
            {formStep === formSteps.length - 1 && (
              <Button
                disabled={createMutation.isLoading || updateMutation.isLoading}
                onClick={form.handleSubmit(onSubmit)}
              >
                {createMutation.isLoading || updateMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingEmployee ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  editingEmployee ? 'Save Changes' : 'Create Employee'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerVisible} onOpenChange={(open) => {
        if (!open) {
          setDrawerVisible(false);
          setViewingEmployee(null);
          setDrawerLoading(false);
        }
      }}>
        <SheetContent className="w-full sm:max-w-[900px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {viewingEmployee
                ? `${viewingEmployee.firstName} ${viewingEmployee.lastName}`
                : 'Employee'}
            </SheetTitle>
          </SheetHeader>
        {(() => {
          if (drawerLoading) {
            return <DetailSkeleton />;
          }
          if (!viewingEmployee) {
            return null;
          }
          return (
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="payroll">Payroll</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-6">
                <Descriptions column={1}>
                  <DescriptionItem label="Name">
                    {viewingEmployee.firstName} {viewingEmployee.lastName}
                  </DescriptionItem>
                  <DescriptionItem label="Email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {viewingEmployee.email || '—'}
                    </div>
                  </DescriptionItem>
                  <DescriptionItem label="Phone">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {viewingEmployee.phone || '—'}
                    </div>
                  </DescriptionItem>
                  <DescriptionItem label="Department">
                    {viewingEmployee.department || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Job Title">
                    {viewingEmployee.jobTitle || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Employment Type">
                    {viewingEmployee.employmentType?.replace('_', ' ').toUpperCase()}
                  </DescriptionItem>
                  <DescriptionItem label="Status">
                    <StatusChip status={viewingEmployee.status} />
                  </DescriptionItem>
                  <DescriptionItem label="Hire Date">
                    {viewingEmployee.hireDate ? dayjs(viewingEmployee.hireDate).format('MMM DD, YYYY') : '—'}
                  </DescriptionItem>
                  <DescriptionItem label="End Date">
                    {viewingEmployee.endDate ? dayjs(viewingEmployee.endDate).format('MMM DD, YYYY') : '—'}
                  </DescriptionItem>
                </Descriptions>

                <Separator className="my-6">
                  <span className="text-sm font-medium">Compensation</span>
                </Separator>
                <Descriptions column={1}>
                  <DescriptionItem label="Salary Type">
                    {viewingEmployee.salaryType?.toUpperCase()}
                  </DescriptionItem>
                  <DescriptionItem label="Base Amount">
                    GHS {Number(viewingEmployee.salaryAmount || 0).toFixed(2)}
                  </DescriptionItem>
                  <DescriptionItem label="Pay Frequency">
                    {viewingEmployee.payFrequency?.toUpperCase()}
                  </DescriptionItem>
                  <DescriptionItem label="Bank / Wallet">
                    {viewingEmployee.bankName || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Account Name">
                    {viewingEmployee.bankAccountName || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Account / Momo Number">
                    {viewingEmployee.bankAccountNumber || '—'}
                  </DescriptionItem>
                </Descriptions>

                <Separator className="my-6">
                  <span className="text-sm font-medium">Emergency Contact</span>
                </Separator>
                <Descriptions column={1}>
                  <DescriptionItem label="Name">
                    {viewingEmployee.emergencyContact?.name || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Relationship">
                    {viewingEmployee.emergencyContact?.relationship || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Phone">
                    {viewingEmployee.emergencyContact?.phone || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Email">
                    {viewingEmployee.emergencyContact?.email || '—'}
                  </DescriptionItem>
                </Descriptions>

                <Separator className="my-6">
                  <span className="text-sm font-medium">Next of Kin</span>
                </Separator>
                <Descriptions column={1}>
                  <DescriptionItem label="Name">
                    {viewingEmployee.nextOfKin?.name || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Relationship">
                    {viewingEmployee.nextOfKin?.relationship || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Phone">
                    {viewingEmployee.nextOfKin?.phone || '—'}
                  </DescriptionItem>
                  <DescriptionItem label="Email">
                    {viewingEmployee.nextOfKin?.email || '—'}
                  </DescriptionItem>
                </Descriptions>

                {viewingEmployee.notes && (
                  <>
                    <Separator className="my-6">
                      <span className="text-sm font-medium">Notes</span>
                    </Separator>
                    <Card>
                      <CardContent className="pt-6">
                        <p>{viewingEmployee.notes}</p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>
              <TabsContent value="documents" className="mt-6">
                <div className="mb-4">
                  <input
                    type="file"
                    id="document-upload"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadDocument({ file });
                      }
                    }}
                    disabled={documentUploading}
                  />
                  <Button
                    onClick={() => document.getElementById('document-upload')?.click()}
                    disabled={documentUploading}
                  >
                    {documentUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="h-4 w-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
                <Separator className="my-4" />
                {(viewingEmployee.documents || []).length === 0 ? (
                  <p className="text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(viewingEmployee.documents || []).map((doc) => (
                      <Card key={doc.id}>
                        <CardContent className="pt-6">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-baseline gap-2">
                              <strong>{doc.title || doc.type || 'Document'}</strong>
                              <Badge className="bg-purple-600">{doc.type || 'File'}</Badge>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Uploaded {doc.createdAt ? dayjs(doc.createdAt).format('MMM DD, YYYY') : '—'}
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleOpenDocumentPreview(doc)}>
                                View
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete document?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the document.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteDocument(doc.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-6">
                <Button
                  className="mb-4"
                  onClick={() =>
                    handleAddHistory({
                      changeType: 'note',
                      notes: 'Manual entry',
                      effectiveDate: new Date()
                    })
                  }
                >
                  <History className="h-4 w-4 mr-2" />
                  Add History Note
                </Button>
                <CustomTimeline>
                  {(viewingEmployee.history || []).map((item, index) => (
                    <TimelineItem key={index}>
                      <TimelineIndicator className={item.changeType === 'termination' ? 'bg-red-600' : 'bg-blue-600'}>
                        <History className="h-4 w-4" />
                      </TimelineIndicator>
                      <TimelineContent>
                        <TimelineTitle>{item.changeType.toUpperCase()}</TimelineTitle>
                        <TimelineTime>{dayjs(item.effectiveDate).format('MMM DD, YYYY')}</TimelineTime>
                        {item.notes && <TimelineDescription>{item.notes}</TimelineDescription>}
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </CustomTimeline>
              </TabsContent>
              <TabsContent value="payroll" className="mt-6">
                {viewingEmployee.payrollEntries?.length ? (
                  viewingEmployee.payrollEntries.map((entry) => (
                    <Card key={entry.id} className="mb-3">
                      <CardContent className="pt-6">
                        <div className="flex flex-col gap-1">
                          <strong>
                            {entry.run?.periodStart
                              ? `${dayjs(entry.run.periodStart).format('MMM DD')} - ${dayjs(entry.run.periodEnd).format('MMM DD, YYYY')}`
                              : 'Payroll Entry'}
                          </strong>
                          <p className="text-muted-foreground text-sm">
                            Pay Date: {entry.run?.payDate ? dayjs(entry.run.payDate).format('MMM DD, YYYY') : '—'} • Status:{' '}
                            <Badge className={entry.run?.status === 'paid' ? 'bg-green-600' : 'bg-gray-600'}>
                              {entry.run?.status?.toUpperCase() || '—'}
                            </Badge>
                          </p>
                          <p>
                            Gross: GHS {parseFloat(entry.grossPay || 0).toFixed(2)} • Net:{' '}
                            <strong>GHS {parseFloat(entry.netPay || 0).toFixed(2)}</strong>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground">No payroll history yet.</p>
                )}
              </TabsContent>
            </Tabs>
          );
        })()}
        </SheetContent>
      </Sheet>

      <Dialog open={documentPreviewVisible} onOpenChange={(open) => {
        if (!open) handleCloseDocumentPreview();
      }}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{documentPreview?.title || documentPreview?.type || 'Document Preview'}</DialogTitle>
          </DialogHeader>
          {renderDocumentPreviewContent()}
          <DialogFooter>
            {documentPreview && (documentPreviewUrl || resolveFileUrl(documentPreview.fileUrl)) && (
              <Button
                asChild
                href={documentPreviewUrl || resolveFileUrl(documentPreview.fileUrl)}
                download
              >
                <a>Download</a>
              </Button>
            )}
            <Button variant="outline" onClick={handleCloseDocumentPreview}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;


