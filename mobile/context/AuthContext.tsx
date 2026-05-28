import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth';
import { settingsService } from '@/services/settings';
import { logger } from '@/utils/logger';
import { shouldSuppressAppGuidance } from '@/utils/appGuidanceEligibility';
import { isOnboardingComplete } from '@/utils/onboardingStatus';
import { membershipTenantId, normalizeMemberships } from '@/utils/membership';

type User = {
  id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  emailVerifiedAt?: string | null;
  isPlatformAdmin?: boolean;
  createdAt?: string;
  lastLogin?: string;
  isFirstLogin?: boolean;
} | null;
type Membership = {
  tenantId: string;
  role?: string | null;
  tenant?: {
    id: string;
    name?: string;
    businessType?: string;
    createdAt?: string;
    effectiveFeatureFlags?: Record<string, boolean>;
    metadata?: {
      shopType?: string;
      onboarding?: { completedAt?: string };
      phone?: string;
      email?: string;
    };
  };
  isDefault?: boolean;
  invitedBy?: string | null;
  createdAt?: string;
  joinedAt?: string;
};

type AuthContextType = {
  user: User;
  memberships: Membership[];
  activeTenantId: string | null;
  activeTenant: {
    businessType?: string;
    name?: string;
    effectiveFeatureFlags?: Record<string, boolean>;
    metadata?: {
      shopType?: string;
      onboarding?: { completedAt?: string };
      phone?: string;
      email?: string;
    };
  } | null;
  loading: boolean;
  /** True while login/init is syncing memberships from /auth/me */
  sessionSyncing: boolean;
  wasInvited: boolean;
  /** Skip forced onboarding for tenured or very active users */
  suppressAppGuidance: boolean;
  tenantRole: string | null;
  isDriver: boolean;
  isAdmin: boolean;
  isManager: boolean;
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
  const [sessionSyncing, setSessionSyncing] = useState(false);

  const activeMembership =
    memberships.find((m) => membershipTenantId(m) === activeTenantId) ?? null;
  const activeTenant = activeMembership?.tenant ?? null;
  const tenantRole = activeMembership?.role ?? null;
  const isDriver = tenantRole === 'driver';
  const isAdmin = ['owner', 'admin'].includes(tenantRole || '');
  const isManager = ['owner', 'admin', 'manager'].includes(tenantRole || '');

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

  const suppressAppGuidance = useMemo(
    () => shouldSuppressAppGuidance({ user, activeMembership, activeTenant }),
    [user, activeMembership, activeTenant]
  );

  const activeTenantIdRef = useRef(activeTenantId);
  activeTenantIdRef.current = activeTenantId;

  const setActiveTenantId = useCallback(
    async (tenantId: string | null) => {
      const prevId = activeTenantIdRef.current;
      await authService.setActiveTenantId(tenantId);
      setActiveTenantIdState(tenantId);
      activeTenantIdRef.current = tenantId;
      if (prevId !== tenantId) {
        queryClient.clear();
        logger.info('AuthContext', 'Tenant switched, cleared query cache');
      }
    },
    [queryClient]
  );

  const setActiveTenantIdRef = useRef(setActiveTenantId);
  setActiveTenantIdRef.current = setActiveTenantId;

  const resolveInitialTenant = useCallback(
    (membershipsList: Membership[] = [], preferredTenantId: string | null = null): string | null => {
      if (preferredTenantId) return preferredTenantId;
      if (!Array.isArray(membershipsList) || membershipsList.length === 0) return null;
      const defaultMembership = membershipsList.find((m) => m.isDefault);
      return membershipTenantId(defaultMembership) ?? membershipTenantId(membershipsList[0]) ?? null;
    },
    []
  );

  const refreshAuth = useCallback(async () => {
    const res = await authService.getCurrentUser();
    const userData = res?.data?.data ?? res?.data ?? res;
    const m = normalizeMemberships(userData?.tenantMemberships ?? []);
    if (m.length > 0) {
      const token = await authService.getToken();
      const defaultTenantId =
        membershipTenantId(m.find((x) => x.isDefault)) ?? membershipTenantId(m[0]) ?? null;
      await authService.persistAuthPayload({
        user: userData,
        token: token ?? undefined,
        memberships: m,
        defaultTenantId,
      });
      setUser(userData);
      setMemberships(m as Membership[]);
      if (defaultTenantId) await setActiveTenantId(defaultTenantId);
    }
  }, [setActiveTenantId]);

  const refreshAuthRef = useRef(refreshAuth);
  refreshAuthRef.current = refreshAuth;

  /** Login/register return raw Tenant rows; /auth/me attaches effectiveFeatureFlags from the plan matrix. */
  const hydrateFeatureFlagsAfterAuth = useCallback(async () => {
    try {
      await refreshAuthRef.current();
    } catch (err) {
      logger.warn('AuthContext', '/auth/me feature-flag refresh failed', err);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setSessionSyncing(true);
    const res = await authService.login({ email, password });
    const payload = res?.data ?? res;
    const u = payload?.user ?? null;
    const m = normalizeMemberships(payload?.memberships ?? payload?.tenantMemberships ?? []) as Membership[];
    setUser(u);
    setMemberships(m);
    const tid =
      payload?.defaultTenantId ??
      membershipTenantId(m.find((x) => x.isDefault)) ??
      membershipTenantId(m[0]) ??
      null;
    if (tid) await setActiveTenantId(tid);
    try {
      await hydrateFeatureFlagsAfterAuth();
    } finally {
      setSessionSyncing(false);
    }
  }, [setActiveTenantId, hydrateFeatureFlagsAfterAuth]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setMemberships([]);
    setActiveTenantIdState(null);
    queryClient.clear();
  }, [queryClient]);

  const tenantSignup = useCallback(
    async (payload: { companyName?: string; companyEmail: string; adminName: string; adminEmail: string; password: string; plan?: string }) => {
      setSessionSyncing(true);
      const res = await authService.tenantSignup(payload);
      const data = res?.data ?? res;
      const u = data?.user ?? null;
      const m = normalizeMemberships(data?.memberships ?? data?.tenantMemberships ?? []) as Membership[];
      setUser(u);
      setMemberships(m);
      const tid =
        data?.defaultTenantId ??
        membershipTenantId(m.find((x) => x.isDefault)) ??
        membershipTenantId(m[0]) ??
        null;
      if (tid) await setActiveTenantId(tid);
      try {
        await hydrateFeatureFlagsAfterAuth();
      } finally {
        setSessionSyncing(false);
      }
    },
    [setActiveTenantId, hydrateFeatureFlagsAfterAuth]
  );

  const googleAuth = useCallback(
    async (idToken: string, options?: { signUp?: boolean; companyName?: string }) => {
      setSessionSyncing(true);
      const res = await authService.googleAuth(idToken, options ?? {});
      const data = res?.data ?? res;
      const u = data?.user ?? null;
      const m = normalizeMemberships(data?.memberships ?? data?.tenantMemberships ?? []) as Membership[];
      setUser(u);
      setMemberships(m);
      const tid =
        data?.defaultTenantId ??
        membershipTenantId(m.find((x) => x.isDefault)) ??
        membershipTenantId(m[0]) ??
        null;
      if (tid) await setActiveTenantId(tid);
      try {
        await hydrateFeatureFlagsAfterAuth();
      } finally {
        setSessionSyncing(false);
      }
    },
    [setActiveTenantId, hydrateFeatureFlagsAfterAuth]
  );

  const featureFlagsHydrateForTenantRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    logger.info('AuthContext', 'Initializing auth state');

    (async () => {
      try {
        const storedUser = await authService.getStoredUser();
        const storedMemberships = normalizeMemberships(
          await authService.getStoredMemberships()
        ) as Membership[];
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
        const isValidStoredTenant =
          storedTenantId &&
          storedMemberships?.some((m) => membershipTenantId(m) === storedTenantId);
        const preferredTenantId = isValidStoredTenant ? storedTenantId : null;
        const resolvedTenantId = resolveInitialTenant(storedMemberships ?? [], preferredTenantId);
        
        if (mounted && resolvedTenantId) {
          await authService.setActiveTenantId(resolvedTenantId);
          setActiveTenantIdState(resolvedTenantId);
          activeTenantIdRef.current = resolvedTenantId;
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
          storedMemberships?.find((m) => membershipTenantId(m) === resolvedTenantId) ??
          storedMemberships?.[0];
        const eff0 = activeMembershipForFlags?.tenant?.effectiveFeatureFlags;
        const flagsHydrated =
          eff0 != null &&
          typeof eff0 === 'object' &&
          !Array.isArray(eff0) &&
          Object.keys(eff0).length > 0;
        const onboardingCompleteOnCache = isOnboardingComplete(activeMembershipForFlags?.tenant);
        if (storedUser && (!storedMemberships?.length || !flagsHydrated || !onboardingCompleteOnCache)) {
          logger.info('AuthContext', 'Refetching /auth/me (stale session: memberships, flags, or onboarding)');
          try {
            const res = await authService.getCurrentUser();
            // Backend returns: { success: true, data: user } where user has tenantMemberships
            // Mobile API doesn't unwrap response.data, so we need response.data.data
            const user = res?.data?.data ?? res?.data ?? res;
            const m = normalizeMemberships(user?.tenantMemberships ?? []) as Membership[];
            if (mounted && m.length) {
              const defaultTenantId =
                membershipTenantId(m.find((x) => x.isDefault)) ?? membershipTenantId(m[0]) ?? null;
              setMemberships(m);
              await authService.persistAuthPayload({
                user,
                memberships: m,
                defaultTenantId,
              });
              if (defaultTenantId) await setActiveTenantIdRef.current(defaultTenantId);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; use refs for setters
  }, []);

  /** Warm backend tax config cache (used by POST /sales) before first POS checkout. */
  useEffect(() => {
    if (loading || !activeTenantId) return;
    settingsService.getOrganizationSettings().catch(() => {});
  }, [loading, activeTenantId]);

  /** Hydrate effectiveFeatureFlags when session has tenant but flags were never loaded (stale cache). */
  useEffect(() => {
    if (loading || !user || user.isPlatformAdmin || !activeTenantId) return;
    const m = memberships.find((x) => membershipTenantId(x) === activeTenantId);
    const eff = m?.tenant?.effectiveFeatureFlags;
    const looksHydrated =
      eff != null &&
      typeof eff === 'object' &&
      !Array.isArray(eff) &&
      Object.keys(eff).length > 0;
    if (looksHydrated) {
      featureFlagsHydrateForTenantRef.current = null;
      return;
    }
    if (featureFlagsHydrateForTenantRef.current === activeTenantId) return;
    featureFlagsHydrateForTenantRef.current = activeTenantId;
    logger.info('AuthContext', 'Hydrating missing feature flags via /auth/me');
    refreshAuthRef.current().catch(() => {
      /* Keep ref set to avoid retry loop; user can reload app. */
    });
  }, [loading, user, activeTenantId, memberships]);

  const value: AuthContextType = {
    user,
    memberships,
    activeTenantId,
    activeTenant,
    loading,
    sessionSyncing,
    wasInvited,
    suppressAppGuidance,
    tenantRole,
    isDriver,
    isAdmin,
    isManager,
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
