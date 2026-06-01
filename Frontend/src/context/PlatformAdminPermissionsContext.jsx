import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import adminService from '../services/adminService';
import { isBootstrapPlatformSuperAdmin } from '../utils/platformAdminBootstrap';

const PlatformAdminPermissionsContext = createContext();

export const usePlatformAdminPermissions = () => {
  const context = useContext(PlatformAdminPermissionsContext);
  if (!context) {
    throw new Error('usePlatformAdminPermissions must be used within PlatformAdminPermissionsProvider');
  }
  return context;
};

export const PlatformAdminPermissionsProvider = ({ children }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [permissionKeys, setPermissionKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isBootstrapSuperAdmin = useMemo(
    () => Boolean(user?.isPlatformAdmin) && isBootstrapPlatformSuperAdmin(user),
    [user]
  );

  const loadPermissions = useCallback(async () => {
    if (!user?.isPlatformAdmin) {
      setPermissions([]);
      setPermissionKeys([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getMyPermissions();
      if (response?.success) {
        setPermissions(response.data || []);
        setPermissionKeys((response.data || []).map(p => p.key));
      } else {
        setPermissions([]);
        setPermissionKeys([]);
      }
    } catch (err) {
      console.error('Failed to load platform admin permissions:', err);
      setError(err);
      setPermissions([]);
      setPermissionKeys([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const hasPermission = useCallback((permissionKey) => {
    if (isBootstrapSuperAdmin) return true;
    return permissionKeys.includes(permissionKey);
  }, [permissionKeys, isBootstrapSuperAdmin]);

  const hasAnyPermission = useCallback((...keys) => {
    if (isBootstrapSuperAdmin) return true;
    return keys.some(key => permissionKeys.includes(key));
  }, [permissionKeys, isBootstrapSuperAdmin]);

  const hasAllPermissions = useCallback((...keys) => {
    if (isBootstrapSuperAdmin) return true;
    return keys.every(key => permissionKeys.includes(key));
  }, [permissionKeys, isBootstrapSuperAdmin]);

  const value = {
    permissions,
    permissionKeys,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: loadPermissions
  };

  return (
    <PlatformAdminPermissionsContext.Provider value={value}>
      {children}
    </PlatformAdminPermissionsContext.Provider>
  );
};
