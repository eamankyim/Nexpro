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

    if (import.meta.env.DEV) console.log('[AuthContext] Initializing auth state:', {
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
      if (import.meta.env.DEV) console.log('[AuthContext] Refetching /auth/me...', hasStaleMemberships ? '(stale)' : '(no memberships)');
      authService.getCurrentUser()
        .then((body) => {
          const userData = body?.data ?? body;
          const memberships = userData?.tenantMemberships || [];
          if (import.meta.env.DEV) console.log('[AuthContext] Fetched memberships:', {
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
              if (import.meta.env.DEV) console.log('[AuthContext] Set activeTenantId:', resolvedTenantId);
            }
          } else {
            if (import.meta.env.DEV) console.warn('[AuthContext] No tenant memberships');
          }
          setLoading(false);
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.error('[AuthContext] Error fetching memberships:', error);
          setLoading(false);
        });
    } else {
      const resolvedTenantId = resolveInitialTenant(storedMemberships, storedActiveTenantId);
      
      if (import.meta.env.DEV) console.log('[AuthContext] Resolved tenant:', {
        resolvedTenantId,
        storedActiveTenantId,
        hasMemberships: !!storedMemberships,
        memberships: storedMemberships?.map(m => ({ tenantId: m.tenantId, isDefault: m.isDefault }))
      });
      
      // ALWAYS ensure activeTenantId is persisted to localStorage if we have a resolved tenant
      if (resolvedTenantId) {
        if (import.meta.env.DEV) console.log('[AuthContext] Set activeTenantId:', resolvedTenantId);
        authService.setActiveTenantId(resolvedTenantId);
      } else {
        if (import.meta.env.DEV) console.warn('[AuthContext] No tenant ID resolved');
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
    
    if (import.meta.env.DEV) {
      console.log('[AuthContext] syncAuthState payload:', {
        hasUser: !!nextUser,
        membershipsCount: Array.isArray(nextMemberships) ? nextMemberships.length : 0,
        defaultTenantId,
      });
    }

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
      if (import.meta.env.DEV) console.log('[AuthContext] Set activeTenantId:', resolvedTenantId);
    } else {
      if (import.meta.env.DEV) console.warn('[AuthContext] No tenant ID resolved');
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
      if (import.meta.env.DEV) {
        const data = response?.data || {};
        console.log('[AuthContext] login success:', {
          hasUser: !!data.user,
          membershipsCount: Array.isArray(data.memberships) ? data.memberships.length : 0,
          defaultTenantId: data.defaultTenantId || null,
        });
      }
      return response;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[AuthContext] login failed:', error);
      }
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
      if (import.meta.env.DEV) console.log('[AuthContext] Starting Sabito SSO login...');
      const response = await authService.sabitoSSO(sabitoToken);
      if (import.meta.env.DEV) console.log('[AuthContext] SSO response:', {
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
      if (import.meta.env.DEV) console.log('[AuthContext] Active tenant after sync:', activeTenantId);
      
      // Invalidate organization settings query to refetch after SSO
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      return response;
    } catch (error) {
      if (import.meta.env.DEV) console.error('[AuthContext] SSO login failed:', error);
      throw error;
    }
  };

  /**
   * Google OAuth sign-in or sign-up.
   * @param {string} idToken - Google ID token from credentialResponse.credential
   * @param {Object} options - { signUp: boolean, businessType?: string, companyName?: string }
   * @returns {Promise<{ data }>}
   */
  const googleAuth = async (idToken, options = {}) => {
    const response = await authService.googleAuth(idToken, options);
    syncAuthState(response.data || {});
    queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
    return response;
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
    if (import.meta.env.DEV) console.log('[AuthContext] refreshAuthState: fetching /auth/me');
    const body = await authService.getCurrentUser();
    const userData = body?.data ?? body;
    const nextMemberships = userData?.tenantMemberships || [];
    const firstTenant = nextMemberships[0]?.tenant;
    if (import.meta.env.DEV) console.log('[AuthContext] refreshAuthState:', { membershipsCount: nextMemberships.length, firstTenantId: firstTenant?.id });
    const payload = {
      user: userData,
      memberships: nextMemberships,
      defaultTenantId: authService.getActiveTenantId() || nextMemberships.find((m) => m.isDefault)?.tenantId || nextMemberships[0]?.tenantId || null,
    };
    authService.persistAuthPayload(payload);
    syncAuthState(payload);
    if (import.meta.env.DEV) console.log('[AuthContext] refreshAuthState: updated, defaultTenantId=', payload.defaultTenantId);
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
  const isPlatformAdmin = user?.isPlatformAdmin === true;
  const isFirstLogin = user?.isFirstLogin === true;
  const isWorkspaceAdmin = ['owner', 'admin'].includes(effectiveRole || '');

  /** True if user signed up via invite link (invitedBy set on any membership). */
  const wasInvited = useMemo(
    () => Array.isArray(memberships) && memberships.some((m) => !!m.invitedBy),
    [memberships]
  );

  /**
   * Show "Complete Your Profile" only for admin-created users (isFirstLogin) who were
   * NOT invited and are NOT admins (platform or workspace). Invited users set their own
   * password at signup; admins are excluded.
   */
  const shouldCompleteProfile = useMemo(
    () => Boolean(isFirstLogin && !isPlatformAdmin && !isWorkspaceAdmin && !wasInvited),
    [isFirstLogin, isPlatformAdmin, isWorkspaceAdmin, wasInvited]
  );

  // Log core auth state whenever it changes (for redirect debugging)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[AuthContext] State change:', {
      hasUser: !!user,
      activeTenantId,
      membershipsCount: Array.isArray(memberships) ? memberships.length : 0,
      loading,
    });
  }, [user, activeTenantId, memberships, loading]);

  useEffect(() => {
    if (!user) return;
    console.log('[ProfileCompletion] Decision factors:', {
      userId: user?.id,
      email: user?.email,
      isFirstLogin,
      isPlatformAdmin,
      isWorkspaceAdmin,
      wasInvited,
      effectiveRole,
      membershipsInvitedBy: Array.isArray(memberships) ? memberships.map((m) => ({ tenantId: m.tenantId, role: m.role, invitedBy: m.invitedBy })) : [],
      shouldCompleteProfile,
      reason: !isFirstLogin
        ? 'not first login'
        : isPlatformAdmin
          ? 'platform admin excluded'
          : isWorkspaceAdmin
            ? 'workspace admin excluded'
            : wasInvited
              ? 'invited user excluded'
              : 'admin-created user → must complete profile',
    });
  }, [user, memberships, isFirstLogin, isPlatformAdmin, isWorkspaceAdmin, wasInvited, shouldCompleteProfile, effectiveRole]);

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
    googleAuth,
    loginWithToken,
    updateUser,
    loading,
    isAuthenticated: !!user,
    isAdmin: ['owner', 'admin'].includes(effectiveRole),
    isManager: ['owner', 'admin', 'manager'].includes(effectiveRole || ''),
    isPlatformAdmin,
    isFirstLogin,
    wasInvited,
    shouldCompleteProfile,
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


