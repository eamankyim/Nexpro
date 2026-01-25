import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, ArrowLeft, Loader2, X, Check, Camera, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import authService from '../services/authService';
import dashboardService from '../services/dashboardService';
import ReactCountryFlag from 'react-country-flag';

const onboardingSchema = z.object({
  shopType: z.string().optional(),
  companyName: z.string().optional().or(z.literal('')),
  companyLogo: z.any().optional(),
  companyAddress: z.string().optional().or(z.literal('')),
  industry: z.string().optional(),
  companyEmail: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phoneCountryCode: z.string().min(1, 'Country code is required'),
  companyPhone: z.string().min(1, 'Phone number is required'),
  companyWebsite: z.string().refine(
    (val) => {
      if (!val || val === '') return true;
      // Add protocol if missing
      const url = val.startsWith('http://') || val.startsWith('https://') ? val : `https://${val}`;
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid URL' }
  ).optional().or(z.literal(''))
});

const countryCodes = [
  { code: '+233', country: 'GH', name: 'Ghana' },
  { code: '+234', country: 'NG', name: 'Nigeria' },
  { code: '+254', country: 'KE', name: 'Kenya' },
  { code: '+27', country: 'ZA', name: 'South Africa' },
  { code: '+255', country: 'TZ', name: 'Tanzania' },
  { code: '+256', country: 'UG', name: 'Uganda' },
  { code: '+250', country: 'RW', name: 'Rwanda' },
  { code: '+225', country: 'CI', name: 'Ivory Coast' },
  { code: '+212', country: 'MA', name: 'Morocco' },
  { code: '+251', country: 'ET', name: 'Ethiopia' },
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
];

const businessTypes = [
  {
    value: 'shop',
    label: 'Shop Management',
    description: 'Point of sale, inventory, and sales management'
  },
  {
    value: 'printing_press',
    label: 'Studio Management',
    description: 'Manage print jobs, quotes, and production workflows'
  },
  {
    value: 'pharmacy',
    label: 'Pharmacy Management',
    description: 'Prescription management, drug inventory, and patient records'
  }
];

const shopTypes = [
  { value: 'supermarket', label: 'Supermarket/Grocery Store' },
  { value: 'hardware', label: 'Hardware Store' },
  { value: 'electronics', label: 'Electronics Store' },
  { value: 'clothing', label: 'Clothing/Fashion Store' },
  { value: 'furniture', label: 'Furniture Store' },
  { value: 'bookstore', label: 'Bookstore' },
  { value: 'auto_parts', label: 'Auto Parts Store' },
  { value: 'convenience', label: 'General Store/Convenience Store' },
  { value: 'beauty', label: 'Beauty/Cosmetics Store' },
  { value: 'sports', label: 'Sports Store' },
  { value: 'toys', label: 'Toy Store' },
  { value: 'pet', label: 'Pet Store' },
  { value: 'stationery', label: 'Stationery Store' },
  { value: 'other', label: 'Other' }
];


const Onboarding = () => {
  const navigate = useNavigate();
  const { user, activeTenant, refreshAuthState } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Check if onboarding is already completed
  useEffect(() => {
    const onboardingCompleted = activeTenant?.metadata?.onboarding?.completedAt;
    if (onboardingCompleted) {
      // User already completed onboarding, redirect to dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [activeTenant, navigate]);

  const form = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      shopType: '',
      companyName: '',
      companyLogo: undefined,
      companyAddress: '',
      companyEmail: '',
      phoneCountryCode: '+233', // Default to Ghana, required field
      companyPhone: '',
      companyWebsite: ''
    }
  });

  const fileInputRef = useRef(null);

  // Get businessType from tenant (set during signup)
  const businessType = activeTenant?.businessType || 'printing_press';
  const isShop = businessType === 'shop';

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      // Prepare form data for file upload
      const formData = new FormData();
      
      // Use businessType from tenant, not form
      formData.append('businessType', businessType);
      
      if (isShop && values.shopType) {
        formData.append('shopType', values.shopType);
      }
      if (values.companyName) formData.append('companyName', values.companyName);
      if (values.companyEmail) formData.append('companyEmail', values.companyEmail);
      // Phone is required, so always append it
      const fullPhone = values.phoneCountryCode ? `${values.phoneCountryCode} ${values.companyPhone}` : values.companyPhone;
      formData.append('companyPhone', fullPhone);
      if (values.companyWebsite) {
        // Add protocol if missing
        const website = values.companyWebsite.startsWith('http://') || values.companyWebsite.startsWith('https://') 
          ? values.companyWebsite 
          : `https://${values.companyWebsite}`;
        formData.append('companyWebsite', website);
      }
      if (values.companyAddress) formData.append('companyAddress', values.companyAddress);
      if (values.companyLogo) formData.append('companyLogo', values.companyLogo);

      // Save onboarding data to backend
      await api.post('/tenants/onboarding', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Refresh auth state so AuthContext has the latest tenant (including metadata.onboarding.completedAt)
      try {
        console.log('[Onboarding] After POST /tenants/onboarding: calling refreshAuthState, typeof=%s', typeof refreshAuthState);
        if (typeof refreshAuthState === 'function') {
          const refreshed = await refreshAuthState();
          console.log('[Onboarding] refreshAuthState done. first membership tenant.metadata.onboarding=%j', refreshed?.memberships?.[0]?.tenant?.metadata?.onboarding);
        } else {
          const body = await authService.getCurrentUser();
          const userData = body?.data ?? body;
          const memberships = userData?.tenantMemberships || [];
          authService.persistAuthPayload({
            user: userData,
            memberships: memberships,
            defaultTenantId: memberships[0]?.tenantId || null
          });
        }
      } catch (refreshError) {
        console.error('Failed to refresh user data after onboarding:', refreshError);
        // Continue with navigation even if refresh fails
      }

      // Invalidate queries to refresh tenant data and wait for them to complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
        queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] })
      ]);

      // Prefetch dashboard data to ensure it's ready when user lands on dashboard
      try {
        await dashboardService.getOverview();
      } catch (dashboardError) {
        console.error('Failed to prefetch dashboard data:', dashboardError);
        // Continue even if prefetch fails - dashboard will load on its own
      }

      // Wait a moment for AuthContext to update
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now navigate - animation will continue until dashboard is ready
      setLoading(false);
      showSuccess('Onboarding completed! Redirecting to your dashboard...');
      console.log('[Onboarding] Navigating to /dashboard');
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save onboarding data. Please try again.';
      showError(error, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Skip onboarding and go to dashboard
  const handleSkip = () => {
    navigate('/dashboard');
  };

  const watchedValues = form.watch();
  
  // Conditionally include shop type step only for retail shops
  const getTimelineSteps = () => {
    const steps = [
      { id: 'account', label: 'Create Account', completed: true },
    ];
    
    if (isShop) {
      steps.push({ id: 'shopType', label: 'Shop Type', completed: false });
    }
    
    steps.push(
      { id: 'businessInfo', label: 'Business Info', completed: false },
      { id: 'contactInfo', label: 'Contact Info', completed: false }
    );
    
    return steps;
  };

  const timelineSteps = getTimelineSteps();

  const getSteps = () => {
    const stepsArray = [];
    
    // Add shop type step only if business type is shop
    if (isShop) {
      stepsArray.push({
        id: 'shopType',
        title: 'What type of shop do you run?',
        subtitle: 'Select the specific type of retail shop to customize your inventory categories.',
        fields: ['shopType']
      });
    }
    
    stepsArray.push(
      {
        id: 'businessInfo',
        title: 'Tell us about your business',
        subtitle: 'This information will appear on your invoices and receipts.',
        fields: ['companyLogo', 'companyAddress'] // companyName is optional
      },
      {
        id: 'contactInfo',
        title: 'Contact Information',
        subtitle: 'Add your business contact details.',
        fields: ['phoneCountryCode', 'companyPhone'] // Phone is now required
      }
    );
    
    return stepsArray;
  };

  const steps = getSteps();
  
  // Adjust current step if out of bounds
  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps.length, currentStep]);
  
  const currentStepData = steps[currentStep] || steps[0];
  
  // Search state for dropdowns
  const [shopTypeSearch, setShopTypeSearch] = useState('');
  const [countryCodeSearch, setCountryCodeSearch] = useState('');
  
  // Filter shop types based on search
  const filteredShopTypes = shopTypes.filter(shopType =>
    shopType.label.toLowerCase().includes(shopTypeSearch.toLowerCase())
  );
  
  // Filter country codes based on search
  const filteredCountryCodes = countryCodes.filter(country =>
    country.code.toLowerCase().includes(countryCodeSearch.toLowerCase()) ||
    country.country.toLowerCase().includes(countryCodeSearch.toLowerCase()) ||
    country.name.toLowerCase().includes(countryCodeSearch.toLowerCase())
  );

  const canProceed = () => {
    const requiredFields = currentStepData.fields;
    
    // If no required fields, always allow proceeding
    if (requiredFields.length === 0) {
      return true;
    }
    
    // Check required fields
    const allRequiredFieldsFilled = requiredFields.every(field => {
      const value = watchedValues[field];
      return value !== undefined && value !== '';
    });
    
    // Also check form errors for the current step fields
    const stepFields = currentStepData.fields.length > 0 
      ? currentStepData.fields 
      : ['companyEmail', 'companyPhone', 'companyWebsite']; // For contact info step
    const hasErrors = stepFields.some(field => {
      return form.formState.errors[field] !== undefined;
    });
    
    return allRequiredFieldsFilled && !hasErrors;
  };

  const getTimelineStepStatus = (stepId) => {
    if (stepId === 'account') return 'completed';
    
    // Map stepId to currentStep index
    const getStepIndexMap = () => {
      const map = {};
      let index = 0;
      
      if (isShop) {
        map['shopType'] = index;
        index++;
      }
      
      map['businessInfo'] = index;
      index++;
      map['contactInfo'] = index;
      
      return map;
    };
    
    const stepIndexMap = getStepIndexMap();
    const stepIndex = stepIndexMap[stepId];
    
    if (stepIndex === undefined) return 'pending';
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  const handleNext = async () => {
    const fieldsToValidate = currentStepData.fields;
    const result = await form.trigger(fieldsToValidate);
    
    if (result) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        form.handleSubmit(onSubmit)();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        
        @keyframes blockDrop {
          0% {
            opacity: 0;
            transform: translateY(-50px) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes continuousBuild {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          25% {
            transform: translateY(-8px) scale(1.05);
          }
          50% {
            transform: translateY(0) scale(1);
          }
          75% {
            transform: translateY(-4px) scale(1.02);
          }
        }
        
        .building-block {
          opacity: 0;
          animation: blockDrop 0.6s ease-out forwards, continuousBuild 2.5s ease-in-out 1s infinite;
        }
        
        .building-block.block-1 { animation-delay: 0.1s, 1.1s; }
        .building-block.block-2 { animation-delay: 0.2s, 1.2s; }
        .building-block.block-3 { animation-delay: 0.3s, 1.3s; }
        .building-block.block-4 { animation-delay: 0.4s, 1.4s; }
        .building-block.block-5 { animation-delay: 0.5s, 1.5s; }
        .building-block.block-6 { animation-delay: 0.6s, 1.6s; }
      `}</style>
      
      {/* Creating Workspace Modal */}
      <Dialog open={loading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 bg-white shadow-xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center py-8 px-6">
            <div className="mb-6">
              <div className="relative w-48 h-48 flex items-end justify-center">
                {/* Building Blocks - Stacked */}
                <div className="absolute bottom-0 flex flex-col items-center space-y-1">
                  {/* Bottom row - 3 blocks */}
                  <div className="flex space-x-1">
                    <div className="building-block block-1 w-12 h-12 bg-[#166534] rounded-lg shadow-lg"></div>
                    <div className="building-block block-2 w-12 h-12 bg-[#a3e635] rounded-lg shadow-lg"></div>
                    <div className="building-block block-3 w-12 h-12 bg-[#166534] rounded-lg shadow-lg"></div>
                  </div>
                  {/* Middle row - 2 blocks */}
                  <div className="flex space-x-1">
                    <div className="building-block block-4 w-12 h-12 bg-[#a3e635] rounded-lg shadow-lg"></div>
                    <div className="building-block block-5 w-12 h-12 bg-[#166534] rounded-lg shadow-lg"></div>
                  </div>
                  {/* Top row - 1 block */}
                  <div className="flex">
                    <div className="building-block block-6 w-12 h-12 bg-[#a3e635] rounded-lg shadow-lg"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogTitle className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Creating Your Workspace
            </DialogTitle>
            <DialogDescription className="text-gray-600 text-center">
              We're setting everything up for you...
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50">
      {/* Welcome Message */}
      <div className="pt-8 pb-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Let's set up your workspace</h1>
        <p className="text-gray-600">You can skip this and finish later.</p>
      </div>

      <div className="flex max-w-7xl mx-auto px-8 pb-16">
        {/* Left Sidebar - Timeline (30%) */}
        <div className="w-[30%] pt-8">
          <div className="bg-white rounded-l-xl p-6 border-t border-l border-b border-gray-200 h-[600px] flex flex-col">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Getting Started</h2>
            <div className="relative flex-1 overflow-y-auto custom-scrollbar">
              {timelineSteps.map((step, index) => {
                const status = getTimelineStepStatus(step.id);
                const isLast = index === timelineSteps.length - 1;
                const prevStatus = index > 0 ? getTimelineStepStatus(timelineSteps[index - 1].id) : 'completed';
                
                return (
                  <div key={step.id} className="relative pb-6">
                    <div className="flex items-start gap-3">
                      {/* Icon Circle */}
                      <div className={`relative flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 z-10 ${
                        status === 'completed'
                          ? 'bg-[#166534] border-[#166534]'
                          : status === 'current'
                          ? 'bg-white border-[#166534]'
                          : 'bg-white border-gray-300'
                      }`}>
                        {status === 'completed' ? (
                          <Check className="h-3 w-3 text-white" />
                        ) : status === 'current' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                        ) : null}
                      </div>
                      
                      {/* Label */}
                      <div className="flex-1 pt-1">
                        <div className={`text-sm font-medium ${
                          status === 'completed'
                            ? 'text-[#166534]'
                            : status === 'current'
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                      </div>
                    </div>
                    
                    {/* Connecting Line */}
                    {!isLast && (
                      <div className={`absolute left-[10px] top-5 w-0.5 ${
                        status === 'completed' ? 'bg-[#166534]' : 'bg-gray-300'
                      }`} style={{ height: 'calc(100% - 0.5rem)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-gray-200 h-[600px] mt-8"></div>

        {/* Right Content - Form (70%) */}
        <div className="w-[70%] pt-8">
          <div className="bg-white rounded-r-xl p-8 max-w-3xl border-t border-r border-b border-gray-200 h-[600px] flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                {/* Step 1: Shop Type (only for retail shops) */}
                {currentStep === 0 && currentStepData.id === 'shopType' && (
                  <div className="space-y-6">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        {currentStepData.title}
                      </h2>
                      <p className="text-base text-gray-600 font-normal">
                        {currentStepData.subtitle}
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="shopType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Shop Type</FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ''}
                            >
                              <SelectTrigger className="h-12 text-base border-[1px] border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:border-[1px] focus:border-[#166534] focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[1px] focus-visible:border-[#166534]">
                                <SelectValue placeholder="Select shop type" />
                              </SelectTrigger>
                              <SelectContent className="bg-white border-gray-200 p-0">
                                <div className="p-2 border-b border-gray-200 sticky top-0 bg-white z-10">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                      placeholder="Search shop types..."
                                      value={shopTypeSearch}
                                      onChange={(e) => setShopTypeSearch(e.target.value)}
                                      className="pl-8 h-9 text-sm border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                  {filteredShopTypes.length > 0 ? (
                                    filteredShopTypes.map((shopType) => (
                                      <SelectItem 
                                        key={shopType.value} 
                                        value={shopType.value}
                                        className="!text-gray-900 focus:!bg-gray-100 focus:!text-gray-900 hover:!bg-gray-100 hover:!text-gray-900 data-[highlighted]:!bg-gray-100 data-[highlighted]:!text-gray-900 cursor-pointer"
                                      >
                                        {shopType.label}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <div className="px-2 py-3 text-sm text-gray-500 text-center">No shop types found</div>
                                  )}
                                </div>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 2: Business Info */}
                {currentStepData.id === 'businessInfo' && (
                  <div className="space-y-6">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        {currentStepData.title}
                      </h2>
                      <p className="text-base text-gray-600 font-normal">
                        {currentStepData.subtitle}
                      </p>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="companyLogo"
                      render={({ field: { value, onChange, ...field } }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Company Logo (Optional)</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-4">
                              <div className="relative">
                                {value ? (
                                  <div className="w-20 h-20 rounded-full border-2 border-gray-300 overflow-hidden bg-gray-100">
                                    <img 
                                      src={value instanceof File ? URL.createObjectURL(value) : value} 
                                      alt="Logo preview" 
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-full border-2 border-gray-300 bg-gray-100 flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">Logo</span>
                                  </div>
                                )}
                                <input
                                  id="company-logo-upload"
                                  type="file"
                                  accept="image/*"
                                  ref={fileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      onChange(file);
                                    }
                                  }}
                                  className="hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="absolute bottom-0 right-0 w-6 h-6 bg-[#166534] rounded-full flex items-center justify-center text-white hover:bg-[#14532d] transition-colors shadow-md"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Company Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="h-12 text-base border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                              placeholder="Enter your company name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="h-12 text-base border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                              placeholder="Enter your business address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Step 3: Contact Info */}
                {currentStepData.id === 'contactInfo' && (
                  <div className="space-y-6">
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        {currentStepData.title}
                      </h2>
                      <p className="text-base text-gray-600 font-normal">
                        {currentStepData.subtitle}
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="companyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Business Email (Optional)</FormLabel>
                          <FormDescription className="text-gray-600">
                            If you leave this blank, we will use your account email on invoices.
                          </FormDescription>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              className="h-12 text-base border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                              placeholder="business@company.com"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Business Phone</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <FormField
                                control={form.control}
                                name="phoneCountryCode"
                                render={({ field: codeField }) => (
                                  <FormItem className="w-28">
                                    <Select
                                      onValueChange={codeField.onChange}
                                      value={codeField.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-12 text-base border-[1px] border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:border-[1px] focus:border-[#166534] focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[1px] focus-visible:border-[#166534]">
                                          <div className="flex items-center gap-2 flex-1">
                                            {codeField.value && (() => {
                                              const selected = countryCodes.find(c => c.code === codeField.value);
                                              if (selected) {
                                                return (
                                                  <>
                                                    <ReactCountryFlag 
                                                      countryCode={selected.country} 
                                                      svg 
                                                      style={{ width: '20px', height: '15px' }}
                                                    />
                                                    <span>{selected.code}</span>
                                                  </>
                                                );
                                              }
                                            })()}
                                            {!codeField.value && <SelectValue placeholder="Code" />}
                                          </div>
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent className="bg-white border-gray-200 p-0">
                                        <div className="p-2 border-b border-gray-200 sticky top-0 bg-white z-10">
                                          <div className="relative">
                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                              placeholder="Search country..."
                                              value={countryCodeSearch}
                                              onChange={(e) => setCountryCodeSearch(e.target.value)}
                                              className="pl-8 h-9 text-sm border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                              onClick={(e) => e.stopPropagation()}
                                              onKeyDown={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                          {filteredCountryCodes.length > 0 ? (
                                            filteredCountryCodes.map((country) => (
                                              <SelectItem 
                                                key={country.code} 
                                                value={country.code}
                                                className="!text-gray-900 focus:!bg-gray-100 focus:!text-gray-900 hover:!bg-gray-100 hover:!text-gray-900 data-[highlighted]:!bg-gray-100 data-[highlighted]:!text-gray-900 cursor-pointer"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <ReactCountryFlag 
                                                    countryCode={country.country} 
                                                    svg 
                                                    style={{ width: '20px', height: '15px' }}
                                                  />
                                                  <span>{country.code} {country.name}</span>
                                                </div>
                                              </SelectItem>
                                            ))
                                          ) : (
                                            <div className="px-2 py-3 text-sm text-gray-500 text-center">No countries found</div>
                                          )}
                                        </div>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              <Input
                                {...field}
                                type="tel"
                                className="h-12 text-base border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border flex-1"
                                placeholder="123 456 7890"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="companyWebsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Website (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="url"
                              className="h-12 text-base border-gray-300 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#166534] focus:border focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#166534] focus-visible:border"
                              placeholder="https://www.company.com"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                </form>
              </Form>
            </div>
            
            {/* Navigation Buttons - Outside Form */}
            <div className="flex justify-between pt-6 mt-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                disabled={loading}
                className="text-gray-600 hover:text-gray-900"
              >
                Skip for now
              </Button>
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={loading}
                    className="border-[#166534] text-[#166534] bg-transparent hover:bg-transparent hover:text-[#166534] hover:border-[#166534] transition-colors"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceed() || loading}
                  className="bg-[#166534] hover:bg-[#14532d] text-white font-medium text-base px-6 py-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : currentStep === steps.length - 1 ? (
                    'Finish setup'
                  ) : (
                    <>
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Onboarding;
