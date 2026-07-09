import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { legacyTabToRoute } from '../../utils/settingsRoutes';
import SettingsHub from './SettingsHub';
import SettingsLegacy from '../Settings';

/**
 * Index route for /settings: hub when no tab param, redirect migrated tabs, else legacy Settings.
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
  if (newRoute) {
    const extraParams = new URLSearchParams(searchParams);
    extraParams.delete('tab');
    extraParams.delete('subtab');
    extraParams.delete('smsSection');
    const qs = extraParams.toString();
    const target = qs ? `${newRoute}${newRoute.includes('?') ? '&' : '?'}${qs}` : newRoute;
    return <Navigate to={target} replace />;
  }

  return <SettingsLegacy />;
};

export default SettingsIndex;
