import { Card, Descriptions, Tag } from 'antd';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1>Profile</h1>
      <Card>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Name">{user?.name}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color="blue">{user?.role?.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={user?.isActive ? 'green' : 'red'}>
              {user?.isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default Profile;


