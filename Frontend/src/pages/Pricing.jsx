import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, InputNumber, Tag, List, Space } from 'antd';
import { Plus, MinusCircle, Loader2 } from 'lucide-react';
import pricingService from '../services/pricingService';
import customDropdownService from '../services/customDropdownService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import { showSuccess, showError, showWarning } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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

// Zod schemas
const discountTierSchema = z.object({
  minQuantity: z.number().min(1, 'Min quantity must be at least 1'),
  maxQuantity: z.number().optional().nullable(),
  discountPercent: z.number().min(0, 'Discount must be at least 0').max(100, 'Discount cannot exceed 100'),
});

const additionalOptionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  price: z.number().min(0, 'Price must be at least 0'),
});

const pricingTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  category: z.string().min(1, 'Category is required'),
  materialType: z.string().optional(),
  materialSize: z.string().optional(),
  pricingMethod: z.enum(['unit', 'square_foot']).default('unit'),
  pricePerUnit: z.number().optional().nullable(),
  pricePerSquareFoot: z.number().optional().nullable(),
  colorType: z.enum(['black_white', 'color', 'spot_color']).optional(),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
  discountTiers: z.array(discountTierSchema).default([]),
  additionalOptions: z.array(additionalOptionSchema).default([]),
}).refine((data) => {
  // For Design Services, pricePerUnit is required
  if (data.category === 'Design Services') {
    return data.pricePerUnit !== null && data.pricePerUnit !== undefined;
  }
  // For square foot pricing, pricePerSquareFoot is required
  if (data.pricingMethod === 'square_foot' || 
      ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(data.materialType || '')) {
    return data.pricePerSquareFoot !== null && data.pricePerSquareFoot !== undefined;
  }
  // For unit pricing, pricePerUnit is required
  if (data.pricingMethod === 'unit') {
    return data.pricePerUnit !== null && data.pricePerUnit !== undefined;
  }
  return true;
}, {
  message: 'Price is required',
  path: ['pricePerUnit'],
});

