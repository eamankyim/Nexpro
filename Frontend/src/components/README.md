# Reusable Table Components

This directory contains reusable components for tables across the application.

## ActionColumn Component

A standardized action column component that displays a "View" button for table rows.

### Usage

```jsx
import ActionColumn from '../components/ActionColumn';

// In your table columns definition:
{
  title: 'Actions',
  key: 'actions',
  render: (_, record) => <ActionColumn onView={handleView} record={record} />,
}
```

### Props

- `onView` (Function) - Callback function when view button is clicked
- `record` (Object) - The current row record data

## DetailsDrawer Component

A reusable side drawer component for displaying record details with optional Edit/Delete actions.

### Basic Usage (View Only)

```jsx
import DetailsDrawer from '../components/DetailsDrawer';

// In your component:
const [drawerVisible, setDrawerVisible] = useState(false);
const [viewingRecord, setViewingRecord] = useState(null);

const handleView = (record) => {
  setViewingRecord(record);
  setDrawerVisible(true);
};

const handleCloseDrawer = () => {
  setDrawerVisible(false);
  setViewingRecord(null);
};

// In your JSX:
<DetailsDrawer
  open={drawerVisible}
  onClose={handleCloseDrawer}
  title="Record Details"
  width={700}
  showActions={false} // Hide Edit/Delete buttons
  fields={viewingRecord ? [
    { label: 'Name', value: viewingRecord.name },
    { label: 'Email', value: viewingRecord.email },
  ] : []}
/>
```

### Advanced Usage (With Edit/Delete)

```jsx
<DetailsDrawer
  open={drawerVisible}
  onClose={handleCloseDrawer}
  title="Customer Details"
  width={700}
  onEdit={isManager && viewingRecord ? () => {
    handleEdit(viewingRecord);
    setDrawerVisible(false);
  } : null}
  onDelete={isManager && viewingRecord ? () => {
    handleDelete(viewingRecord.id);
    setDrawerVisible(false);
  } : null}
  deleteConfirmText="Are you sure you want to delete this customer?"
  fields={viewingRecord ? [
    { label: 'Name', value: viewingRecord.name },
    { 
      label: 'Status', 
      value: viewingRecord.isActive,
      render: (value) => (
        <Tag color={value ? 'green' : 'red'}>
          {value ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    { 
      label: 'Created At', 
      value: viewingRecord.createdAt,
      render: (value) => value ? new Date(value).toLocaleString() : '-'
    },
  ] : []}
/>
```

### Props

- `open` (Boolean) - Controls drawer visibility
- `onClose` (Function) - Callback when drawer is closed
- `title` (String) - Drawer title
- `fields` (Array) - Array of field objects to display
- `width` (Number) - Drawer width in pixels (default: 600)
- `onEdit` (Function) - Callback when edit button is clicked (optional)
- `onDelete` (Function) - Callback when delete is confirmed (optional)
- `showActions` (Boolean) - Whether to show edit/delete actions (default: true)
- `deleteConfirmText` (String) - Custom delete confirmation text

### Field Object Structure

Each field object in the `fields` array can have:

- `label` (String) - Field label
- `value` (Any) - Field value
- `span` (Number) - Column span (default: 1)
- `render` (Function) - Optional custom render function for the value

### Examples

- **With Actions**: `Customers.jsx`, `Vendors.jsx`
- **View Only**: `Jobs.jsx`

## Architecture

### Table Action Pattern

All tables in the application follow this pattern:

1. **Table Row**: Only shows "View" button
2. **Details Drawer**: Shows all record details with Edit/Delete actions (if user has permissions)

This provides a clean, consistent UX across the entire application.

### Benefits

✅ Consistent UI/UX across all tables
✅ Reduced code duplication
✅ Easy to maintain and update
✅ Flexible customization with render functions
✅ Clean separation of concerns
✅ Edit/Delete actions in drawer keep tables uncluttered
✅ Permission-based action visibility

