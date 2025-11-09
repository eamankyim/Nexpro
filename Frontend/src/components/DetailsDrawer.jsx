import { Drawer, Descriptions, Button, Space, Popconfirm, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';

/**
 * Reusable Details Drawer Component
 * @param {Boolean} open - Whether the drawer is visible
 * @param {Function} onClose - Callback function when drawer is closed
 * @param {String} title - Drawer title
 * @param {Array} fields - Array of field objects with { label, value, span, render }
 * @param {Array} tabs - Array of tab objects with { key, label, content } (optional)
 * @param {Number} width - Drawer width (default: 600)
 * @param {Function} onEdit - Callback function when edit button is clicked
 * @param {Function} onDelete - Callback function when delete is confirmed
 * @param {Function} onPrint - Callback function when print button is clicked
 * @param {Boolean} showActions - Whether to show edit/delete actions (default: true)
 * @param {String} deleteConfirmText - Custom delete confirmation text
 */
const DetailsDrawer = ({ 
  open, 
  onClose, 
  title, 
  fields = [], 
  tabs = null,
  width = 600,
  onEdit,
  onDelete,
  onPrint,
  onMarkPaid,
  showActions = true,
  deleteConfirmText = 'Are you sure you want to delete this item?'
}) => {
  const renderFields = (fieldsToRender) => (
    <Descriptions column={1} bordered>
      {fieldsToRender.map((field, index) => (
        <Descriptions.Item 
          key={index} 
          label={field.label}
          span={field.span || 1}
        >
          {field.render ? field.render(field.value) : field.value || '-'}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );

  return (
    <Drawer
      title={title}
      placement="right"
      onClose={onClose}
      open={open}
      width={width}
      destroyOnClose
      extra={
        (showActions && (onEdit || onDelete || onPrint || onMarkPaid)) && (
          <Space>
            {onPrint && (
              <Button
                type="default"
                icon={<PrinterOutlined />}
                onClick={onPrint}
              >
                Print
              </Button>
            )}
            {onMarkPaid && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={onMarkPaid}
              >
                Mark as Paid
              </Button>
            )}
            {onEdit && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={onEdit}
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Popconfirm
                title={deleteConfirmText}
                onConfirm={onDelete}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  Delete
                </Button>
              </Popconfirm>
            )}
          </Space>
        )
      }
    >
      {tabs ? (
        <Tabs
          defaultActiveKey={tabs[0]?.key}
          items={tabs.map(tab => ({
            key: tab.key,
            label: tab.label,
            children: tab.content
          }))}
        />
      ) : (
        renderFields(fields)
      )}
    </Drawer>
  );
};

export default DetailsDrawer;

