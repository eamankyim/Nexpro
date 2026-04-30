import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth';
import { logger } from '@/utils/logger';

type User = {
  id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  emailVerifiedAt?: string | null;
  isPlatformAdmin?: boolean;
} | null;
type Membership = {
  tenantId: string;
  tenant?: {
    id: string;
    name?: string;
    businessType?: string;
    effectiveFeatureFlags?: Record<string, boolean>;
    metadata?: { shopType?: string; onboarding?: { completedAt?: string }; phone?: string };
  };
  isDefault?: boolean;
  invitedBy?: string | null;
};

type AuthContextType = {
  user: User;
  memberships: Membership[];
  activeTenantId: string | null;
  activeTenant: {
    businessType?: string;
    name?: string;
    effectiveFeatureFlags?: Record<string, boolean>;
    metadata?: { shopType?: string; onboarding?: { completedAt?: string }; phone?: string };
  } | null;
  loading: boolean;
  wasInvited: boolean;
  /** Plan/feature gating — same semantics as web: flag must be exactly true */
  hasFeature: (featureKey: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveTenantId: (id: string | null) => Promise<void>;
  tenantSignup: (payload: { companyName?: string; companyEmail: string; adminName: string; adminEmail: string; password: string; plan?: string }) => Promise<void>;
  refreshAuth: () => Promise<void>;
  googleAuth: (idToken: string, options?: { signUp?: boolean; companyName?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTenant = memberships.find((m) => m.tenantId === activeTenantId)?.tenant ?? null;

  const activeFeatureFlags = useMemo(() => {
    const eff = activeTenant?.effectiveFeatureFlags;
    if (eff && typeof eff === 'object' && !Array.isArray(eff)) return eff;
    return {} as Record<string, boolean>;
  }, [activeTenant]);

  const hasFeature = useCallback(
    (featureKey: string) => activeFeatureFlags[featureKey] === true,
    [activeFeatureFlags]
  );

  const wasInvited = useMemo(
    () => Array.isArray(memberships) && memberships.some((m) => !!(m as Membership & { invitedBy?: string }).invitedBy),
    [memberships]
  );

  const setActiveTenantId = useCallback(
    async (tenantId: string | null) => {
      const prevId = activeTenantId;
      await authService.setActiveTenantId(tenantId);
      setActiveTenantIdState(tenantId);
      // Invalidate all queries when switching tenants to ensure tenant isolation
      if (prevId !== tenantId) {
        queryClient.clear();
        logger.info('AuthContext', 'Tenant switched, cleared query cache');
      }
    },
    [activeTenantId, queryClient]
  );

  // Resolve initial tenant ID from memberships (matches web app logic)
  const resolveInitialTenant = useCallback((membershipsList: Membership[] = [], preferredTenantId: string | null = null): string | null => {
    if (preferredTenantId) {
      return preferredTenantId;
    }
    if (!Array.isArray(membershipsList) || membershipsList.length === 0) {
      return null;
    }
    const defaultMembership = membershipsList.find((m) => m.isDefault);
    return defaultMembership?.tenantId ?? membershipsList[0]?.tenantId ?? null;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    // authService.login returns { ...response, data: payload } where payload is already extracted
    const payload = res?.data ?? res;
    const u = payload?.user ?? null;
    const m = payload?.memberships ?? payload?.tenantMemberships ?? [];
    setUser(u);
    setMemberships(m);
    const tid =
      payload?.defaultTenantId ??
      m.find((x: Membership) => x.isDefault)?.tenantId ??
      m[0]?.tenantId ??
      null;
    if (tid) await setActiveTenantId(tid);
  }, [setActiveTenantId]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setMemberships([]);
    setActiveTenantIdState(null);
  }, []);

  const tenantSignup = useCallback(
    async (payload: { companyName?: string; companyEmail: string; adminName: string; adminEmail: string; password: string; plan?: string }) => {
      const res = await authService.tenantSignup(payload);
      const data = res?.data ?? res;
      const u = data?.user ?? null;
      const m = data?.memberships ?? data?.tenantMemberships ?? [];
      setUser(u);
      setMemberships(m);
      const tid = data?.defaultTenantId ?? m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId ?? null;
      if (tid) await setActiveTenantId(tid);
    },
    [setActiveTenantId]
  );

  const refreshAuth = useCallback(async () => {
    const res = await authService.getCurrentUser();
    const userData = res?.data?.data ?? res?.data ?? res;
    const m = userData?.tenantMemberships ?? [];
    if (m.length > 0) {
      const token = await authService.getToken();
      await authService.persistAuthPayload({
        user: userData,
        token: token ?? undefined,
        memberships: m,
        defaultTenantId: m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId ?? null,
      });
      setUser(userData);
      setMemberships(m);
      const tid = m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId;
      if (tid) await setActiveTenantId(tid);
    }
  }, [setActiveTenantId]);

  const googleAuth = useCallback(
    async (idToken: string, options?: { signUp?: boolean; companyName?: string }) => {
      const res = await authService.googleAuth(idToken, options ?? {});
      const data = res?.data ?? res;
      const u = data?.user ?? null;
      const m = data?.memberships ?? data?.tenantMemberships ?? [];
      setUser(u);
      setMemberships(m);
      const tid = data?.defaultTenantId ?? m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId ?? null;
      if (tid) await setActiveTenantId(tid);
    },
    [setActiveTenantId]
  );

  useEffect(() => {
    let mounted = true;
    logger.info('AuthContext', 'Initializing auth state');

    (async () => {
      try {
        const storedUser = await authService.getStoredUser();
        const storedMemberships = await authService.getStoredMemberships();
        const storedTenantId = await authService.getActiveTenantId();

        logger.info('AuthContext', 'Stored state:', {
          hasUser: !!storedUser,
          membershipsCount: storedMemberships?.length ?? 0,
          activeTenantId: storedTenantId ?? 'none',
        });

        if (mounted && storedUser) setUser(storedUser);
        if (mounted && storedMemberships?.length) setMemberships(storedMemberships);

        // Resolve activeTenantId from stored data (prefer stored if valid, then default, then first)
        // Validate that storedTenantId exists in memberships before using it
        const isValidStoredTenant = storedTenantId && storedMemberships?.some((m: Membership) => m.tenantId === storedTenantId);
        const preferredTenantId = isValidStoredTenant ? storedTenantId : null;
        const resolvedTenantId = resolveInitialTenant(storedMemberships ?? [], preferredTenantId);
        
        if (mounted && resolvedTenantId) {
          // Always persist the resolved tenant ID to storage
          await authService.setActiveTenantId(resolvedTenantId);
          setActiveTenantIdState(resolvedTenantId);
          logger.info('AuthContext', 'Resolved activeTenantId:', resolvedTenantId, {
            fromStored: isValidStoredTenant,
            fromDefault: !isValidStoredTenant && storedMemberships?.find((m: Membership) => m.isDefault)?.tenantId === resolvedTenantId,
            userEmail: storedUser?.email,
            businessType: storedMemberships?.find((m: Membership) => m.tenantId === resolvedTenantId)?.tenant?.businessType,
            fromFirst: !isValidStoredTenant && storedMemberships?.[0]?.tenantId === resolvedTenantId,
          });
        } else {
          logger.warn('AuthContext', 'No tenant ID resolved from stored data');
        }

        const activeMembershipForFlags =
          storedMemberships?.find((m: Membership) => m.tenantId === resolvedTenantId) ?? storedMemberships?.[0];
        const eff0 = activeMembershipForFlags?.tenant?.effectiveFeatureFlags;
        const flagsHydrated =
          eff0 != null &&
          typeof eff0 === 'object' &&
          !Array.isArray(eff0) &&
          Object.keys(eff0).length > 0;
        const meta = activeMembershipForFlags?.tenant?.metadata;
        if (storedUser && (!storedMemberships?.length || !meta || !flagsHydrated)) {
          logger.info('AuthContext', 'Refetching /auth/me (stale or missing memberships)');
          try {
            const res = await authService.getCurrentUser();
            // Backend returns: { success: true, data: user } where user has tenantMemberships
            // Mobile API doesn't unwrap response.data, so we need response.data.data
            const user = res?.data?.data ?? res?.data ?? res;
            const m = user?.tenantMemberships ?? [];
            if (mounted && m.length) {
              setMemberships(m);
              await authService.persistAuthPayload({
                user,
                memberships: m,
                defaultTenantId: m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId ?? null,
              });
              const tid = m.find((x: Membership) => x.isDefault)?.tenantId ?? m[0]?.tenantId;
              if (tid) await setActiveTenantId(tid);
              logger.info('AuthContext', 'Refetched memberships:', m.length);
            }
          } catch (err) {
            logger.error('AuthContext', 'Failed to refetch /auth/me:', err);
          }
        }
      } catch (err) {
        logger.error('AuthContext', 'Init error:', err);
      } finally {
        if (mounted) setLoading(false);
        logger.info('AuthContext', 'Init complete');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setActiveTenantId, resolveInitialTenant]);

  const value: AuthContextType = {
    user,
    memberships,
    activeTenantId,
    activeTenant,
    loading,
    wasInvited,
    hasFeature,
    login,
    logout,
    setActiveTenantId,
    tenantSignup,
    refreshAuth,
    googleAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
