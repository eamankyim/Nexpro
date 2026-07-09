import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { legacyTabToRoute } from '../utils/settingsRoutes';

/**
 * Legacy /settings?tab=... redirect wrapper (replaces monolithic Settings.jsx).
 */
const Settings = () => {
  const [searchParams] = useSearchParams();
  const { isManager } = useAuth();
  const tab = searchParams.get('tab') || 'workspace';
  const subtab = searchParams.get('subtab');
  const smsSection = searchParams.get('smsSection') || searchParams.get('section');
  const route = legacyTabToRoute(tab, subtab, smsSection, Boolean(isManager));
  return <Navigate to={route} replace />;
};

export default Settings;
