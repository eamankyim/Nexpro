import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Table, InputNumber, Tag, List, Space, Image, Empty, Spin } from 'antd';
import { Plus, Search, Pencil, Trash2, Eye, Upload as UploadIcon, Loader2 } from 'lucide-react';
import vendorService from '../services/vendorService';
import vendorPriceListService from '../services/vendorPriceListService';
import { useAuth } from '../context/AuthContext';
import ActionColumn from '../components/ActionColumn';
import DetailsDrawer from '../components/DetailsDrawer';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { showSuccess, showError } from '../utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  company: z.string().optional(),
  email: z.string().email('Please enter a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  category: z.string().min(1, 'Category is required'),
  address: z.string().optional(),
});

const priceListItemSchema = z.object({
  itemType: z.enum(['service', 'product']),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be at least 0'),
  unit: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const { isManager } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [priceList, setPriceList] = useState([]);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [priceListModalVisible, setPriceListModalVisible] = useState(false);
  const [editingPriceItem, setEditingPriceItem] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [deletePriceItemId, setDeletePriceItemId] = useState(null);
  const [deletePriceItemDialogOpen, setDeletePriceItemDialogOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
      website: '',
      category: '',
      address: '',
    },
  });

  const priceListForm = useForm({
    resolver: zodResolver(priceListItemSchema),
    defaultValues: {
      itemType: 'service',
      name: '',
      description: '',
      price: 0,
      unit: 'unit',
      imageUrl: null,
    },
  });

  useEffect(() => {
    fetchVendors();
  }, [pagination.current, pagination.pageSize, searchText]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await vendorService.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        search: searchText,
      });
      
      // Handle response structure (API interceptor returns response.data)
      if (response?.success !== false && response?.data) {
        setVendors(Array.isArray(response.data) ? response.data : []);
        setPagination({ ...pagination, total: response.count || 0 });
      } else {
        // If response structure is unexpected, try to extract data
        setVendors(Array.isArray(response) ? response : []);
        setPagination({ ...pagination, total: response?.count || 0 });
      }
    } catch (error) {
      showError(error, 'Failed to load vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values) => {
    try {
      let response;
      if (editingVendor) {
        response = await vendorService.update(editingVendor.id, values);
      } else {
        response = await vendorService.create(values);
      }
      
      // Check if response indicates success
      if (response && (response.success === true || response.data)) {
        showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor created successfully');
        setModalVisible(false);
        form.reset();
        fetchVendors();
      } else if (response && response.success === false) {
        // Explicit failure response
        const errorMessage = response.error || response.message || 'Operation failed';
        showError(errorMessage);
      } else {
        // Unexpected response structure
        console.warn('Unexpected response structure:', response);
        showSuccess(editingVendor ? 'Vendor updated successfully' : 'Vendor created successfully');
        setModalVisible(false);
        form.reset();
        fetchVendors();
      }
    } catch (error) {
      // Only show error if it's a real error (not a false positive from interceptor)
      console.error('Vendor operation error:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Operation failed';
      showError(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      await vendorService.delete(id);
      showSuccess('Vendor deleted successfully');
      fetchVendors();
    } catch (error) {
      showError(error, 'Failed to delete vendor');
    }
  };

  const handleView = async (vendor) => {
    setViewingVendor(vendor);
    setDrawerVisible(true);
    
    setLoadingPriceList(true);
    try {
      const response = await vendorPriceListService.getAll(vendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      console.error('Failed to load vendor price list:', error);
      setPriceList([]);
    } finally {
      setLoadingPriceList(false);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setViewingVendor(null);
    setPriceList([]);
  };

  const printingItems = [
    'Black & White Printing',
    'Color Printing',
    'Large Format Printing',
    'Photocopying',
    'Digital Printing',
    'Offset Printing',
    'Screen Printing',
    '3D Printing',
    'DTF',
    'Business Cards',
    'Brochures',
    'Flyers',
    'Posters',
    'Banners',
    'Booklets',
    'Letterhead',
    'Envelopes',
    'Invitations',
    'Calendars',
    'Labels',
    'Stickers',
    'Signage',
    'Vehicle Wraps',
    'Window Graphics',
    'Floor Graphics',
    'One Way Vision Sticker',
    'Binding',
    'Lamination',
    'Scanning',
    'Cutting',
    'Folding',
    'Stapling',
    'Perforation',
    'Die Cutting',
    'Embossing',
    'Foil Stamping',
    'UV Coating',
    'Varnishing',
    'Design Services',
    'Pre-Press Services',
    'Color Correction',
    'Image Editing',
    'Layout Design',
    'Proofing',
  ];

  const isPrintingVendor = viewingVendor && (
    viewingVendor.category === 'Printing Services' ||
    viewingVendor.category === 'Printing Equipment' ||
    viewingVendor.category === 'Pre-Press Services' ||
    viewingVendor.category === 'Binding & Finishing' ||
    viewingVendor.category === 'Design Services'
  );

  const handleAddPriceItem = () => {
    setEditingPriceItem(null);
    priceListForm.reset({
      itemType: 'service',
      name: '',
      description: '',
      price: 0,
      unit: 'unit',
      imageUrl: null,
    });
    setImagePreview(null);
    setPriceListModalVisible(true);
  };

  const handleEditPriceItem = (item) => {
    setEditingPriceItem(item);
    priceListForm.reset({
      ...item,
      imageUrl: item.imageUrl || null,
    });
    setImagePreview(item.imageUrl || null);
    setPriceListModalVisible(true);
  };

  const handleImageUpload = async (file) => {
    try {
      setUploadingImage(true);
      
      if (editingPriceItem && editingPriceItem.id) {
        const response = await vendorPriceListService.uploadImage(
          viewingVendor.id,
          editingPriceItem.id,
          file
        );
        
        if (response.data?.imageUrl) {
          setImagePreview(response.data.imageUrl);
          priceListForm.setValue('imageUrl', response.data.imageUrl);
          showSuccess('Image uploaded successfully');
        } else {
          throw new Error('Upload failed - no image URL in response');
        }
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target.result);
          priceListForm.setValue('imageUrl', e.target.result);
        };
        reader.onerror = (error) => {
          showError(error, 'Failed to read image file');
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      showError(error, error?.response?.data?.message || error?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageRemove = () => {
    setImagePreview(null);
    priceListForm.setValue('imageUrl', null);
  };

  const handleDeletePriceItem = async () => {
    if (!deletePriceItemId) return;
    try {
      await vendorPriceListService.delete(viewingVendor.id, deletePriceItemId);
      showSuccess('Price item deleted successfully');
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
      setDeletePriceItemDialogOpen(false);
      setDeletePriceItemId(null);
    } catch (error) {
      showError(error, 'Failed to delete price item');
    }
  };

  const onPriceListSubmit = async (values) => {
    try {
      if (editingPriceItem) {
        await vendorPriceListService.update(viewingVendor.id, editingPriceItem.id, values);
        showSuccess('Price item updated successfully');
      } else {
        await vendorPriceListService.create(viewingVendor.id, values);
        showSuccess('Price item added successfully');
      }
      setPriceListModalVisible(false);
      setImagePreview(null);
      const response = await vendorPriceListService.getAll(viewingVendor.id);
      setPriceList(response.data || []);
    } catch (error) {
      showError(error, error.error || 'Operation failed');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Company', dataIndex: 'company', key: 'company' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { 
      title: 'Category', 
      dataIndex: 'category', 
      key: 'category',
      render: (category) => category ? <Badge variant="outline">{category}</Badge> : '-'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPagination({ ...pagination, current: 1 });
              }}
              className="pl-10 w-[250px]"
            />
          </div>
          {isManager && (
            <Button
              onClick={() => {
                setEditingVendor(null);
                form.reset();
                setModalVisible(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={vendors}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={(newPagination) => setPagination(newPagination)}
      />

      <Dialog open={modalVisible} onOpenChange={setModalVisible}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
            <DialogDescription>
              {editingVendor ? 'Update vendor information' : 'Add a new vendor to your system'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter vendor name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter company name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="vendor@example.com" />
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
                        <PhoneNumberInput {...field} placeholder="Enter phone number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://www.example.com" />
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
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Paper Supplier">Paper Supplier</SelectItem>
                          <SelectItem value="Ink Supplier">Ink Supplier</SelectItem>
                          <SelectItem value="Equipment Supplier">Equipment Supplier</SelectItem>
                          <SelectItem value="Printing Equipment">Printing Equipment</SelectItem>
                          <SelectItem value="Printing Services">Printing Services</SelectItem>
                          <SelectItem value="Binding & Finishing">Binding & Finishing</SelectItem>
                          <SelectItem value="Design Services">Design Services</SelectItem>
                          <SelectItem value="Pre-Press Services">Pre-Press Services</SelectItem>
                          <SelectItem value="Packaging Materials">Packaging Materials</SelectItem>
                          <SelectItem value="Specialty Papers">Specialty Papers</SelectItem>
                          <SelectItem value="Maintenance & Repair">Maintenance & Repair</SelectItem>
                          <SelectItem value="Shipping & Logistics">Shipping & Logistics</SelectItem>
                          <SelectItem value="Software & Technology">Software & Technology</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Enter address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalVisible(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingVendor ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DetailsDrawer
        open={drawerVisible}
        onClose={handleCloseDrawer}
        title="Vendor Details"
        width={900}
        onEdit={isManager && viewingVendor ? () => {
          setEditingVendor(viewingVendor);
          form.reset(viewingVendor);
          setModalVisible(true);
          setDrawerVisible(false);
        } : null}
        onDelete={isManager && viewingVendor ? () => {
          handleDelete(viewingVendor.id);
          setDrawerVisible(false);
        } : null}
        deleteConfirmText="Are you sure you want to delete this vendor?"
        tabs={viewingVendor ? [
          {
            key: 'details',
            label: 'Details',
            content: (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium">{viewingVendor.name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Company</Label>
                    <p className="font-medium">{viewingVendor.company || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">
                      {viewingVendor.email ? (
                        <a href={`mailto:${viewingVendor.email}`} className="text-primary hover:underline">
                          {viewingVendor.email}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">
                      {viewingVendor.phone ? (
                        <a href={`tel:${viewingVendor.phone}`} className="text-primary hover:underline">
                          {viewingVendor.phone}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Website</Label>
                    <p className="font-medium">
                      {viewingVendor.website ? (
                        <a href={viewingVendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {viewingVendor.website}
                        </a>
                      ) : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {viewingVendor.category ? (
                        <Badge variant="outline">{viewingVendor.category}</Badge>
                      ) : '-'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium">{viewingVendor.address || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p className="font-medium">
                      <Badge variant={viewingVendor.isActive ? 'default' : 'destructive'}>
                        {viewingVendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created At</Label>
                    <p className="font-medium">
                      {viewingVendor.createdAt ? new Date(viewingVendor.createdAt).toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="font-medium">
                      {viewingVendor.updatedAt ? new Date(viewingVendor.updatedAt).toLocaleString() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'pricelist',
            label: 'Price Lists',
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Services & Products ({priceList.length})</h3>
                  {isManager && (
                    <Button onClick={handleAddPriceItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
                {loadingPriceList ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : priceList.length > 0 ? (
                  <div className="space-y-3">
                    {priceList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 p-4 border rounded-lg bg-card"
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg cursor-pointer"
                            onClick={() => window.open(item.imageUrl, '_blank')}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground text-center">
                            No Image
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">{item.name}</span>
                            <Badge variant={item.itemType === 'service' ? 'default' : 'secondary'}>
                              {item.itemType}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {item.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-primary">
                              GHS {parseFloat(item.price || 0).toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              per {item.unit || 'unit'}
                            </span>
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPriceItem(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletePriceItemId(item.id);
                                setDeletePriceItemDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="No price list items found" />
                )}
              </div>
            )
          }
        ] : null}
      />

      <Dialog open={priceListModalVisible} onOpenChange={setPriceListModalVisible}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPriceItem ? 'Edit Price Item' : 'Add Price Item'}</DialogTitle>
            <DialogDescription>
              {editingPriceItem ? 'Update price item details' : 'Add a new service or product to the price list'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...priceListForm}>
            <form onSubmit={priceListForm.handleSubmit(onPriceListSubmit)} className="space-y-4">
              <FormField
                control={priceListForm.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    {isPrintingVendor ? (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select printing item" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {printingItems.map(item => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input {...field} placeholder="Enter item name" />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Enter description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={priceListForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
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
                control={priceListForm.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., unit, hour, piece" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Image (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isImage = file.type.startsWith('image/');
                        if (!isImage) {
                          showError(null, 'You can only upload image files!');
                          return;
                        }
                        const isLt10M = file.size / 1024 / 1024 < 10;
                        if (!isLt10M) {
                          showError(null, 'Image must be smaller than 10MB!');
                          return;
                        }
                        handleImageUpload(file);
                      }
                    }}
                    className="flex-1"
                    disabled={uploadingImage}
                  />
                  {uploadingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {imagePreview && (
                  <div className="mt-4 space-y-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full max-h-48 object-contain rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleImageRemove}
                    >
                      Remove Image
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPriceListModalVisible(false);
                    setImagePreview(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={priceListForm.formState.isSubmitting}>
                  {priceListForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPriceItem ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePriceItemDialogOpen} onOpenChange={setDeletePriceItemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Price Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the price item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePriceItem} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Vendors;
