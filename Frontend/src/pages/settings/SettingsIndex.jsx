import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { legacyTabToRoute } from '../../utils/settingsRoutes';
import SettingsHub from './SettingsHub';

/**
 * Index route for /settings: hub when no tab param, redirect legacy ?tab= values.
 */
const SettingsIndex = () => {
  const [searchParams] = useSearchParams();
  const { isManager } = useAuth();
  const tab = searchParams.get('tab');
  const subtab = searchParams.get('subtab');
  const smsSection = searchParams.get('smsSection') || searchParams.get('section');

  if (!tab) {
    return <SettingsHub />;
  }

  const newRoute = legacyTabToRoute(tab, subtab, smsSection, Boolean(isManager));
  const extraParams = new URLSearchParams(searchParams);
  extraParams.delete('tab');
  extraParams.delete('subtab');
  extraParams.delete('smsSection');
  extraParams.delete('section');
  const qs = extraParams.toString();
  const target = qs ? `${newRoute}${newRoute.includes('?') ? '&' : '?'}${qs}` : newRoute;
  return <Navigate to={target} replace />;
};

export default SettingsIndex;
