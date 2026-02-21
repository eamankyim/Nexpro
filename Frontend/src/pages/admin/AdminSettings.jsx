import { useEffect, useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Upload as UploadIcon, Pencil, Trash2, Plus, RefreshCw, Loader2, Copy, XCircle } from 'lucide-react';
import { showSuccess, showError } from '../../utils/toast';
import { useResponsive } from '../../hooks/useResponsive';
import { usePlatformAdminPermissions } from '../../context/PlatformAdminPermissionsContext';
import adminService from '../../services/adminService';
import { API_BASE_URL } from '../../services/api';
import FileUpload from '../../components/FileUpload';
import FilePreview from '../../components/FilePreview';
import AdminRoles from './AdminRoles';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Helper function to resolve file URLs (handles base64, relative paths, and absolute URLs)
const resolveFileUrl = (url) => {
  if (!url) return '';
  // Base64 data URLs (data:image/png;base64,...)
  if (url.startsWith('data:')) return url;
  // Absolute URLs (http:// or https://)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative paths - prepend API base URL
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  // Return as-is for other cases
  return url;
};

const defaultFormValues = {
  branding: {},
  featureFlags: {},
  communications: {},
};

const AdminsTable = ({ columns, data }) => (
  <Table>
    <TableHeader>
      <TableRow>
        {columns.map((col) => (
          <TableHead key={col.key}>{col.title}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((record) => (
        <TableRow key={record.id}>
          {columns.map((col) => {
            const value = Array.isArray(col.dataIndex)
              ? record[col.dataIndex[0]]?.[col.dataIndex[1]]
              : record[col.dataIndex];
            return (
              <TableCell key={col.key}>
                {col.render ? col.render(value, record) : (value ?? '—')}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const PlansTable = ({ columns, data, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key}>{col.title}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => (
          <TableRow key={record.id}>
            {columns.map((col) => {
              const value = Array.isArray(col.dataIndex)
                ? record[col.dataIndex[0]]?.[col.dataIndex[1]]
                : record[col.dataIndex];
              return (
                <TableCell key={col.key}>
                  {col.render ? col.render(value, record) : (value ?? '—')}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const PlanActionsCell = ({ record, onEdit, onDelete }) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => onEdit(record)}>
        <Pencil className="h-4 w-4 mr-1" />
        Edit
      </Button>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onDelete(record.id); setDeleteOpen(false); }}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const AdminSettings = () => {
  const { isMobile } = useResponsive();
  const { hasPermission, loading: permissionsLoading } = usePlatformAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const form = useForm({ defaultValues: defaultFormValues });
  const adminForm = useForm({
    defaultValues: { name: '', email: '', role: 'Operations', password: '', isActive: true },
    mode: 'onSubmit',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminSaving, setAdminSaving] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState(null);
  const [pendingPlatformInvites, setPendingPlatformInvites] = useState([]);
  const [loadingPlatformInvites, setLoadingPlatformInvites] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState(null);
  const [platformInviteRoles, setPlatformInviteRoles] = useState(['Marketing', 'Operations', 'Customer service', 'Developer', 'Media']);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState('');
  const [brandingLogoPreviewVisible, setBrandingLogoPreviewVisible] = useState(false);
  const [brandingLogoUploading, setBrandingLogoUploading] = useState(false);
  
  // Get active tab from URL params, default to 'branding'
  const activeTab = searchParams.get('tab') || 'branding';
  
  // Subscription Plans state
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [syncingPlans, setSyncingPlans] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const planForm = useForm({
    defaultValues: {
      planId: '', name: '', order: 0, description: '', isActive: true,
      priceAmount: '', priceCurrency: 'GHS', priceDisplay: '', priceBillingDescription: '',
      seatLimit: '', seatPricePerAdditional: '', storageLimitMB: '', storagePrice100GB: '',
      highlights: '', marketingEnabled: true, marketingPerks: '', marketingPopular: false,
      marketingBadgeLabel: '', onboardingEnabled: true, onboardingSubtitle: '', onboardingIsDefault: false,
    }
  });
  
  // Debug: Log plans state changes
  useEffect(() => {
    console.log('[AdminSettings] Plans state changed:', plans);
    console.log('[AdminSettings] Plans count:', plans?.length || 0);
    console.log('[AdminSettings] Plans loading:', plansLoading);
  }, [plans, plansLoading]);
  
  // Feature Catalog state (legacy)
  const [featureCatalog, setFeatureCatalog] = useState([]);
  const [featureCategories, setFeatureCategories] = useState({});
  const [featuresByCategory, setFeaturesByCategory] = useState({});
  
  // Modules state (new)
  const [modules, setModules] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);

  const loadPlatformSettings = async () => {
    setLoading(true);
    try {
      const response = await adminService.getPlatformSettings();
      if (response?.success) {
        const {
          'platform:branding': branding = {},
          'platform:featureFlags': featureFlags = {},
          'platform:communications': communications = {},
        } = response.data || {};
        form.reset({
          branding,
          featureFlags,
          communications,
        });
        setBrandingLogoPreview(branding.logoUrl || '');
      } else {
        form.reset(defaultFormValues);
        setBrandingLogoPreview('');
      }
    } catch (error) {
      console.error('Failed to load platform settings', error);
      showError(null, 'Failed to load settings');
      form.reset(defaultFormValues);
      setBrandingLogoPreview('');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformAdmins = async () => {
    try {
      const response = await adminService.getPlatformAdmins();
      if (response?.success) {
        setAdmins(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load platform admins', error);
      showError(null, 'Failed to load admins');
    }
  };

  useEffect(() => {
    console.log('[AdminSettings] useEffect: Loading all data...');
    loadPlatformSettings();
    loadPlatformAdmins();
    loadSubscriptionPlans();
    loadFeatureCatalog();
    loadModules();
  }, []);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('settings.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view settings.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      await adminService.updatePlatformSettings(values);
      showSuccess('Platform settings updated');
    } catch (error) {
      console.error('Failed to update platform settings', error);
      showError(null, 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async ({ file }) => {
    if (!file) return;
    setBrandingLogoUploading(true);
    try {
      const toBase64 = (f) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(f);
        });

      const base64 = await toBase64(file);
      const currentBranding = form.getValues('branding') || {};
      form.setValue('branding', {
        ...currentBranding,
        logoUrl: base64,
      });
      setBrandingLogoPreview(base64);
      showSuccess('Logo uploaded');
    } catch (error) {
      console.error('Failed to read file', error);
      showError(null, 'Failed to upload logo');
    } finally {
      setBrandingLogoUploading(false);
    }
  };

  const loadPendingPlatformInvites = useCallback(async () => {
    setLoadingPlatformInvites(true);
    try {
      const res = await adminService.getPlatformAdminInvites();
      setPendingPlatformInvites(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setPendingPlatformInvites([]);
    } finally {
      setLoadingPlatformInvites(false);
    }
  }, []);

  const openCreateAdminModal = async () => {
    setEditingAdmin(null);
    setGeneratedInviteLink(null);
    let roles = platformInviteRoles;
    try {
      const fetched = await adminService.getPlatformAdminInviteRoles();
      if (fetched.length > 0) {
        roles = fetched;
        setPlatformInviteRoles(fetched);
      }
    } catch {
      // keep default roles
    }
    adminForm.reset({ name: '', email: '', role: roles[0] || 'Operations', isActive: true });
    setAdminModalVisible(true);
    loadPendingPlatformInvites();
  };

  const openEditAdminModal = useCallback((record) => {
    setEditingAdmin(record);
    setGeneratedInviteLink(null);
    adminForm.reset({
      name: record.name,
      email: record.email,
      isActive: record.isActive,
      password: '',
    });
    setAdminModalVisible(true);
  }, [adminForm]);

  const handleCopyInviteLink = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      showSuccess('Invite link copied to clipboard');
    }
  };

  const handleRevokePlatformInvite = useCallback(async (id) => {
    try {
      setRevokingInviteId(id);
      await adminService.revokePlatformAdminInvite(id);
      showSuccess('Invite revoked');
      await loadPendingPlatformInvites();
    } catch {
      showError(null, 'Failed to revoke invite');
    } finally {
      setRevokingInviteId(null);
    }
  }, [loadPendingPlatformInvites]);

  const handleAdminSubmit = adminForm.handleSubmit(async (values) => {
    setAdminSaving(true);
    try {
      if (editingAdmin) {
        await adminService.updatePlatformAdmin(editingAdmin.id, {
          name: values.name,
          isActive: values.isActive,
          ...(values.password ? { password: values.password } : {}),
        });
        showSuccess('Platform admin updated');
        setAdminModalVisible(false);
        await loadPlatformAdmins();
      } else {
        const res = await adminService.invitePlatformAdmin({
          email: values.email?.trim(),
          role: values.role || platformInviteRoles[0] || 'Operations',
        });
        const inviteUrl = res?.data?.inviteUrl ?? res?.data?.data?.inviteUrl;
        if (inviteUrl) {
          setGeneratedInviteLink(inviteUrl);
          showSuccess('Invite created. Share the link with the invitee.');
        }
        await loadPendingPlatformInvites();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message;
      if (msg?.includes('already exists') && error?.response?.data?.data?.inviteUrl) {
        setGeneratedInviteLink(error.response.data.data.inviteUrl);
        showSuccess('An active invite already exists. Showing existing link.');
        await loadPendingPlatformInvites();
      } else {
        console.error('Failed to invite platform admin', error);
        showError(null, msg || 'Failed to invite');
      }
    } finally {
      setAdminSaving(false);
    }
  });

  const adminColumns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text) => text || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) =>
        isActive ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Inactive</span>,
    },
    {
      title: 'Last login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date) => (date ? new Date(date).toLocaleDateString() : 'Never'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button variant="ghost" size="sm" onClick={() => openEditAdminModal(record)}>
          Edit
        </Button>
      ),
    },
  ], [openEditAdminModal]);

  // ============================================================
  // Subscription Plans Handlers
  // ============================================================

  const loadFeatureCatalog = async () => {
    try {
      const response = await adminService.getFeatureCatalog();
      if (response?.success) {
        setFeatureCatalog(response.data.features || []);
        setFeatureCategories(response.data.categories || {});
        setFeaturesByCategory(response.data.featuresByCategory || {});
      }
    } catch (error) {
      console.error('Failed to load feature catalog', error);
    }
  };

  const loadModules = async () => {
    try {
      const response = await adminService.getModules();
      if (response?.success) {
        setModules(response.data.modules || []);
        setAllFeatures(response.data.allFeatures || []);
      }
    } catch (error) {
      console.error('Failed to load modules', error);
    }
  };

  const loadSubscriptionPlans = async () => {
    console.log('[AdminSettings] loadSubscriptionPlans: Starting...');
    setPlansLoading(true);
    try {
      console.log('[AdminSettings] loadSubscriptionPlans: Calling adminService.getSubscriptionPlans()...');
      const response = await adminService.getSubscriptionPlans();
      console.log('[AdminSettings] loadSubscriptionPlans: Raw response received:', response);
      console.log('[AdminSettings] loadSubscriptionPlans: Response type:', typeof response);
      console.log('[AdminSettings] loadSubscriptionPlans: Is array?', Array.isArray(response));
      console.log('[AdminSettings] loadSubscriptionPlans: Response keys:', response ? Object.keys(response) : 'null/undefined');
      
      // Axios interceptor returns response.data, so response is already unwrapped
      if (response?.success) {
        console.log('[AdminSettings] loadSubscriptionPlans: Response has success=true');
        const plansData = response.data || response;
        console.log('[AdminSettings] loadSubscriptionPlans: plansData:', plansData);
        console.log('[AdminSettings] loadSubscriptionPlans: plansData type:', typeof plansData);
        console.log('[AdminSettings] loadSubscriptionPlans: plansData is array?', Array.isArray(plansData));
        
        // Handle both array and object with data property
        const plansArray = Array.isArray(plansData) ? plansData : (plansData?.data || []);
        console.log('[AdminSettings] loadSubscriptionPlans: Final plansArray:', plansArray);
        console.log('[AdminSettings] loadSubscriptionPlans: plansArray length:', plansArray?.length);
        console.log('[AdminSettings] loadSubscriptionPlans: Setting plans state...');
        setPlans(plansArray);
        console.log('[AdminSettings] loadSubscriptionPlans: Plans state set successfully');
      } else if (Array.isArray(response)) {
        // If response is directly an array
        console.log('[AdminSettings] loadSubscriptionPlans: Response is directly an array');
        console.log('[AdminSettings] loadSubscriptionPlans: Array length:', response.length);
        console.log('[AdminSettings] loadSubscriptionPlans: Setting plans directly:', response);
        setPlans(response);
      } else {
        console.warn('[AdminSettings] loadSubscriptionPlans: Unexpected response format');
        console.warn('[AdminSettings] loadSubscriptionPlans: Response:', JSON.stringify(response, null, 2));
        console.warn('[AdminSettings] loadSubscriptionPlans: Setting empty array');
        setPlans([]);
      }
    } catch (error) {
      console.error('[AdminSettings] loadSubscriptionPlans: ERROR occurred');
      console.error('[AdminSettings] loadSubscriptionPlans: Error object:', error);
      console.error('[AdminSettings] loadSubscriptionPlans: Error message:', error?.message);
      console.error('[AdminSettings] loadSubscriptionPlans: Error response:', error?.response);
      console.error('[AdminSettings] loadSubscriptionPlans: Error response data:', error?.response?.data);
      showError(null, 'Failed to load subscription plans');
      setPlans([]);
    } finally {
      console.log('[AdminSettings] loadSubscriptionPlans: Finally block - setting loading to false');
      setPlansLoading(false);
    }
  };

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    planForm.reset({
      planId: '', name: '', order: 0, description: '', isActive: true,
      priceAmount: '', priceCurrency: 'GHS', priceDisplay: '', priceBillingDescription: '',
      seatLimit: '', seatPricePerAdditional: '', storageLimitMB: '', storagePrice100GB: '',
      highlights: '', marketingEnabled: true, marketingPerks: '', marketingPopular: false,
      marketingBadgeLabel: '', onboardingEnabled: true, onboardingSubtitle: '', onboardingIsDefault: false,
    });
    setPlanModalVisible(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    const featureFlags = plan.marketing?.featureFlags || {};
    const values = {
      planId: plan.planId,
      order: plan.order,
      name: plan.name,
      description: plan.description,
      priceAmount: plan.price?.amount,
      priceCurrency: plan.price?.currency || 'GHS',
      priceDisplay: plan.price?.display,
      priceBillingDescription: plan.price?.billingDescription,
      seatLimit: plan.seatLimit ?? '',
      seatPricePerAdditional: plan.seatPricePerAdditional ?? '',
      storageLimitMB: plan.storageLimitMB ?? '',
      storagePrice100GB: plan.storagePrice100GB ?? '',
      highlights: plan.highlights?.join('\n') || '',
      marketingEnabled: plan.marketing?.enabled,
      marketingPerks: plan.marketing?.perks?.join('\n') || '',
      marketingPopular: plan.marketing?.popular,
      marketingBadgeLabel: plan.marketing?.badgeLabel,
      onboardingEnabled: plan.onboarding?.enabled,
      onboardingSubtitle: plan.onboarding?.subtitle,
      onboardingIsDefault: plan.onboarding?.isDefault,
      isActive: plan.isActive,
      ...featureFlags,
    };
    planForm.reset(values);
    setPlanModalVisible(true);
  };

  const toggleModule = (moduleKey, checked) => {
    const module = modules.find(m => m.key === moduleKey);
    if (!module) return;

    module.features.forEach(feature => {
      planForm.setValue(feature.key, checked);
    });
    
    showSuccess(`${checked ? 'Enabled' : 'Disabled'} ${module.name} module`);
  };

  const generateMarketingCopy = () => {
    const values = planForm.getValues();
    
    // Get enabled features from ALL_FEATURES list
    const enabledFeatures = allFeatures.filter(feature => values[feature.key] === true);
    
    // Generate highlights
    const highlights = enabledFeatures
      .map(f => f.marketingCopy?.highlight)
      .filter(Boolean)
      .join('\n');
    
    // Generate perks
    const perks = enabledFeatures
      .map(f => f.marketingCopy?.perk)
      .filter(Boolean)
      .join('\n');
    
    planForm.setValue('highlights', highlights);
    planForm.setValue('marketingPerks', perks);
    
    showSuccess(`Generated ${enabledFeatures.length} highlights and perks from enabled features!`);
  };

  const handlePlanSubmit = planForm.handleSubmit(async (values) => {
    try {
      // Extract feature flags from form values (use allFeatures from modules)
      const featureFlags = {};
      allFeatures.forEach(feature => {
        featureFlags[feature.key] = values[feature.key] === true;
      });

      const planData = {
        planId: values.planId,
        order: values.order || 0,
        name: values.name,
        description: values.description,
        price: {
          amount: values.priceAmount,
          currency: values.priceCurrency || 'GHS',
          display: values.priceDisplay,
          billingDescription: values.priceBillingDescription,
        },
        seatLimit: values.seatLimit || null,
        seatPricePerAdditional: values.seatPricePerAdditional || null,
        storageLimitMB: values.storageLimitMB || null,
        storagePrice100GB: values.storagePrice100GB || null,
        highlights: values.highlights ? values.highlights.split('\n').filter(Boolean) : [],
        marketing: {
          enabled: values.marketingEnabled !== false,
          perks: values.marketingPerks ? values.marketingPerks.split('\n').filter(Boolean) : [],
          popular: values.marketingPopular || false,
          badgeLabel: values.marketingBadgeLabel || null,
          featureFlags: featureFlags,
        },
        onboarding: {
          enabled: values.onboardingEnabled !== false,
          subtitle: values.onboardingSubtitle || null,
          isDefault: values.onboardingIsDefault || false,
        },
        isActive: values.isActive !== false,
      };

      if (editingPlan) {
        await adminService.updateSubscriptionPlan(editingPlan.id, planData);
        showSuccess('Subscription plan updated successfully');
      } else {
        await adminService.createSubscriptionPlan(planData);
        showSuccess('Subscription plan created successfully');
      }

      setPlanModalVisible(false);
      await loadSubscriptionPlans();
    } catch (error) {
      console.error('Failed to save subscription plan', error);
      showError(error, error?.response?.data?.message || 'Failed to save subscription plan');
    }
  });

  const handleDeletePlan = useCallback(async (planId) => {
    try {
      await adminService.deleteSubscriptionPlan(planId);
      showSuccess('Subscription plan deleted successfully');
      await loadSubscriptionPlans();
    } catch (error) {
      console.error('Failed to delete subscription plan', error);
      showError(null, 'Failed to delete subscription plan');
    }
  }, [loadSubscriptionPlans]);

  const handleSyncPaystackPlans = async () => {
    setSyncingPlans(true);
    try {
      console.log('[AdminSettings] handleSyncPaystackPlans: Starting sync...');
      const response = await adminService.syncPaystackPlans();
      console.log('[AdminSettings] handleSyncPaystackPlans: Sync response:', response);
      
      if (response?.success) {
        showSuccess(`Successfully synced ${response.synced || 0} plans from Paystack`);
        await loadSubscriptionPlans();
      } else {
        showError(null, response?.message || 'Failed to sync plans from Paystack');
      }
    } catch (error) {
      console.error('[AdminSettings] handleSyncPaystackPlans: Error:', error);
      showError(error, 'Failed to sync plans from Paystack');
    } finally {
      setSyncingPlans(false);
    }
  };

  const planColumns = useMemo(() => [
    {
      title: 'Order',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a, b) => a.order - b.order,
    },
    {
      title: 'Plan ID',
      dataIndex: 'planId',
      key: 'planId',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Price',
      dataIndex: ['price', 'display'],
      key: 'price',
      render: (display) => display || '—',
    },
    {
      title: 'Seats',
      key: 'seats',
      render: (_, record) => {
        if (record.seatLimit === null) {
          return <Badge variant="default">Unlimited</Badge>;
        }
        return (
          <span>
            {record.seatLimit} seats
            {record.seatPricePerAdditional && (
              <Badge variant="secondary" className="ml-1">+₵ {record.seatPricePerAdditional}/seat</Badge>
            )}
          </span>
        );
      },
    },
    {
      title: 'Storage',
      key: 'storage',
      render: (_, record) => {
        if (record.storageLimitMB === null) {
          return <Badge variant="default">Unlimited</Badge>;
        }
        const storageGB = (record.storageLimitMB / 1024).toFixed(0);
        return (
          <span>
            {storageGB} GB
            {record.storagePrice100GB && (
              <Badge variant="secondary" className="ml-1">+₵ {record.storagePrice100GB}/100GB</Badge>
            )}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) =>
        isActive ? <Badge variant="default">Active</Badge> : <Badge variant="destructive">Inactive</Badge>,
    },
    {
      title: 'Marketing',
      key: 'marketing',
      render: (_, record) => (
        <div className="flex gap-1">
          {record.marketing?.enabled && <Badge variant="secondary">Enabled</Badge>}
          {record.marketing?.popular && <Badge variant="outline">Popular</Badge>}
        </div>
      ),
    },
    {
      title: 'Onboarding',
      key: 'onboarding',
      render: (_, record) => (
        <div className="flex gap-1">
          {record.onboarding?.enabled && <Badge variant="secondary">Enabled</Badge>}
          {record.onboarding?.isDefault && <Badge variant="outline">Default</Badge>}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <PlanActionsCell record={record} onEdit={openEditPlanModal} onDelete={handleDeletePlan} />
      ),
    },
  ], [handleDeletePlan]);

  // Check permission after all hooks
  if (!permissionsLoading && !hasPermission('settings.view')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view settings.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
          <Tabs value={activeTab} onValueChange={(key) => setSearchParams({ tab: key })}>
            <TabsList>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="featureFlags">Feature Flags</TabsTrigger>
              <TabsTrigger value="communications">Communications</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
              <TabsTrigger value="invite">Invite</TabsTrigger>
              <TabsTrigger value="subscriptionPlans">Subscription Plans</TabsTrigger>
            </TabsList>
            <TabsContent value="branding" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="branding.appName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application name</FormLabel>
                      <FormControl>
                        <Input placeholder="ShopWISE" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="branding.primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary color</FormLabel>
                      <FormControl>
                        <Input placeholder="#2f80ed" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="branding.secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary color</FormLabel>
                      <FormControl>
                        <Input placeholder="#9b51e0" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Label>Logo</Label>
                  {brandingLogoPreview ? (
                    <img
                      src={brandingLogoPreview}
                      alt="Brand logo"
                      loading="lazy"
                      className="w-[120px] h-[120px] object-contain rounded-lg border border-border p-2 bg-muted"
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] border border-dashed border-border rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">No logo uploaded</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">This logo is displayed on invoices and quotes.</p>
                  <div className="mt-2">
                    <FileUpload
                                onFileSelect={handleLogoUpload}
                                disabled={false}
                                uploading={brandingLogoUploading}
                                accept="image/png,image/jpeg,image/svg+xml"
                                maxSizeMB={5}
                                uploadedFiles={brandingLogoPreview ? [{
                                  id: 'branding-logo',
                                  fileUrl: brandingLogoPreview,
                                  originalName: 'Brand Logo',
                                  name: 'Brand Logo',
                                  url: resolveFileUrl(brandingLogoPreview)
                                }] : []}
                                onFilePreview={() => setBrandingLogoPreviewVisible(true)}
                                onFileRemove={() => {
                                  const currentBranding = form.getValues('branding') || {};
                                  form.setValue('branding', {
                                    ...currentBranding,
                                    logoUrl: '',
                                  });
                                  setBrandingLogoPreview('');
                                }}
                      showFileList={true}
                      emptyMessage="No logo uploaded yet."
                    />
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="branding.emailFooter"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Email footer</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Thank you for using ShopWISE." {...field} />
                    </FormControl>
                    <FormDescription>Appears at the bottom of all system emails.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            <TabsContent value="featureFlags" className="mt-6">
              <FormField
                control={form.control}
                name="featureFlags.advancedAnalytics"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <FormLabel>Advanced analytics</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="featureFlags.autoBilling"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <FormLabel>Automatic billing</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="featureFlags.publicSignup"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <FormLabel>Public signup</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <p className="text-sm text-muted-foreground mt-4">These toggles control global availability of features across all tenants.</p>
            </TabsContent>
            <TabsContent value="communications" className="mt-6 space-y-4">
              <FormField
                control={form.control}
                name="communications.supportEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="support@shopwise.app" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="communications.marketingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marketing email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="marketing@shopwise.app" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="communications.smsSender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS sender ID</FormLabel>
                    <FormControl>
                      <Input placeholder="SHOPWISE" {...field} />
                    </FormControl>
                    <FormDescription>ID used for SMS notifications, if configured.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            <TabsContent value="roles" className="mt-6">
              <AdminRoles />
            </TabsContent>
            <TabsContent value="invite" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Platform administrators</CardTitle>
                  <Button onClick={openCreateAdminModal} className="bg-[#166534] hover:bg-[#14502a]">
                    Invite admin
                  </Button>
                </CardHeader>
                <CardContent>
                {isMobile ? (
                  <div className="flex flex-col gap-3">
                    {admins.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground">No admins</div>
                    ) : (
                      admins.map((admin) => (
                        <Card key={admin.id} className="border">
                          <CardContent className="pt-4">
                            <p className="font-semibold">{admin.name || '—'}</p>
                            <p className="text-muted-foreground text-sm mt-1">{admin.email}</p>
                            <div className="mt-3 pt-3 border-t border-border">
                              {admin.isActive ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Inactive</span>}
                              {admin.lastLogin && <span className="text-muted-foreground text-xs ml-2">Last login: {new Date(admin.lastLogin).toLocaleDateString()}</span>}
                            </div>
                            <Button variant="ghost" size="sm" className="mt-2" onClick={() => openEditAdminModal(admin)}>Edit</Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <AdminsTable columns={adminColumns} data={admins} />
                )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="subscriptionPlans" className="mt-6">
              <p className="text-muted-foreground mb-4">Manage subscription plans that appear on your marketing site and tenant onboarding flow.</p>
              <div className="flex gap-2 mb-4">
                <Button onClick={openCreatePlanModal} className="bg-[#166534] hover:bg-[#14502a]">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Plan
                </Button>
                <Button variant="outline" onClick={handleSyncPaystackPlans} disabled={syncingPlans}>
                  {syncingPlans ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync from Paystack
                </Button>
              </div>
              <PlansTable columns={planColumns} data={plans} loading={plansLoading} />
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <Button type="submit" disabled={saving || loading} className="bg-[#166534] hover:bg-[#14502a]">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save settings
            </Button>
          </div>
          </form>
        </Form>
        </CardContent>
      </Card>

      <Dialog open={adminModalVisible} onOpenChange={(open) => {
        if (!open) setGeneratedInviteLink(null);
        setAdminModalVisible(open);
      }}>
        <DialogContent className="sm:max-w-[28rem]">
          <DialogHeader className="pb-2">
            <DialogTitle>{editingAdmin ? 'Edit platform admin' : 'Invite platform admin'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingAdmin ? 'Edit name, password, or active status.' : 'Send an invite link by email and role.'}
            </DialogDescription>
          </DialogHeader>
          {editingAdmin ? (
            <Form {...adminForm}>
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div className="px-4 sm:px-6 pt-0 pb-2 space-y-4">
                <FormField
                  control={adminForm.control}
                  name="name"
                  rules={{ required: 'Please enter a name' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (leave blank to keep current)</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} placeholder="••••••••" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAdminModalVisible(false)}>Cancel</Button>
                  <Button type="submit" disabled={adminSaving} className="bg-[#166534] hover:bg-[#14502a]">
                    {adminSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <>
              <Form {...adminForm}>
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="px-4 sm:px-6 pt-0 pb-2 space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="email"
                    rules={{ required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Enter a valid email' } }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="admin@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="role"
                    rules={{ required: 'Role is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {platformInviteRoles.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                  {!generatedInviteLink && (
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setAdminModalVisible(false)}>Cancel</Button>
                      <Button type="submit" disabled={adminSaving} className="bg-[#166534] hover:bg-[#14502a]">
                        {adminSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Send invite
                      </Button>
                    </DialogFooter>
                  )}
                </form>
              </Form>
              {generatedInviteLink && (
                <div className="px-4 sm:px-6 pt-2 pb-4 space-y-3">
                  <Label>Invite link</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatedInviteLink} className="font-mono text-sm" />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopyInviteLink} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Share this link with the invitee. They will set their password when they sign up.</p>
                  <Button type="button" variant="outline" onClick={() => { setGeneratedInviteLink(null); }}>Invite another</Button>
                  <Button type="button" onClick={() => setAdminModalVisible(false)}>Done</Button>
                </div>
              )}
              {pendingPlatformInvites.length > 0 && (
                <div className="px-4 sm:px-6 pt-4 space-y-2 border-t border-border">
                  <Label>Pending invites</Label>
                  <ul className="space-y-1">
                    {pendingPlatformInvites.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between text-sm py-1">
                        <span>{inv.email}{inv.name ? ` (${inv.name})` : ''}{inv.platformAdminRoleName ? ` · ${inv.platformAdminRoleName}` : ''}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokePlatformInvite(inv.id)}
                          disabled={revokingInviteId === inv.id}
                        >
                          {revokingInviteId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={planModalVisible} onOpenChange={setPlanModalVisible}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingPlan ? 'Update plan details and features.' : 'Create a new subscription plan.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...planForm}>
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="planId"
                  rules={{ required: 'Please enter plan ID' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan ID</FormLabel>
                      <FormControl>
                        <Input placeholder="trial" disabled={Boolean(editingPlan)} {...field} />
                      </FormControl>
                      <FormDescription>Unique identifier (e.g., trial, launch, scale)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="name"
                  rules={{ required: 'Please enter plan name' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Free Trial" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : 0)} />
                      </FormControl>
                      <FormDescription>For sorting (lower = first)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={planForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Brief description of the plan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="font-semibold">Pricing</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={planForm.control}
                  name="priceAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} placeholder="799" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="priceCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input placeholder="₵" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="priceDisplay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display</FormLabel>
                      <FormControl>
                        <Input placeholder="₵ 799/mo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={planForm.control}
                name="priceBillingDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Description</FormLabel>
                    <FormControl>
                      <Input placeholder="₵ 799 per month, billed annually" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="font-semibold mt-4">Seat Limits</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="seatLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Seats</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={1000} placeholder="e.g., 5, 15, or leave empty" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                      </FormControl>
                      <FormDescription>Leave empty for unlimited seats</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="seatPricePerAdditional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Per Additional Seat</FormLabel>
                      <FormControl>
                        <div className="flex rounded-md border border-input">
                          <span className="inline-flex items-center px-3 text-sm text-muted-foreground border-r border-input bg-muted">₵</span>
                          <Input type="number" min={0} step={0.01} className="border-0 rounded-l-none" placeholder="e.g., 25.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                        </div>
                      </FormControl>
                      <FormDescription>Cost to add seats beyond base limit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="font-semibold mt-4">Storage Limits</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={planForm.control}
                  name="storageLimitMB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Storage Limit (MB)</FormLabel>
                      <FormControl>
                        <Input type="number" min={100} max={1000000} step={1024} placeholder="e.g., 1024 (1GB), 10240 (10GB)" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                      </FormControl>
                      <FormDescription>Leave empty for unlimited storage (1024 MB = 1 GB)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="storagePrice100GB"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Per 100GB</FormLabel>
                      <FormControl>
                        <div className="flex rounded-md border border-input">
                          <span className="inline-flex items-center px-3 text-sm text-muted-foreground border-r border-input bg-muted">₵</span>
                          <Input type="number" min={0} step={0.01} className="border-0 rounded-l-none" placeholder="e.g., 15.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
                        </div>
                      </FormControl>
                      <FormDescription>Cost to add 100GB beyond base limit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={planForm.control}
                name="highlights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <span>Highlights</span>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 ml-2" onClick={generateMarketingCopy}>
                        Auto-generate from features
                      </Button>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Unlimited invoices & jobs&#10;Up to 5 team members" {...field} />
                    </FormControl>
                    <FormDescription>One highlight per line (or click auto-generate)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="font-semibold">Marketing Settings</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={planForm.control}
                  name="marketingEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Enabled on Marketing Site</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="marketingPopular"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Popular Badge</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="marketingBadgeLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Label</FormLabel>
                      <FormControl>
                        <Input placeholder="Recommended" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={planForm.control}
                name="marketingPerks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <span>Marketing Perks</span>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 ml-2" onClick={generateMarketingCopy}>
                        Auto-generate from features
                      </Button>
                    </FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Up to 5 seats&#10;Email support" {...field} />
                    </FormControl>
                    <FormDescription>One perk per line (or click auto-generate)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert className="my-6">
                <AlertTitle>Module-Based Pricing</AlertTitle>
                <AlertDescription>
                  <p className="mb-2"><strong>Step 1:</strong> Toggle entire modules ON/OFF below (or expand to toggle individual features)</p>
                  <p className="mb-2"><strong>Step 2:</strong> Click &quot;Auto-generate&quot; buttons above to create marketing copy</p>
                  <p className="mb-2"><strong>Step 3:</strong> Customize the generated text as needed</p>
                  <p className="text-xs text-muted-foreground mt-2">Tip: Modules group related features - toggle a whole module to enable all its features at once!</p>
                </AlertDescription>
              </Alert>

              <p className="font-semibold mb-2">Feature Modules</p>
              <p className="text-sm text-muted-foreground mb-4">Toggle modules to include/exclude groups of features. Click on a module to see individual features.</p>

              <div className="space-y-2 mb-4">
            {modules.map((module) => {
              const values = planForm.getValues();
              const moduleFeatures = module.features || [];
              const enabledCount = moduleFeatures.filter(f => values[f.key] === true).length;
              const allEnabled = enabledCount === moduleFeatures.length;
              const someEnabled = enabledCount > 0 && !allEnabled;

              return (
                <Collapsible key={module.key} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-4 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={someEnabled ? 'indeterminate' : allEnabled}
                      onCheckedChange={(checked) => toggleModule(module.key, checked === true)}
                    />
                    <CollapsibleTrigger className="flex-1 flex items-center gap-2 text-left hover:underline">
                      <span className="font-semibold">{module.name}</span>
                      <Badge variant={allEnabled ? 'default' : someEnabled ? 'secondary' : 'outline'}>
                        {enabledCount}/{moduleFeatures.length} features
                      </Badge>
                      <span className="text-sm text-muted-foreground">{module.description}</span>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="pl-8 pt-4 space-y-4">
                      {moduleFeatures.map((feature) => (
                        <FormField
                          key={feature.key}
                          control={planForm.control}
                          name={feature.key}
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="font-semibold !mt-0">{feature.name}</FormLabel>
                                {feature.limits && <Badge variant="secondary" className="text-xs">Has usage limits</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground pl-10">{feature.description}</p>
                              {feature.marketingCopy && (
                                <p className="text-xs text-muted-foreground pl-10 italic">Marketing: &quot;{feature.marketingCopy.perk}&quot;</p>
                              )}
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
              </div>

              <p className="font-semibold mt-4">Onboarding Settings</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={planForm.control}
                  name="onboardingEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Enabled on Onboarding</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="onboardingIsDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <FormLabel>Default Plan</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={planForm.control}
                  name="onboardingSubtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl>
                        <Input placeholder="Recommended" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPlanModalVisible(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#166534] hover:bg-[#14502a]">Save</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <FilePreview
        open={brandingLogoPreviewVisible}
        onClose={() => setBrandingLogoPreviewVisible(false)}
        file={brandingLogoPreview ? {
          fileUrl: brandingLogoPreview,
          title: 'Brand Logo',
          metadata: {}
        } : null}
      />
    </>
  );
};

export default AdminSettings;

