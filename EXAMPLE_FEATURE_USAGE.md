# 📘 Practical Examples: Feature-Gated Components

## Example 1: Protecting a Page

### Before (No Protection):
```jsx
// pages/Inventory.jsx
function Inventory() {
  return (
    <div>
      <h1>Inventory Management</h1>
      <InventoryTable />
    </div>
  );
}
```

### After (Feature-Gated):
```jsx
// pages/Inventory.jsx
import { FeatureGate } from '../hooks/useFeatureAccess';
import { Result, Button } from 'antd';

function Inventory() {
  return (
    <FeatureGate 
      feature="inventory"
      fallback={
        <Result
          status="403"
          title="Inventory Not Available"
          subTitle="This feature is not included in your current plan"
          extra={
            <Button type="primary" href="/settings">
              Upgrade Plan
            </Button>
          }
        />
      }
    >
      <div>
        <h1>Inventory Management</h1>
        <InventoryTable />
      </div>
    </FeatureGate>
  );
}
```

---

## Example 2: Conditional Navigation Menu

```jsx
// layouts/MainLayout.jsx
import { useMemo } from 'react';
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Menu } from 'antd';

function MainLayout() {
  const { hasFeature } = useFeatureAccess();

  const menuItems = useMemo(() => {
    const items = [
      { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
      { key: 'customers', label: 'Customers', path: '/customers' },
      { key: 'quotes', label: 'Quotes', path: '/quotes' },
      { key: 'jobs', label: 'Jobs', path: '/jobs' },
    ];

    // Conditionally add features based on plan
    if (hasFeature('inventory')) {
      items.push({ 
        key: 'inventory', 
        label: 'Inventory', 
        path: '/inventory' 
      });
    }

    if (hasFeature('payroll')) {
      items.push({ 
        key: 'payroll', 
        label: 'Payroll', 
        path: '/payroll' 
      });
    }

    if (hasFeature('advancedReporting')) {
      items.push({ 
        key: 'reports', 
        label: 'Advanced Reports', 
        path: '/reports' 
      });
    }

    return items;
  }, [hasFeature]);

  return (
    <Layout>
      <Sider>
        <Menu items={menuItems} />
      </Sider>
      <Content>{/* ... */}</Content>
    </Layout>
  );
}
```

---

## Example 3: Feature-Locked Button

```jsx
// components/JobActions.jsx
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Button, Tooltip } from 'antd';

function JobActions({ job }) {
  const { hasFeature } = useFeatureAccess();

  const handleGenerateInvoice = () => {
    // Generate invoice logic
  };

  // If jobAutomation feature not available, show disabled button with tooltip
  if (!hasFeature('jobAutomation')) {
    return (
      <Tooltip title="Auto-invoice generation requires Scale plan or higher">
        <Button disabled>
          Generate Invoice (Upgrade Required)
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button type="primary" onClick={handleGenerateInvoice}>
      Generate Invoice
    </Button>
  );
}
```

---

## Example 4: Progressive Feature Display

```jsx
// pages/Dashboard.jsx
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Row, Col, Card, Badge } from 'antd';

function Dashboard() {
  const { hasFeature, plan } = useFeatureAccess();

  return (
    <div>
      <h1>Dashboard</h1>
      
      <Row gutter={16}>
        {/* Basic card - always visible */}
        <Col span={8}>
          <Card title="Revenue">
            <StatDisplay value="$45,230" />
          </Card>
        </Col>

        {/* Inventory card - only if feature enabled */}
        {hasFeature('inventory') && (
          <Col span={8}>
            <Card title="Inventory Status">
              <InventoryWidget />
            </Card>
          </Col>
        )}

        {/* Advanced analytics - with upgrade prompt */}
        <Col span={8}>
          <Card 
            title={
              <span>
                Advanced Analytics
                {!hasFeature('advancedReporting') && (
                  <Badge count="Pro" style={{ marginLeft: 8 }} />
                )}
              </span>
            }
          >
            {hasFeature('advancedReporting') ? (
              <AdvancedChart />
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <p>Upgrade to Scale plan for advanced analytics</p>
                <Button type="primary" size="small">
                  Upgrade Now
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
```

---

## Example 5: Backend Route Protection

```javascript
// routes/inventoryRoutes.js
const express = require('express');
const { requireFeature } = require('../middleware/featureAccess');
const {
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} = require('../controllers/inventoryController');

const router = express.Router();

// Apply feature check to ALL inventory routes
router.use(requireFeature('inventory'));

// Now all these routes are protected
router.get('/', getInventoryItems);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);

module.exports = router;
```

---

## Example 6: Multiple Feature Check

