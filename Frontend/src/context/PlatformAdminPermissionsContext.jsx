import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import adminService from '../services/adminService';

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
      const response = await adminService.getUserPermissions(user.id);
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
    return permissionKeys.includes(permissionKey);
  }, [permissionKeys]);

  const hasAnyPermission = useCallback((...keys) => {
    return keys.some(key => permissionKeys.includes(key));
  }, [permissionKeys]);

  const hasAllPermissions = useCallback((...keys) => {
    return keys.every(key => permissionKeys.includes(key));
  }, [permissionKeys]);

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
