# Toast Notification Usage Guide

## Overview

This project uses a custom toast utility (`src/utils/toast.js`) that provides clear, user-friendly error messages. The utility automatically extracts meaningful error messages from API responses and displays them using Ant Design's message component.

## Quick Start

### Import the toast utilities:

```javascript
import { showSuccess, showError, showWarning, showInfo, handleApiError } from '../utils/toast';
```

## Usage Examples

### 1. Success Messages

```javascript
import { showSuccess } from '../utils/toast';

// Simple success message
showSuccess('User created successfully');

// With custom duration (default: 3 seconds)
showSuccess('User created successfully', 5);
```

### 2. Error Messages (Recommended)

The toast utility automatically extracts clear error messages from API responses:

```javascript
import { showError, handleApiError } from '../utils/toast';

// Option 1: Using showError (automatically extracts error message)
try {
  await userService.create(userData);
  showSuccess('User created successfully');
} catch (error) {
  showError(error, 'Failed to create user. Please try again.');
}

// Option 2: Using handleApiError (includes context)
try {
  await userService.create(userData);
  showSuccess('User created successfully');
} catch (error) {
  handleApiError(error, { context: 'create user' });
  // Shows: "Failed to create user. Please try again."
}
```

### 3. Warning Messages

```javascript
import { showWarning } from '../utils/toast';

showWarning('This action cannot be undone');
```

### 4. Info Messages

```javascript
import { showInfo } from '../utils/toast';

showInfo('Your changes have been saved');
```

## Migration Guide

### Before (Old Way):

```javascript
import { message } from 'antd';

try {
  await userService.create(userData);
  message.success('User created successfully');
} catch (error) {
  message.error('Failed to create user');
  // Generic message, doesn't show actual error
}
```

### After (New Way):

```javascript
import { showSuccess, handleApiError } from '../utils/toast';

try {
  await userService.create(userData);
  showSuccess('User created successfully');
} catch (error) {
  handleApiError(error, { context: 'create user' });
  // Shows clear error message from API
}
```

## Error Message Extraction

The toast utility automatically extracts error messages from various API response formats:

1. **Standard API Response:**
   ```json
   {
     "success": false,
     "message": "Email already exists"
   }
   ```
   → Shows: "Email already exists"

2. **Validation Errors:**
   ```json
   {
     "success": false,
     "errors": ["Email is required", "Password must be at least 8 characters"]
   }
   ```
   → Shows: "Email is required, Password must be at least 8 characters"

3. **Sequelize Errors:**
   ```json
   {
     "success": false,
     "errors": {
       "email": "Email already exists",
       "name": "Name is required"
     }
   }
   ```
   → Shows: "Email already exists, Name is required"

4. **Network Errors:**
   - Network errors → "Unable to connect to server. Please check your internet connection."
   - Timeout errors → "Request timed out. Please try again."

## Best Practices

### 1. Always provide context in error messages:

```javascript
// Good
handleApiError(error, { context: 'delete user' });
// Shows: "Failed to delete user. Please try again."

// Better - with specific default message
showError(error, 'Unable to delete user. The user may be assigned to active jobs.');
```

### 2. Use handleApiError for API calls:

```javascript
// Good - provides context automatically
handleApiError(error, { context: 'fetch customers' });

// Also good - with custom message
showError(error, 'Unable to load customers. Please refresh the page.');
```

### 3. Don't log errors manually (handleApiError does it):

```javascript
// handleApiError automatically logs errors for debugging
handleApiError(error, { context: 'save job' });
// No need for: console.error(error);
```

### 4. Use appropriate message types:

```javascript
// Success - for completed actions
showSuccess('Job created successfully');

// Error - for failures
showError(error, 'Failed to create job');

// Warning - for cautionary messages
showWarning('This will delete all associated data');

// Info - for informational messages
showInfo('Your changes are being saved...');
```

## Complete Example

```javascript
import { useState } from 'react';
import { Form, Button } from 'antd';
import { showSuccess, handleApiError } from '../utils/toast';
import userService from '../services/userService';

const CreateUser = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await userService.create(values);
      showSuccess('User created successfully');
      form.resetFields();
    } catch (error) {
      handleApiError(error, { 
        context: 'create user',
        defaultMessage: 'Unable to create user. Please check all fields and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit}>
      {/* Form fields */}
      <Button type="primary" htmlType="submit" loading={loading}>
        Create User
      </Button>
    </Form>
  );
};
```

## API Reference

### `showSuccess(msg, duration?)`
- **msg**: Success message string
- **duration**: Duration in seconds (default: 3)

### `showError(error, defaultMessage?, duration?)`
- **error**: Error object or error message string
- **defaultMessage**: Default message if error extraction fails (default: "An error occurred. Please try again.")
- **duration**: Duration in seconds (default: 5)

### `showWarning(msg, duration?)`
- **msg**: Warning message string
- **duration**: Duration in seconds (default: 4)

### `showInfo(msg, duration?)`
- **msg**: Info message string
- **duration**: Duration in seconds (default: 3)

### `handleApiError(error, options?)`
- **error**: Error object from API call
- **options**: 
  - `defaultMessage`: Custom default message
  - `context`: Context string (e.g., "create user", "fetch data")
  - `logError`: Whether to log error (default: true)

### `getErrorMessage(error, defaultMessage?)`
- Extracts error message from error object
- Returns user-friendly error message string

## Files to Update

The following files still use the old `message` from antd and should be updated:

- `src/pages/Customers.jsx`
- `src/pages/Vendors.jsx`
- `src/pages/Jobs.jsx`
- `src/pages/Invoices.jsx`
- `src/pages/Expenses.jsx`
- `src/pages/Quotes.jsx`
- `src/pages/Inventory.jsx`
- `src/pages/Leads.jsx`
- `src/pages/Employees.jsx`
- `src/pages/Payroll.jsx`
- `src/pages/Accounting.jsx`
- `src/pages/Reports.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/Settings.jsx`
- `src/pages/Pricing.jsx`
- `src/pages/TenantOnboarding.jsx`
- `src/pages/admin/AdminSettings.jsx`
- `src/pages/admin/AdminTenants.jsx`
- `src/components/ForcePasswordChange.jsx`
- `src/hooks/useCustomDropdown.js`

## Migration Checklist

For each file:
1. ✅ Remove `message` from antd imports
2. ✅ Add toast utility imports
3. ✅ Replace `message.success()` with `showSuccess()`
4. ✅ Replace `message.error()` with `showError()` or `handleApiError()`
5. ✅ Replace `message.warning()` with `showWarning()`
6. ✅ Replace `message.info()` with `showInfo()`
7. ✅ Update error handling to use `handleApiError()` with context





