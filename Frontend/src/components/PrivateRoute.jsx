import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (import.meta.env.DEV) {
    console.log('[PrivateRoute] render:', {
      pathname: location.pathname,
      isAuthenticated,
      loading,
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand" />
      </div>
    );
  }

  if (isAuthenticated) return children;

  const returnTo = `${location.pathname}${location.search || ''}`;
  return (
    <Navigate
      to={`/login?returnTo=${encodeURIComponent(returnTo)}&reason=session_required`}
      replace
      state={{ returnTo }}
    />
  );
};

export default PrivateRoute;


