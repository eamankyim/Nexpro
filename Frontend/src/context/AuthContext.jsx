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

  /**
   * Resolves the initial tenant ID from memberships
   * @param {Array} membershipsList - List of tenant memberships
   * @param {string|null} preferredTenantId - Preferred tenant ID (e.g., from localStorage)
   * @returns {string|null} - Resolved tenant ID
   */
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

    console.log('[AuthContext] 🔍 Initializing auth state:', {
      hasUser: !!storedUser,
      hasMemberships: !!storedMemberships,
      membershipsCount: storedMemberships?.length || 0,
      storedActiveTenantId,
      allLocalStorageKeys: Object.keys(localStorage)
    });

    if (storedUser) {
      setUser(storedUser);
    }
    if (storedMemberships && storedMemberships.length > 0) {
      setMemberships(storedMemberships);
    }

    const firstStoredTenant = storedMemberships?.[0]?.tenant;
    const hasStaleMemberships = storedUser && storedMemberships?.length > 0 && !firstStoredTenant?.metadata;

    // If user is logged in but has no memberships, or memberships lack tenant metadata (stale cache), refetch from backend
    if (storedUser && (hasStaleMemberships || !storedMemberships || storedMemberships.length === 0)) {
      console.log('[AuthContext] 🔄 Refetching /auth/me...', hasStaleMemberships ? '(stale tenant metadata)' : '(no memberships)');
      authService.getCurrentUser()
        .then((body) => {
          const userData = body?.data ?? body;
          const memberships = userData?.tenantMemberships || [];
          console.log('[AuthContext] ✅ Fetched memberships from backend:', {
            membershipsCount: memberships.length,
            memberships: memberships.map(m => ({ tenantId: m.tenantId, isDefault: m.isDefault }))
          });
          
          if (memberships.length > 0) {
            setMemberships(memberships);
            authService.persistAuthPayload({
              user: userData,
              memberships: memberships,
              defaultTenantId: memberships[0]?.tenantId || null
            });
            
            const resolvedTenantId = resolveInitialTenant(memberships, null);
            if (resolvedTenantId) {
              authService.setActiveTenantId(resolvedTenantId);
              setActiveTenantId(resolvedTenantId);
              console.log('[AuthContext] ✅ Set activeTenantId from fetched memberships:', resolvedTenantId);
            }
          } else {
            console.warn('[AuthContext] ⚠️ User has no tenant memberships - they may need to log in via SSO');
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('[AuthContext] ❌ Error fetching user memberships:', error);
          setLoading(false);
        });
    } else {
      const resolvedTenantId = resolveInitialTenant(storedMemberships, storedActiveTenantId);
      
      console.log('[AuthContext] 🔍 Resolved tenant ID:', {
        resolvedTenantId,
        storedActiveTenantId,
        hasMemberships: !!storedMemberships,
        memberships: storedMemberships?.map(m => ({ tenantId: m.tenantId, isDefault: m.isDefault }))
      });
      
      // ALWAYS ensure activeTenantId is persisted to localStorage if we have a resolved tenant
      if (resolvedTenantId) {
        console.log('[AuthContext] ✅ Setting activeTenantId in localStorage:', resolvedTenantId);
        authService.setActiveTenantId(resolvedTenantId);
      } else {
        console.warn('[AuthContext] ⚠️ No tenant ID resolved - user may not have tenant membership');
      }
      
      setActiveTenantId(resolvedTenantId);
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Synchronizes authentication state across the application
   * Updates user, memberships, and active tenant ID
   * @param {Object} payload - Auth payload containing user, memberships, and defaultTenantId
   * @param {Object} payload.user - User object
   * @param {Array} payload.memberships - Array of tenant memberships
   * @param {string} payload.defaultTenantId - Default tenant ID
   */
  const syncAuthState = (payload = {}) => {
    const { user: nextUser, memberships: nextMemberships = [], defaultTenantId } = payload;
    setUser(nextUser || null);
    setMemberships(nextMemberships);
    const tenantFromStorage = authService.getActiveTenantId();
    const resolvedTenantId = resolveInitialTenant(
      nextMemberships,
      tenantFromStorage || defaultTenantId || null
    );
    
    // Persist activeTenantId to localStorage so API calls include the header
    if (resolvedTenantId) {
      authService.setActiveTenantId(resolvedTenantId);
      console.log('[AuthContext] ✅ Set activeTenantId in localStorage:', resolvedTenantId);
    } else {
      console.warn('[AuthContext] ⚠️ No tenant ID resolved, user may not have tenant membership');
    }
    
    setActiveTenantId(resolvedTenantId);
  };

  /**
   * Logs in a user with credentials
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} - Login response
   * @throws {Error} - If login fails
   */
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

  const sabitoSSO = async (sabitoToken) => {
    try {
      console.log('[AuthContext] 🔐 Starting Sabito SSO login...');
      const response = await authService.sabitoSSO(sabitoToken);
      console.log('[AuthContext] ✅ SSO response received:', {
        hasData: !!response?.data,
        hasUser: !!response?.data?.user,
        hasMemberships: !!response?.data?.memberships,
        membershipsCount: response?.data?.memberships?.length || 0,
        defaultTenantId: response?.data?.defaultTenantId,
        fullResponse: response?.data
      });
      
      syncAuthState(response.data || {});
      
      // Verify activeTenantId was set
      const activeTenantId = authService.getActiveTenantId();
      console.log('[AuthContext] ✅ Active tenant ID after sync:', activeTenantId);
      
      // Invalidate organization settings query to refetch after SSO
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      return response;
    } catch (error) {
      console.error('[AuthContext] ❌ SSO login failed:', error);
      throw error;
    }
  };

  const loginWithToken = async (token) => {
    try {
      // Get user info with the token (API returns { success, data: user })
      const body = await authService.getCurrentUser();
      const userData = body?.data ?? body;
      const memberships = userData?.tenantMemberships || [];
      
      // Sync auth state
      syncAuthState({
        user: userData,
        memberships: memberships,
        defaultTenantId: memberships[0]?.tenantId || null
      });
      
      // Invalidate organization settings query to refetch after login
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      
      return { success: true, data: { user: userData, memberships } };
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

  /** Refetch /auth/me and update auth state + storage. Call after onboarding or when tenant metadata may have changed. */
  /**
   * Refetches user data from the server and updates auth state
   * Useful after operations that modify tenant metadata (e.g., onboarding)
   * @returns {Promise<Object>} - Updated auth payload
   */
  const refreshAuthState = async () => {
    console.log('[AuthContext] refreshAuthState: fetching /auth/me');
    const body = await authService.getCurrentUser();
    const userData = body?.data ?? body;
    const nextMemberships = userData?.tenantMemberships || [];
    const firstTenant = nextMemberships[0]?.tenant;
    console.log('[AuthContext] refreshAuthState: body keys=%j, userData keys=%j, memberships count=%s, first tenant id=%s, metadata=%j', body ? Object.keys(body) : [], userData ? Object.keys(userData) : [], nextMemberships.length, firstTenant?.id, firstTenant?.metadata);
    const payload = {
      user: userData,
      memberships: nextMemberships,
      defaultTenantId: authService.getActiveTenantId() || nextMemberships.find((m) => m.isDefault)?.tenantId || nextMemberships[0]?.tenantId || null,
    };
    authService.persistAuthPayload(payload);
    syncAuthState(payload);
    console.log('[AuthContext] refreshAuthState: state updated, defaultTenantId=%s', payload.defaultTenantId);
    return payload;
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
    refreshAuthState,
    login,
    register,
    logout,
    tenantSignup,
    sabitoSSO,
    loginWithToken,
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


