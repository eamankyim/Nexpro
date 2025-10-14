import { Button, Space, Dropdown } from 'antd';
import { EyeOutlined, MoreOutlined } from '@ant-design/icons';

/**
 * Reusable Action Column Component for Tables
 * @param {Function} onView - Callback function when view button is clicked
 * @param {Object} record - The current row record
 * @param {Array} extraActions - Array of extra action objects with {label, onClick, type, icon}
 */
const ActionColumn = ({ onView, record, extraActions = [] }) => {
  if (extraActions.length === 0) {
    return (
      <Space>
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => onView(record)}
          size="middle"
        >
          View
        </Button>
      </Space>
    );
  }

  const menuItems = extraActions.map((action, index) => ({
    key: index,
    label: action.label,
    onClick: action.onClick,
    icon: action.icon
  }));

  return (
    <Space>
      <Button
        type="primary"
        icon={<EyeOutlined />}
        onClick={() => onView(record)}
        size="middle"
      >
        View
      </Button>
      {extraActions.length > 0 && (
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Button icon={<MoreOutlined />} size="middle" />
        </Dropdown>
      )}
    </Space>
  );
};

export default ActionColumn;