```jsx
// components/AdvancedWorkflow.jsx
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Alert } from 'antd';

function AdvancedWorkflow() {
  const { hasAllFeatures, hasAnyFeature } = useFeatureAccess();

  // Requires BOTH features
  if (!hasAllFeatures(['jobAutomation', 'notifications'])) {
    return (
      <Alert
        type="warning"
        message="Feature Unavailable"
        description="Advanced workflows require both Job Automation and Notifications features. 
                     Available in Scale plan."
        showIcon
      />
    );
  }

  // Requires AT LEAST ONE feature
  if (!hasAnyFeature(['reports', 'advancedReporting'])) {
    return <Alert type="info" message="Reporting features required" />;
  }

  return <AdvancedWorkflowBuilder />;
}
```

---

## Example 7: Plan Comparison Component

```jsx
// components/PlanComparison.jsx
import useFeatureAccess from '../hooks/useFeatureAccess';
import { Table, Tag } from 'antd';

function PlanComparison() {
  const { plan, features } = useFeatureAccess();

  const featureList = [
    { name: 'Customer CRM', trial: true, launch: true, scale: true },
    { name: 'Job Automation', trial: true, launch: true, scale: true },
    { name: 'Inventory', trial: false, launch: false, scale: true },
    { name: 'Advanced Analytics', trial: false, launch: false, scale: true },
    { name: 'White-Label', trial: false, launch: false, scale: false, enterprise: true },
  ];

  const columns = [
    { title: 'Feature', dataIndex: 'name', key: 'name' },
    { 
      title: 'Your Plan', 
      key: 'current',
      render: (_, record) => {
        const hasIt = record[plan];
        return hasIt ? (
          <Tag color="green">✓ Included</Tag>
        ) : (
          <Tag color="red">✗ Not included</Tag>
        );
      }
    },
  ];

  return (
    <div>
      <h2>Your Current Plan: {plan}</h2>
      <Table dataSource={featureList} columns={columns} />
    </div>
  );
}
```

---

## Example 8: Upgrade Prompt Component

```jsx
// components/UpgradePrompt.jsx
import { Modal, Button, List, Tag } from 'antd';
import { useState } from 'react';

function UpgradePrompt({ feature, requiredPlan = 'Scale' }) {
  const [visible, setVisible] = useState(true);

  const planBenefits = {
    'Scale': [
      'Inventory tracking',
      'Advanced reporting',
      'Automated notifications',
      'Up to 15 team members',
      'Priority support'
    ]
  };

  return (
    <Modal
      title={`Upgrade to ${requiredPlan} Plan`}
      open={visible}
      onCancel={() => setVisible(false)}
      footer={[
        <Button key="later" onClick={() => setVisible(false)}>
          Maybe Later
        </Button>,
        <Button key="upgrade" type="primary" onClick={() => window.location.href = '/settings/billing'}>
          Upgrade Now
        </Button>
      ]}
    >
      <p>
        <strong>{feature}</strong> requires the {requiredPlan} plan.
      </p>
      
      <h4>What you'll get:</h4>
      <List
        size="small"
        dataSource={planBenefits[requiredPlan]}
        renderItem={item => (
          <List.Item>
            <Tag color="green">✓</Tag> {item}
          </List.Item>
        )}
      />
    </Modal>
  );
}

export default UpgradePrompt;
```

---

## Example 9: Admin Panel - Tenant Feature View

```jsx
// pages/admin/AdminTenantDetail.jsx
import { useEffect, useState } from 'react';
import { Tag, Descriptions } from 'antd';
import adminService from '../services/adminService';

function AdminTenantDetail({ tenantId }) {
  const [tenant, setTenant] = useState(null);
  const [planFeatures, setPlanFeatures] = useState([]);

  useEffect(() => {
    const loadTenant = async () => {
      const response = await adminService.getTenantDetail(tenantId);
      setTenant(response.data);
      
      // Fetch plan features
      const planResponse = await adminService.getSubscriptionPlan(response.data.plan);
      const features = Object.keys(planResponse.data.marketing?.featureFlags || {})
        .filter(key => planResponse.data.marketing.featureFlags[key]);
      setPlanFeatures(features);
    };
    loadTenant();
  }, [tenantId]);

  return (
    <div>
      <Descriptions title="Tenant Details">
        <Descriptions.Item label="Name">{tenant?.name}</Descriptions.Item>
        <Descriptions.Item label="Plan">{tenant?.plan}</Descriptions.Item>
        <Descriptions.Item label="Features">
          {planFeatures.map(feature => (
            <Tag color="blue" key={feature}>{feature}</Tag>
          ))}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
```

---

## 🎯 Key Takeaways

1. **Always use `<FeatureGate>`** for entire pages
2. **Use `hasFeature()`** for conditional rendering
3. **Backend routes protected** via `requireFeature()` middleware
4. **Navigation menus** filter based on features
5. **Upgrade prompts** guide users to higher plans
6. **Admin tools** show what features each tenant has

**Result**: Highlights/perks in marketing can be text, but **actual app access is controlled by feature flags**! 🎯

