import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [activeTenantId, setActiveTenantId] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const resolveInitialTenant = (membershipsList = [], preferredTenantId = null) => {
    if (preferredTenantId) {
      return preferredTenantId;
    }
    if (!Array.isArray(membershipsList) || membershipsList.length === 0) {
      return null;
    }
    const defaultMembership = membershipsList.find((membership) => membership.isDefault);
    return defaultMembership?.tenantId || membershipsList[0]?.tenantId || null;
  };

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = authService.getStoredUser();
    const storedMemberships = authService.getStoredMemberships();
    const storedActiveTenantId = authService.getActiveTenantId();

    if (storedUser) {
      setUser(storedUser);
    }
    if (storedMemberships) {
      setMemberships(storedMemberships);
    }
    setActiveTenantId(resolveInitialTenant(storedMemberships, storedActiveTenantId));
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAuthState = (payload = {}) => {
    const { user: nextUser, memberships: nextMemberships = [], defaultTenantId } = payload;
    setUser(nextUser || null);
    setMemberships(nextMemberships);
    const tenantFromStorage = authService.getActiveTenantId();
    setActiveTenantId(
      resolveInitialTenant(
        nextMemberships,
        tenantFromStorage || defaultTenantId || null
      )
    );
  };

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      syncAuthState(response.data || {});
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      syncAuthState(response.data || {});
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setMemberships([]);
    setActiveTenantId(null);
    queryClient.clear();
  };

  const tenantSignup = async (payload) => {
    try {
      const response = await authService.tenantSignup(payload);
      syncAuthState(response.data || {});
      return response;
    } catch (error) {
      throw error;
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const setActiveTenant = (tenantId) => {
    authService.setActiveTenantId(tenantId);
    setActiveTenantId(tenantId || null);
    queryClient.clear();
  };

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.tenantId === activeTenantId) || null,
    [memberships, activeTenantId]
  );

  const activeTenant = useMemo(
    () => activeMembership?.tenant || null,
    [activeMembership]
  );

  const tenantRole = useMemo(
    () => activeMembership?.role || null,
    [activeMembership]
  );

  const effectiveRole = tenantRole || user?.role || null;
  const value = {
    user,
    memberships,
    tenantMemberships: memberships,
    activeTenantId,
    activeTenant,
    tenantRole,
    setActiveTenant,
    login,
    register,
    logout,
    tenantSignup,
    updateUser,
    loading,
    isAuthenticated: !!user,
    isAdmin: ['owner', 'admin'].includes(effectiveRole),
    isManager: ['owner', 'admin', 'manager'].includes(effectiveRole || ''),
    isPlatformAdmin: user?.isPlatformAdmin === true,
    isFirstLogin: user?.isFirstLogin === true,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;