const Pricing = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ category: '', isActive: '' });
  const { isManager, isAdmin } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [customCategories, setCustomCategories] = useState([]);
  const [showCategoryOtherInput, setShowCategoryOtherInput] = useState(false);
  const [categoryOtherValue, setCategoryOtherValue] = useState('');

  const form = useForm({
    resolver: zodResolver(pricingTemplateSchema),
    defaultValues: {
      name: '',
      category: '',
      materialType: '',
      materialSize: '',
      pricingMethod: 'unit',
      pricePerUnit: null,
      pricePerSquareFoot: null,
      colorType: undefined,
      isActive: true,
      description: '',
      discountTiers: [],
      additionalOptions: [],
    },
  });

  const { fields: discountTierFields, append: appendDiscountTier, remove: removeDiscountTier } = useFieldArray({
    control: form.control,
    name: 'discountTiers',
  });

  const { fields: additionalOptionFields, append: appendAdditionalOption, remove: removeAdditionalOption } = useFieldArray({
    control: form.control,
    name: 'additionalOptions',
  });

  const category = form.watch('category');
  const pricingMethod = form.watch('pricingMethod');
  const materialType = form.watch('materialType');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching pricing templates...', { pagination, filters });
      
      const cleanFilters = {};
      if (filters.category) cleanFilters.category = filters.category;
      if (filters.isActive) cleanFilters.isActive = filters.isActive;
      
      const response = await pricingService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...cleanFilters,
      });
      console.log('Pricing templates response:', response);
      setTemplates(response.data);
      setPagination(prev => ({ ...prev, total: response.count }));
    } catch (error) {
      console.error('Error fetching pricing templates:', error);
      showError(error, 'Failed to load pricing templates');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates, refreshTrigger]);

  useEffect(() => {
    const loadCustomCategories = async () => {
      try {
        const options = await customDropdownService.getCustomOptions('job_category');
        setCustomCategories(options || []);
      } catch (error) {
        console.error('Failed to load custom categories:', error);
      }
    };
    loadCustomCategories();
  }, []);

  const handleAdd = () => {
    setEditingTemplate(null);
    form.reset({
      name: '',
      category: '',
      materialType: '',
      materialSize: '',
      pricingMethod: 'unit',
      pricePerUnit: null,
      pricePerSquareFoot: null,
      colorType: undefined,
      isActive: true,
      description: '',
      discountTiers: [],
      additionalOptions: [],
    });
    setShowCategoryOtherInput(false);
    setCategoryOtherValue('');
    setModalVisible(true);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    form.reset({
      ...template,
      discountTiers: template.discountTiers || [],
      additionalOptions: template.additionalOptions || [],
    });
    setModalVisible(true);
  };

  const handleView = (template) => {
    setViewingTemplate(template);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingTemplate(null);
  };

  const handleDelete = async (id) => {
    try {
      await pricingService.delete(id);
      showSuccess('Pricing template deleted successfully');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      showError(error, 'Failed to delete pricing template');
    }
  };

  const onSubmit = async (values) => {
    try {
      // Set deprecated fields for backwards compatibility
      values.basePrice = 0;
      values.setupFee = 0;
      values.minimumQuantity = 1;
      values.maximumQuantity = null;
      
      // Clean up custom dimension fields
      values.customHeight = undefined;
      values.customWidth = undefined;
      values.customUnit = undefined;
      
      // For Design Services, set default values
      if (values.category === 'Design Services') {
        values.pricingMethod = 'unit';
        values.materialSize = 'N/A';
        values.pricePerSquareFoot = 0;
        if (!values.colorType) {
          values.colorType = 'color';
        }
      }
      
      // For square-foot pricing materials
      const isSquareFootPricing = values.pricingMethod === 'square_foot' || 
                                  ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(values.materialType || '');
      
      if (isSquareFootPricing && values.category !== 'Design Services') {
        values.pricingMethod = 'square_foot';
        values.pricePerUnit = 0;
        if (!values.colorType) {
          values.colorType = 'color';
        }
      }
      
      if (editingTemplate) {
        await pricingService.update(editingTemplate.id, values);
        showSuccess('Pricing template updated successfully');
      } else {
        await pricingService.create(values);
        showSuccess('Pricing template created successfully');
      }
      setModalVisible(false);
      form.reset();
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      showError(error, error.error || 'Operation failed');
    }
  };

  const defaultCategories = [
    { value: 'Black & White Printing', label: 'Black & White Printing' },
    { value: 'Color Printing', label: 'Color Printing' },
    { value: 'Large Format Printing', label: 'Large Format Printing' },
    { value: 'Business Cards', label: 'Business Cards' },
    { value: 'Brochures', label: 'Brochures' },
    { value: 'Flyers', label: 'Flyers' },
    { value: 'Posters', label: 'Posters' },
    { value: 'Banners', label: 'Banners' },
    { value: 'Booklets', label: 'Booklets' },
    { value: 'Binding', label: 'Binding' },
    { value: 'Lamination', label: 'Lamination' },
    { value: 'Photocopying', label: 'Photocopying' },
    { value: 'Scanning', label: 'Scanning' },
    { value: 'Printing', label: 'Printing' },
    { value: 'Design Services', label: 'Design Services' }
  ];

  const getMergedCategoryOptions = () => {
    const merged = [...defaultCategories];
    customCategories.forEach(cat => {
      if (!merged.find(c => c.value === cat.value)) {
        merged.push({ value: cat.value, label: cat.label });
      }
    });
    return merged;
  };

  const handleCategoryChange = (value) => {
    form.setValue('category', value);
    if (value === '__OTHER__') {
      setShowCategoryOtherInput(true);
    } else {
      setShowCategoryOtherInput(false);
    }
  };

  const handleSaveCustomCategory = async () => {
    if (!categoryOtherValue || !categoryOtherValue.trim()) {
      showWarning('Please enter a category name');
      return;
    }

    try {
      const saved = await customDropdownService.saveCustomOption('job_category', categoryOtherValue.trim());
      if (saved) {
        setCustomCategories(prev => {
          if (prev.find(c => c.value === saved.value)) {
            return prev;
          }
          return [...prev, saved];
        });
        
        form.setValue('category', saved.value);
        setShowCategoryOtherInput(false);
        setCategoryOtherValue('');
        showSuccess(`"${saved.label}" added to categories`);
      }
    } catch (error) {
      showError(error, error.response?.data?.error || 'Failed to save custom category');
    }
  };

  const materialTypes = [
    'Plain Paper',
    'Photo Paper',
    'SAV (Self-Adhesive Vinyl)',
    'Banner',
    'One Way Vision',
    'Canvas',
    'Cardstock',
    'Sticker Paper',
    'Vinyl',
    'Foam Board',
    'Corrugated Board',
    'Bond Paper',
    'Glossy Paper',
    'Matte Paper',
    'Satin Paper',
    'Transparent Vinyl',
    'Mesh Material',
    'Fabric',
    'Other'
  ];

  const materialSizes = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Custom', 'N/A'];

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Badge variant="outline">{category}</Badge>,
    },
    {
      title: 'Base Price',
      dataIndex: 'basePrice',
      key: 'basePrice',
      render: (price) => `GHS ${parseFloat(price || 0).toFixed(2)}`,
    },
    {
      title: 'Price/Unit',
      dataIndex: 'pricePerUnit',
      key: 'pricePerUnit',
      render: (price) => price ? `GHS ${parseFloat(price).toFixed(2)}` : '-',
    },
    {
      title: 'Setup Fee',
      dataIndex: 'setupFee',
      key: 'setupFee',
      render: (fee) => `GHS ${parseFloat(fee || 0).toFixed(2)}`,
    },
    {
      title: 'Color Type',
      dataIndex: 'colorType',
      key: 'colorType',
      render: (type) => {
        const colors = {
          black_white: 'default',
          color: 'blue',
          spot_color: 'purple'
        };
        const labels = {
          black_white: 'B&W',
          color: 'Color',
          spot_color: 'Spot Color'
        };
        return type ? <Badge variant="outline">{labels[type]}</Badge> : '-';
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Badge variant={isActive ? 'default' : 'destructive'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => <ActionColumn onView={handleView} record={record} />,
    },
  ];

  const isDesignService = category === 'Design Services';
  const isSquareFootPricing = pricingMethod === 'square_foot' || 
                              ['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(materialType || '');
  const isPrintingOrPhotocopy = category && (
    category.toLowerCase().includes('printing') ||  
    category.toLowerCase().includes('photocopy')
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pricing Templates</h1>
        <div className="flex items-center gap-2">
          <Select
            value={filters.category || undefined}
            onValueChange={(value) => setFilters({ ...filters, category: value || '' })}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {getMergedCategoryOptions().map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.isActive || undefined}
            onValueChange={(value) => setFilters({ ...filters, isActive: value || '' })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {isManager && (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
        scroll={{ x: 1000 }}
      />

      <Dialog open={modalVisible} onOpenChange={(open) => {
        setModalVisible(open);
        if (!open) {
          setShowCategoryOtherInput(false);
          setCategoryOtherValue('');
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Pricing Template' : 'Add Pricing Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplate ? 'Update the pricing template details' : 'Create a new pricing template'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter template name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={handleCategoryChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {getMergedCategoryOptions().map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                          <SelectItem value="__OTHER__">Other (specify)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {showCategoryOtherInput && (
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., T-shirt Printing, Custom Design"
                    value={categoryOtherValue}
                    onChange={(e) => setCategoryOtherValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveCustomCategory();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleSaveCustomCategory}>
                    Save
                  </Button>
                </div>
              )}

              {/* Material Type and Size */}
              {!isDesignService && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="materialType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Auto-set pricing method
                            if (['SAV (Self-Adhesive Vinyl)', 'Banner', 'One Way Vision'].includes(value)) {
                              form.setValue('pricingMethod', 'square_foot');
                            } else if (value) {
                              const currentPricingMethod = form.getValues('pricingMethod');
                              if (!currentPricingMethod || currentPricingMethod === 'square_foot') {
                                form.setValue('pricingMethod', 'unit');
                              }
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select material type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {materialTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="materialSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material Size</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select material size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {materialSizes.map(size => (
                              <SelectItem key={size} value={size}>{size}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {isDesignService && (
                <FormField
                  control={form.control}
                  name="materialType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Standard">Standard</SelectItem>
                          <SelectItem value="Premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Pricing Fields */}
              {isDesignService ? (
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="pricePerUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Per Unit</FormLabel>
                        <FormControl>
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="GHS "
                            min={0}
                            precision={2}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricingMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pricing Method</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unit">By Unit (Quantity × Price)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Status</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ) : isSquareFootPricing ? (
                <div className={`grid gap-4 ${isPrintingOrPhotocopy ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <FormField
                    control={form.control}
                    name="pricePerSquareFoot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Per Square Foot</FormLabel>
                        <FormControl>
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="GHS "
                            min={0}
                            precision={2}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricingMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pricing Method</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="square_foot">By Square Foot (Size × Price/Sqft)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isPrintingOrPhotocopy && (
                    <FormField
                      control={form.control}
                      name="colorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select color type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="black_white">Black & White</SelectItem>
                              <SelectItem value="color">Color</SelectItem>
                              <SelectItem value="spot_color">Spot Color</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Status</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className={`grid gap-4 ${isPrintingOrPhotocopy ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <FormField
                    control={form.control}
                    name="pricePerUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price Per Unit</FormLabel>
                        <FormControl>
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            prefix="GHS "
                            min={0}
                            precision={2}
                            value={field.value}
                            onChange={(value) => field.onChange(value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pricingMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pricing Method</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unit">By Unit (Quantity × Price)</SelectItem>
                            <SelectItem value="square_foot">By Square Foot (Size × Price/Sqft)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {isPrintingOrPhotocopy && (
                    <FormField
                      control={form.control}
                      name="colorType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select color type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="black_white">Black & White</SelectItem>
                              <SelectItem value="color">Color</SelectItem>
                              <SelectItem value="spot_color">Spot Color</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>Status</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Enter internal notes about this template"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator>Discount Tiers (Optional)</Separator>

              {discountTierFields.map((field, index) => (
                <Card key={field.id} className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`discountTiers.${index}.minQuantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Min Quantity</FormLabel>
                            <FormControl>
                              <InputNumber
                                style={{ width: '100%' }}
                                placeholder="100"
                                min={1}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`discountTiers.${index}.maxQuantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Quantity</FormLabel>
                            <FormControl>
                              <InputNumber
                                style={{ width: '100%' }}
                                placeholder="Optional"
                                min={1}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`discountTiers.${index}.discountPercent`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount %</FormLabel>
                            <FormControl>
                              <InputNumber
                                style={{ width: '100%' }}
                                placeholder="10"
                                min={0}
                                max={100}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                                suffix="%"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={() => removeDiscountTier(index)}
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Remove Tier
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => appendDiscountTier({ minQuantity: 1, maxQuantity: null, discountPercent: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Discount Tier
              </Button>

              <Separator>Additional Options (Optional)</Separator>

              {additionalOptionFields.map((field, index) => (
                <Card key={field.id} className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`additionalOptions.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Option Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Lamination, Binding" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`additionalOptions.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Price</FormLabel>
                            <FormControl>
                              <InputNumber
                                style={{ width: '100%' }}
                                placeholder="0.00"
                                prefix="GHS "
                                min={0}
                                precision={2}
                                value={field.value}
                                onChange={(value) => field.onChange(value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={() => removeAdditionalOption(index)}
                    >
                      <MinusCircle className="h-4 w-4 mr-2" />
                      Remove Option
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => appendAdditionalOption({ name: '', price: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Additional Option
              </Button>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalVisible(false);
                    setShowCategoryOtherInput(false);
                    setCategoryOtherValue('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Pricing Template Details"
        width={800}
        onEdit={isManager && viewingTemplate ? () => {
          handleEdit(viewingTemplate);
          setDrawerVisible(false);
        } : null}
        onDelete={isAdmin && viewingTemplate ? () => {
          handleDelete(viewingTemplate.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this pricing template?"
        fields={viewingTemplate ? [
          { label: 'Template Name', value: viewingTemplate.name },
          { 
            label: 'Category', 
            value: viewingTemplate.category,
            render: (cat) => <Badge variant="outline">{cat}</Badge>
          },
          { label: 'Job Type', value: viewingTemplate.jobType || '-' },
          { label: 'Material Type', value: viewingTemplate.materialType || viewingTemplate.paperType || '-' },
          { label: 'Material Size', value: viewingTemplate.materialSize || viewingTemplate.paperSize || '-' },
          ...(viewingTemplate.materialSize === 'Custom' || (viewingTemplate.materialSize === undefined && viewingTemplate.paperSize === 'Custom') ? [
            { label: 'Custom Height', value: viewingTemplate.customHeight ? `${viewingTemplate.customHeight} ${viewingTemplate.customUnit || ''}` : '-' },
            { label: 'Custom Width', value: viewingTemplate.customWidth ? `${viewingTemplate.customWidth} ${viewingTemplate.customUnit || ''}` : '-' },
            { label: 'Price per Square Foot', value: viewingTemplate.pricePerSquareFoot ? `GHS ${parseFloat(viewingTemplate.pricePerSquareFoot).toFixed(2)}` : '-' },
          ] : []),
          { 
            label: 'Color Type', 
            value: viewingTemplate.colorType,
            render: (type) => {
              const labels = {
                black_white: 'Black & White',
                color: 'Color',
                spot_color: 'Spot Color'
              };
              return type ? labels[type] : '-';
            }
          },
          { 
            label: 'Base Price', 
            value: viewingTemplate.basePrice,
            render: (price) => `GHS ${parseFloat(price || 0).toFixed(2)}`
          },
          { 
            label: 'Price Per Unit', 
            value: viewingTemplate.pricePerUnit,
            render: (price) => price ? `GHS ${parseFloat(price).toFixed(2)}` : '-'
          },
          { 
            label: 'Setup Fee', 
            value: viewingTemplate.setupFee,
            render: (fee) => `GHS ${parseFloat(fee || 0).toFixed(2)}`
          },
          { label: 'Min Quantity', value: viewingTemplate.minimumQuantity || 1 },
          { label: 'Max Quantity', value: viewingTemplate.maximumQuantity || 'Unlimited' },
          { label: 'Description', value: viewingTemplate.description || '-' },
          {
            label: 'Discount Tiers',
            value: viewingTemplate.discountTiers,
            render: (tiers) => {
              if (!tiers || tiers.length === 0) return '-';
              return (
                <List
                  size="small"
                  dataSource={tiers}
                  renderItem={(tier) => (
                    <List.Item>
                      <Space>
                        <Badge variant="default">{tier.discountPercent}% off</Badge>
                        <span>
                          for {tier.minQuantity} - {tier.maxQuantity || '∞'} units
                        </span>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            }
          },
          {
            label: 'Additional Options',
            value: viewingTemplate.additionalOptions,
            render: (options) => {
              if (!options || options.length === 0) return '-';
              return (
                <List
                  size="small"
                  dataSource={options}
                  renderItem={(option) => (
                    <List.Item>
                      <Space>
                        <Badge variant="outline">{option.name}</Badge>
                        <span>GHS {parseFloat(option.price || 0).toFixed(2)}</span>
                      </Space>
                    </List.Item>
                  )}
                />
              );
            }
          },
          { 
            label: 'Status', 
            value: viewingTemplate.isActive,
            render: (isActive) => (
              <Badge variant={isActive ? 'default' : 'destructive'}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            )
          },
          { 
            label: 'Created At', 
            value: viewingTemplate.createdAt,
            render: (value) => value ? new Date(value).toLocaleString() : '-'
          },
          { 
            label: 'Last Updated', 
            value: viewingTemplate.updatedAt,
            render: (value) => value ? new Date(value).toLocaleString() : '-'
          },
        ] : []}
      />
    </div>
  );
};

export default Pricing;
