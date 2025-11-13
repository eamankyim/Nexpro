import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../context/AuthContext';

const PlatformRoute = ({ children }) => {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user?.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PlatformRoute;


