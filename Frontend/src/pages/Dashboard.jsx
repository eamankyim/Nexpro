import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message, DatePicker, Space, Button, Divider, Tooltip, Alert, Modal, Form, Input, Steps, Upload, Avatar } from 'antd';
import {
  DollarCircleOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
  FilterOutlined,
  CalendarOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  LockOutlined,
  UploadOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import settingsService from '../services/settingsService';
import PhoneNumberInput from '../components/PhoneNumberInput';
import { API_BASE_URL } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with plugins
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [dateRange, setDateRange] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [jobsPagination, setJobsPagination] = useState({ current: 1, pageSize: 5 });
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileStep, setProfileStep] = useState(0);
  const [profileForm] = Form.useForm();
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const queryClient = useQueryClient();

  // Check if organization profile is incomplete
  const { data: organizationData, refetch: refetchOrganization } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: settingsService.getOrganization,
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always refetch to get latest data
  });

  // Extract organization data - API returns { success: true, data: {...} }
  const organization = organizationData?.data || organizationData || {};
  
  const isProfileIncomplete = !organization?.name || 
                              !organization?.email || 
                              !organization?.phone ||
                              organization?.name === 'My Workspace';

  // Mutation for updating organization
  const updateOrganizationMutation = useMutation({
    mutationFn: settingsService.updateOrganization,
    onSuccess: async (response) => {
      // Debug logging - API response
      console.log('📥 [Profile Mutation] API Response received:', JSON.stringify(response, null, 2));
      
      // The API interceptor returns response.data, so response is { success: true, data: {...} }
      const updatedData = response?.data || response;
      
      console.log('📥 [Profile Mutation] Extracted updatedData:', JSON.stringify(updatedData, null, 2));
      console.log('📥 [Profile Mutation] UpdatedData details:', {
        name: updatedData?.name,
        email: updatedData?.email,
        phone: updatedData?.phone,
        nameType: typeof updatedData?.name,
        nameLength: updatedData?.name?.length,
        emailType: typeof updatedData?.email,
        emailLength: updatedData?.email?.length,
        phoneType: typeof updatedData?.phone,
        phoneLength: updatedData?.phone?.length
      });
      
      // Immediately update the query cache
      queryClient.setQueryData(['settings', 'organization'], { 
        success: true, 
        data: updatedData 
      });
      
      console.log('🔄 [Profile Mutation] Query cache updated, refetching...');
      
      // Force a refetch to ensure we have the latest data from server
      const { data: freshData } = await refetchOrganization();
      
      console.log('🔄 [Profile Mutation] Fresh data from refetch:', JSON.stringify(freshData, null, 2));
      
      // Use the fresh data or fallback to updated data
      const finalOrg = freshData?.data || updatedData || {};
      
      console.log('✅ [Profile Mutation] Final organization data:', JSON.stringify(finalOrg, null, 2));
      console.log('✅ [Profile Mutation] Final data details:', {
        name: finalOrg?.name,
        email: finalOrg?.email,
        phone: finalOrg?.phone,
        nameType: typeof finalOrg?.name,
        nameLength: finalOrg?.name?.length,
        emailType: typeof finalOrg?.email,
        emailLength: finalOrg?.email?.length,
        phoneType: typeof finalOrg?.phone,
        phoneLength: finalOrg?.phone?.length
      });
      
      // Verify the profile is actually complete
      const hasName = finalOrg?.name && finalOrg?.name !== 'My Workspace';
      const hasEmail = !!finalOrg?.email;
      const hasPhone = !!finalOrg?.phone;
      const isComplete = hasName && hasEmail && hasPhone;
      
      console.log('✅ [Profile Mutation] Profile completeness check:', {
        hasName,
        hasEmail,
        hasPhone,
        isComplete,
        nameValue: finalOrg?.name,
        emailValue: finalOrg?.email,
        phoneValue: finalOrg?.phone
      });
      
      if (isComplete) {
        // Close modal and reset form
        setProfileModalVisible(false);
        setProfileStep(0);
        profileForm.resetFields();
        setLogoPreview('');
        
        // Show success message
        message.success('Business profile completed successfully!');
      } else {
        // Log for debugging
        console.warn('⚠️ [Profile Mutation] Profile incomplete after save:', {
          name: finalOrg?.name,
          email: finalOrg?.email,
          phone: finalOrg?.phone,
          hasName,
          hasEmail,
          hasPhone,
          isComplete
        });
        message.warning('Profile saved, but some required fields may be missing. Please check and try again.');
      }
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || 'Failed to update organization profile');
    }
  });

  // Auto-populate form when modal opens - refetch and populate in one go
  useEffect(() => {
    if (profileModalVisible) {
      console.log('[Dashboard] 🔍 Modal opened, fetching organization data...');
      console.log('[Dashboard] 📊 Current organization state:', {
        hasOrganization: !!organization,
        organizationName: organization?.name,
        organizationEmail: organization?.email,
        organizationPhone: organization?.phone,
        organizationData: organization
      });
      
      // Small delay to ensure modal is fully rendered
      const timeoutId = setTimeout(() => {
        // Refetch organization data when modal opens to ensure we have latest
        refetchOrganization().then((result) => {
          console.log('[Dashboard] ✅ Refetch completed:', {
            hasData: !!result?.data,
            resultData: result?.data,
            resultDataType: typeof result?.data,
            resultKeys: result?.data ? Object.keys(result?.data) : []
          });
          
          // Extract organization data from the refetch result
          // API can return { success: true, data: {...} } or just {...}
          const orgData = result?.data?.data || result?.data || organization || {};
          
          console.log('[Dashboard] 📋 Extracted organization data:', {
            name: orgData?.name,
            email: orgData?.email,
            phone: orgData?.phone,
            website: orgData?.website,
            hasName: !!orgData?.name,
            hasEmail: !!orgData?.email,
            hasPhone: !!orgData?.phone,
            nameValue: orgData?.name || 'EMPTY',
            emailValue: orgData?.email || 'EMPTY',
            phoneValue: orgData?.phone || 'EMPTY',
            fullData: JSON.stringify(orgData, null, 2)
          });
          
          // Populate form with the fetched data
          const formValues = {
            name: orgData?.name || '',
            email: orgData?.email || '',
            phone: orgData?.phone || '',
            website: orgData?.website || '',
            legalName: orgData?.legalName || '',
            invoiceFooter: orgData?.invoiceFooter || '',
            logoUrl: orgData?.logoUrl || '',
            address: orgData?.address || {},
          };
          
          console.log('[Dashboard] ✏️ Setting form values:', {
            name: formValues.name || 'EMPTY',
            email: formValues.email || 'EMPTY',
            phone: formValues.phone || 'EMPTY',
            fullFormValues: formValues
          });
          
          setLogoPreview(orgData?.logoUrl || '');
          profileForm.setFieldsValue(formValues);
          
          // Verify the form was populated
          const formValuesAfter = profileForm.getFieldsValue();
          console.log('[Dashboard] ✅ Form values after setFieldsValue:', {
            name: formValuesAfter.name || 'EMPTY',
            email: formValuesAfter.email || 'EMPTY',
            phone: formValuesAfter.phone || 'EMPTY',
            fullFormValues: formValuesAfter
          });
        }).catch((error) => {
          console.error('[Dashboard] ❌ Error refetching organization:', {
            error: error.message,
            errorResponse: error?.response?.data,
            errorStatus: error?.response?.status
          });
          // Even if refetch fails, try to populate with existing organization data
          if (organization) {
            const formValues = {
              name: organization?.name || '',
              email: organization?.email || '',
              phone: organization?.phone || '',
              website: organization?.website || '',
              legalName: organization?.legalName || '',
              invoiceFooter: organization?.invoiceFooter || '',
              logoUrl: organization?.logoUrl || '',
              address: organization?.address || {},
            };
            setLogoPreview(organization?.logoUrl || '');
            profileForm.setFieldsValue(formValues);
            console.log('[Dashboard] ⚠️ Used existing organization data as fallback');
          }
        });
      }, 100); // Small delay to ensure modal is rendered
      
      return () => clearTimeout(timeoutId);
    }
  }, [profileModalVisible, profileForm, refetchOrganization, organization]);

  const handleProfileComplete = () => {
    console.log('[Dashboard] 🎯 handleProfileComplete called, opening modal...');
    setProfileModalVisible(true);
    // Form will be populated by the useEffect when modal opens
  };

  const handleLogoUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingLogo(true);
      const response = await settingsService.uploadOrganizationLogo(file);
      const result = response?.data || response;
      const organization = result?.data || result;
      const logoUrl = organization.logoUrl || '';
      profileForm.setFieldsValue({ logoUrl });
      setLogoPreview(logoUrl);
      message.success('Logo uploaded successfully');
      if (onSuccess) onSuccess('ok');
    } catch (error) {
      message.error(error?.response?.data?.message || 'Failed to upload logo');
      if (onError) onError(error);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Hide overlay when profile modal is open
  const shouldShowOverlay = isProfileIncomplete && !profileModalVisible;

  const handleProfileNext = async () => {
    try {
      if (profileStep === 0) {
        // Validate step 1 (required fields)
        await profileForm.validateFields(['name', 'email', 'phone']);
        setProfileStep(1);
      } else if (profileStep === 1) {
        // Submit on step 2
        // First validate step 2 fields
        await profileForm.validateFields(['website', 'address', 'invoiceFooter']);
        
        // Then get ALL form values (including step 1 fields that are not currently rendered)
        const values = profileForm.getFieldsValue(true);
        
        // Debug logging - Form values
        console.log('🔍 [Profile Form] Step 2 - Form values captured:', {
          name: values.name,
          email: values.email,
          phone: values.phone,
          website: values.website,
          legalName: values.legalName,
          invoiceFooter: values.invoiceFooter,
          logoUrl: values.logoUrl,
          address: values.address,
          allValues: values
        });
        
        // Build payload - exclude logoUrl if it's a base64 data URL (too large for JSON payload)
        // Logo should be uploaded separately via /api/settings/organization/logo endpoint
        const payload = {
          name: values.name || '',
          email: values.email || '',
          phone: values.phone || '',
          website: values.website || '',
          legalName: values.legalName || '',
          invoiceFooter: values.invoiceFooter || '',
          // Only include logoUrl if it's a URL (not a base64 data URL)
          // Base64 data URLs are too large and should be uploaded separately
          ...(values.logoUrl && !values.logoUrl.startsWith('data:') ? { logoUrl: values.logoUrl } : {}),
          address: {
            line1: values.address?.line1 || '',
            line2: values.address?.line2 || '',
            city: values.address?.city || '',
            state: values.address?.state || '',
            postalCode: values.address?.postalCode || '',
            country: values.address?.country || ''
          },
          // Preserve existing tax data if it exists
          tax: organization?.tax || {}
        };
        
        // Debug logging - Payload being sent
        console.log('📤 [Profile Form] Payload being sent to API:', JSON.stringify(payload, null, 2));
        console.log('📤 [Profile Form] Payload details:', {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          nameType: typeof payload.name,
          nameLength: payload.name?.length,
          emailType: typeof payload.email,
          emailLength: payload.email?.length,
          phoneType: typeof payload.phone,
          phoneLength: payload.phone?.length
        });
        
        updateOrganizationMutation.mutate(payload);
      }
    } catch (error) {
      // Validation errors are handled by Form
    }
  };

  const handleProfilePrev = () => {
    setProfileStep(profileStep - 1);
  };

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Fetch overall data by default
    const loadInitialData = async () => {
      setLoading(true);
      await fetchDashboardData();
    };
    loadInitialData();
  }, []);

  const fetchDashboardData = async (startDate = null, endDate = null) => {
    try {
      const response = await dashboardService.getOverview(startDate, endDate);
      setOverview(response.data);
    } catch (error) {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = async (dates) => {
    setLoading(true);
    setDateRange(dates);
    setActiveFilter(null); // Clear active filter when custom date range is used
    if (dates && dates[0] && dates[1]) {
      const startDate = dates[0].format('YYYY-MM-DD');
      const endDate = dates[1].format('YYYY-MM-DD');
      await fetchDashboardData(startDate, endDate);
    } else {
      // If no date range selected, fetch all data
      await fetchDashboardData();
    }
  };

  const clearFilters = async () => {
    setLoading(true);
    setDateRange(null);
    setActiveFilter(null);
    await fetchDashboardData();
  };

  // Quick date filter functions
  const setTodayFilter = async () => {
    setLoading(true);
    const today = dayjs();
    const range = [today, today];
    setDateRange(range);
    setActiveFilter('today');
    await fetchDashboardData(today.format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
  };

  const setYesterdayFilter = async () => {
    setLoading(true);
    const yesterday = dayjs().subtract(1, 'day');
    const range = [yesterday, yesterday];
    setDateRange(range);
    setActiveFilter('yesterday');
    await fetchDashboardData(yesterday.format('YYYY-MM-DD'), yesterday.format('YYYY-MM-DD'));
  };

  const setThisWeekFilter = async () => {
    setLoading(true);
    const startOfWeek = dayjs().startOf('isoWeek');
    const endOfWeek = dayjs().endOf('isoWeek');
    const range = [startOfWeek, endOfWeek];
    setDateRange(range);
    setActiveFilter('week');
    await fetchDashboardData(startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD'));
  };

  const setThisMonthFilter = async () => {
    setLoading(true);
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    const range = [startOfMonth, endOfMonth];
    setDateRange(range);
    setActiveFilter('month');
    await fetchDashboardData(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));
  };

  const setThisQuarterFilter = async () => {
    setLoading(true);
    const currentQuarter = Math.floor(dayjs().month() / 3);
    const startOfQuarter = dayjs().startOf('year').add(currentQuarter * 3, 'months');
    const endOfQuarter = startOfQuarter.add(2, 'months').endOf('month');
    const range = [startOfQuarter, endOfQuarter];
    setDateRange(range);
    setActiveFilter('quarter');
    await fetchDashboardData(startOfQuarter.format('YYYY-MM-DD'), endOfQuarter.format('YYYY-MM-DD'));
  };

  const setThisYearFilter = async () => {
    setLoading(true);
    const startOfYear = dayjs().startOf('year');
    const endOfYear = dayjs().endOf('year');
    const range = [startOfYear, endOfYear];
    setDateRange(range);
    setActiveFilter('year');
    await fetchDashboardData(startOfYear.format('YYYY-MM-DD'), endOfYear.format('YYYY-MM-DD'));
  };

  const statusColors = {
    new: 'gold',
    in_progress: 'blue',
    on_hold: 'orange',
    cancelled: 'red',
    completed: 'green',
  };

  const getDueDateStatus = (dueDate) => {
    if (!dueDate) {
      return {
        color: 'default',
        label: 'No due date set',
        formatted: '—'
      };
    }

    const due = dayjs(dueDate);
    const now = dayjs();

    const formatted = due.format('MMM DD, YYYY');

    if (!due.isValid()) {
      return {
        color: 'default',
        label: 'Invalid due date',
        formatted: '—'
      };
    }

    const diffHours = due.diff(now, 'hour', true);

    if (diffHours < 0) {
      return {
        color: 'red',
        label: `Overdue · was due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 24) {
      return {
        color: 'red',
        label: `Due ${due.fromNow()}`,
        formatted
      };
    }

    if (diffHours <= 72) {
      return {
        color: 'orange',
        label: `Upcoming · due ${due.fromNow()}`,
        formatted
      };
    }

    return {
      color: 'default',
      label: `Due ${due.fromNow()}`,
      formatted
    };
  };

  const recentJobsColumns = [
    {
      title: 'Job Number',
      dataIndex: 'jobNumber',
      key: 'jobNumber',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Customer',
      dataIndex: ['customer', 'name'],
      key: 'customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (dueDate) => {
        const { color, label, formatted } = getDueDateStatus(dueDate);
        return (
          <Space direction="vertical" size={0}>
            <span>{formatted}</span>
            {label && (
              <Tag color={color} style={{ marginTop: 4 }}>
                {label}
              </Tag>
            )}
          </Space>
        );
      }
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Use filtered data if available, otherwise use overview data
  const displayData = overview;
  const isFiltered = Boolean(dateRange && dateRange[0] && dateRange[1]);
  const thisMonthSummary = displayData?.thisMonth || {};
  const revenueValue = Number(thisMonthSummary.revenue ?? 0);
  const expenseValue = Number(thisMonthSummary.expenses ?? 0);
  const revenueTitle = isFiltered ? 'Selected Revenue' : "This Month's Revenue";
  const expenseTitle = isFiltered ? 'Selected Expenses' : "This Month's Expenses";
  const profitTitle = isFiltered ? 'Selected Profit' : "This Month's Profit";
  const profitValue = Number(thisMonthSummary.profit ?? (revenueValue - expenseValue));
  const allTimeProfit = Number(displayData?.allTime?.profit ?? ((displayData?.allTime?.revenue ?? 0) - (displayData?.allTime?.expenses ?? 0)));
  const thisMonthRange = thisMonthSummary.range;
  const jobStatusMetrics = [
    {
      title: 'New',
      value: displayData?.summary?.newJobs ?? displayData?.summary?.pendingJobs ?? 0,
      color: '#d4af37',
      description: 'Jobs waiting to start'
    },
    {
      title: 'In Progress',
      value: displayData?.summary?.inProgressJobs ?? 0,
      color: '#1890ff',
      description: 'Currently being worked on'
    },
    {
      title: 'On Hold',
      value: displayData?.summary?.onHoldJobs ?? 0,
      color: '#faad14',
      description: 'Paused or awaiting info'
    },
    {
      title: 'Cancelled',
      value: displayData?.summary?.cancelledJobs ?? 0,
      color: '#ff4d4f',
      description: 'Stopped by request or issue'
    },
    {
      title: 'Completed',
      value: displayData?.summary?.completedJobs ?? 0,
      color: '#52c41a',
      description: 'Ready for delivery or delivered'
    }
  ];

  return (
    <div style={{ position: 'relative' }}>
      {/* Overlay that locks dashboard when profile is incomplete */}
      {shouldShowOverlay && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={(e) => {
            // Prevent clicks from going through
            e.stopPropagation();
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: 420,
              padding: 32,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <LockOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </div>
            <h2 style={{ marginBottom: 12, color: '#262626', fontSize: 20, fontWeight: 600, margin: 0 }}>
              Complete Your Business Profile
            </h2>
            <p style={{ marginBottom: 24, color: '#8c8c8c', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Add your company name, email, and phone number to unlock all features.
            </p>
            <Button
              type="primary"
              size="large"
              onClick={handleProfileComplete}
              style={{ minWidth: 200, height: 40, fontSize: 14 }}
              block
            >
              Complete Profile
            </Button>
          </div>
        </div>
      )}

      {/* Multi-step Profile Completion Modal */}
      <Modal
        title="Complete Your Business Profile"
        open={profileModalVisible}
        onCancel={() => {
          setProfileModalVisible(false);
          setProfileStep(0);
          profileForm.resetFields();
        }}
        footer={null}
        width={600}
        closable={true}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <Steps
            current={profileStep}
            items={[
              {},
              {}
            ]}
            style={{ maxWidth: 120 }}
            size="small"
            className="profile-steps"
          />
        </div>

        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleProfileNext}
        >
          {profileStep === 0 && (
            <>
              <Form.Item
                name="logoUrl"
                hidden
              >
                <Input type="hidden" />
              </Form.Item>

              <Form.Item
                label={<div style={{ textAlign: 'center', width: '100%' }}>Company Logo</div>}
                style={{ marginBottom: 24 }}
                labelCol={{ span: 24 }}
                wrapperCol={{ span: 24 }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                  <Upload
                    name="logo"
                    listType="picture-card"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      const isImage = file.type.startsWith('image/');
                      if (!isImage) {
                        message.error('You can only upload image files!');
                        return false;
                      }
                      const isLt2M = file.size / 1024 / 1024 < 2;
                      if (!isLt2M) {
                        message.error('Image must be smaller than 2MB!');
                        return false;
                      }
                      handleLogoUpload({ file, onSuccess: () => {}, onError: () => {} });
                      return false;
                    }}
                    accept="image/*"
                  >
                    {logoPreview ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <img
                          src={logoPreview?.startsWith('http') || logoPreview?.startsWith('//') ? logoPreview : logoPreview?.startsWith('/') ? `${API_BASE_URL}${logoPreview}` : logoPreview}
                          alt="Logo"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '0 6px 0 6px',
                            cursor: 'pointer',
                            fontSize: 12
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoPreview('');
                            profileForm.setFieldsValue({ logoUrl: '' });
                          }}
                        >
                          Remove
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {uploadingLogo ? <Spin /> : <CameraOutlined />}
                        <div style={{ marginTop: 8 }}>Upload Logo</div>
                      </div>
                    )}
                  </Upload>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8, textAlign: 'center' }}>
                    Upload your company logo (This will show on invoices and quotes)
                  </div>
                </div>
              </Form.Item>

              <Form.Item
                name="name"
                label="Company Name"
                rules={[{ required: true, message: 'Please enter your company name' }]}
              >
                <Input placeholder="Enter company name" size="large" />
              </Form.Item>

             

              <Form.Item
                name="email"
                label="Business Email"
                rules={[
                  { required: true, message: 'Please enter your business email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="business@company.com" size="large" />
              </Form.Item>

              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[
                  { required: true, message: 'Please enter your phone number' }
                ]}
              >
                <PhoneNumberInput placeholder="Enter phone number" size="large" />
              </Form.Item>
            </>
          )}

          {profileStep === 1 && (
            <>
              <Form.Item
                name="website"
                label="Website (Optional)"
              >
                <Input placeholder="https://yourcompany.com" size="large" />
              </Form.Item>

              <Divider orientation="left" style={{ margin: '24px 0' }}>Business Address</Divider>

              <Form.Item
                name={['address', 'line1']}
                label="Street Address (Optional)"
              >
                <Input placeholder="123 Main Street" size="large" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['address', 'city']}
                    label="City (Optional)"
                  >
                    <Input placeholder="Accra" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['address', 'state']}
                    label="State/Region (Optional)"
                  >
                    <Input placeholder="Greater Accra" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name={['address', 'postalCode']}
                    label="Postal Code (Optional)"
                  >
                    <Input placeholder="GA-123-4567" size="large" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['address', 'country']}
                    label="Country (Optional)"
                  >
                    <Input placeholder="Ghana" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ margin: '24px 0' }}>Additional Information</Divider>

              <Form.Item
                name="invoiceFooter"
                label="Invoice Footer (Optional)"
                help="Custom message to appear at the bottom of invoices and quotes"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Thank you for your business!"
                  size="large"
                />
              </Form.Item>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button
              onClick={() => {
                if (profileStep === 0) {
                  setProfileModalVisible(false);
                  setProfileStep(0);
                  profileForm.resetFields();
                } else {
                  handleProfilePrev();
                }
              }}
            >
              {profileStep === 0 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              type="primary"
              onClick={handleProfileNext}
              loading={updateOrganizationMutation.isLoading}
            >
              {profileStep === 0 ? 'Next' : 'Complete'}
            </Button>
          </div>
        </Form>
      </Modal>

      <div style={{ marginBottom: 24 }}>
        {/* Title and Create Job Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <Tooltip 
            title={isProfileIncomplete ? "Complete your business profile to create jobs" : "Create a new job"}
            placement="left"
          >
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              size="large"
              disabled={isProfileIncomplete}
              onClick={() => {
                if (isProfileIncomplete) {
                  Modal.warning({
                    title: 'Complete Your Business Profile',
                    content: 'Please complete your business profile (company name, email, and phone) in Settings before creating jobs.',
                    okText: 'Go to Settings',
                    onOk: () => navigate('/settings?tab=organization'),
                  });
                } else {
                  navigate('/jobs', { state: { openModal: true } });
                }
              }}
            >
              Create Job
            </Button>
          </Tooltip>
        </div>
        
        {/* Quick Date Filter Buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: isMobile ? 'center' : 'space-between',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 8,
              alignItems: isMobile ? 'stretch' : 'center',
            }}
          >
            <span
              style={{
                fontWeight: 500,
                color: '#666',
                fontSize: isMobile ? '14px' : '16px',
                whiteSpace: 'nowrap',
              }}
            >
              Quick filters:
            </span>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: isMobile ? 'center' : 'flex-start',
              }}
            >
              <Tooltip title="Show data for today only">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setTodayFilter}
                  type={activeFilter === 'today' ? 'primary' : 'default'}
                >
                  Today
                </Button>
              </Tooltip>
              <Tooltip title="Show data for yesterday only">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setYesterdayFilter}
                  type={activeFilter === 'yesterday' ? 'primary' : 'default'}
                >
                  Yesterday
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this week (Monday to Sunday)">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisWeekFilter}
                  type={activeFilter === 'week' ? 'primary' : 'default'}
                >
                  This Week
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this month">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisMonthFilter}
                  type={activeFilter === 'month' ? 'primary' : 'default'}
                >
                  This Month
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this quarter">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisQuarterFilter}
                  type={activeFilter === 'quarter' ? 'primary' : 'default'}
                >
                  This Quarter
                </Button>
              </Tooltip>
              <Tooltip title="Show data for this year">
                <Button
                  size={isMobile ? 'middle' : 'small'}
                  onClick={setThisYearFilter}
                  type={activeFilter === 'year' ? 'primary' : 'default'}
                >
                  This Year
                </Button>
              </Tooltip>
            </div>
          </div>
          <Space
            direction={isMobile ? 'vertical' : 'horizontal'}
            size={8}
            style={{
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'flex-end',
            }}
          >
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              allowClear
              style={{ width: isMobile ? '100%' : 260 }}
              format="YYYY-MM-DD"
            />
            <Button icon={<FilterOutlined />} onClick={clearFilters}>
              Clear Filters
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ display: 'flex' }}>
        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Statistic
                title={revenueTitle}
                value={revenueValue}
                prefix="GHS "
                valueStyle={{ color: '#1890ff' }}
                precision={3}
                suffix={<RiseOutlined />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                All-time: GHS {Number(displayData?.allTime?.revenue ?? 0).toFixed(3)}
                {thisMonthRange && (
                  <div>
                    <Tooltip
                      title={`Range: ${dayjs(thisMonthRange.start).format('MMM DD, YYYY')} → ${dayjs(
                        thisMonthRange.end
                      ).format('MMM DD, YYYY')}`}
                    >
                      <span>
                        Period: {dayjs(thisMonthRange.start).format('MMM DD')} -{' '}
                        {dayjs(thisMonthRange.end).format('MMM DD')}
                      </span>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Statistic
                title={expenseTitle}
                value={expenseValue}
                prefix="GHS "
                valueStyle={{ color: '#cf1322' }}
                precision={3}
                suffix={<FallOutlined />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                All-time: GHS {Number(displayData?.allTime?.expenses ?? 0).toFixed(3)}
                {thisMonthRange && (
                  <div>
                    <Tooltip
                      title={`Range: ${dayjs(thisMonthRange.start).format('MMM DD, YYYY')} → ${dayjs(
                        thisMonthRange.end
                      ).format('MMM DD, YYYY')}`}
                    >
                      <span>
                        Period: {dayjs(thisMonthRange.start).format('MMM DD')} -{' '}
                        {dayjs(thisMonthRange.end).format('MMM DD')}
                      </span>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Statistic
                title={profitTitle}
                value={profitValue}
                prefix="GHS "
                valueStyle={{ color: profitValue >= 0 ? '#3f8600' : '#cf1322' }}
                precision={3}
                suffix={profitValue >= 0 ? <RiseOutlined /> : <FallOutlined />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                All-time: GHS {allTimeProfit.toFixed(3)}
                {thisMonthRange && (
                  <div>
                    <Tooltip
                      title={`Range: ${dayjs(thisMonthRange.start).format('MMM DD, YYYY')} → ${dayjs(
                        thisMonthRange.end
                      ).format('MMM DD, YYYY')}`}
                    >
                      <span>
                        Period: {dayjs(thisMonthRange.start).format('MMM DD')} -{' '}
                        {dayjs(thisMonthRange.end).format('MMM DD')}
                      </span>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6} style={{ display: 'flex' }}>
          <Card style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Statistic
                title="Outstanding"
                value={displayData?.summary?.outstandingBalance || 0}
                prefix="GHS "
                valueStyle={{ color: '#fa8c16' }}
                precision={2}
                suffix={<ClockCircleOutlined />}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                Unpaid invoices balance
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="Job Status Overview"
        style={{ marginTop: 16 }}
        bodyStyle={{ padding: 0 }}
      >
        <Row gutter={[16, 16]} style={{ padding: 16 }} wrap>
          {jobStatusMetrics.map(({ title, value, color, description }) => (
            <Col key={title} flex="1">
              <Card
                size="small"
                bordered={false}
                style={{
                  background: 'transparent',
                  border: '0.5px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: 12,
                  height: '100%',
                  boxShadow: 'none'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color }}>
                    {value}
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {description}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Jobs In Progress">
            <Table
              dataSource={displayData?.recentJobs || []}
              columns={recentJobsColumns}
              rowKey="id"
              pagination={{ 
                current: jobsPagination.current,
                pageSize: jobsPagination.pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} jobs`,
                pageSizeOptions: ['5', '10', '20', '50'],
                onChange: (page, pageSize) => {
                  setJobsPagination({ current: page, pageSize: pageSize || jobsPagination.pageSize });
                }
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;


