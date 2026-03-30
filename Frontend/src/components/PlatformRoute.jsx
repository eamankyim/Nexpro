import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PlatformRoute = ({ children }) => {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  if (!user?.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PlatformRoute;


