import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PanelLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import settingsService from '@/services/settingsService';
import { showError, showSuccess } from '@/utils/toast';
import {
  SIDEBAR_MENU_GROUPS,
  filterHiddenSidebarKeysForTenant,
  filterSidebarMenuGroupsForBusinessType,
} from '@/constants/sidebarMenus';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';

/**
 * Settings card for choosing which optional sidebar menus to show.
 */
export default function SidebarMenusSettings() {
  const { activeTenant, isManager, isAdmin, isDriver, isPlatformAdmin, hasFeature } = useAuth();
  const isManagerOrAdmin = isManager || isAdmin;
  const queryClient = useQueryClient();
  const { hiddenSidebarKeys, isLoading } = useSidebarPreferences();
  const [draftHiddenKeys, setDraftHiddenKeys] = useState([]);
  const [initialized, setInitialized] = useState(false);

  const businessType = activeTenant?.businessType || null;
  const shopType =
    activeTenant?.metadata?.businessSubType ||
    activeTenant?.metadata?.shopType ||
    null;

  const sidebarFilterCtx = useMemo(
    () => ({
      businessType,
      shopType,
      hasFeature,
      isPlatformAdmin,
      isManagerOrAdmin,
    }),
    [businessType, hasFeature, isManagerOrAdmin, isPlatformAdmin, shopType]
  );

  useEffect(() => {
    if (!isLoading) {
      setDraftHiddenKeys(filterHiddenSidebarKeysForTenant(hiddenSidebarKeys, sidebarFilterCtx));
      setInitialized(true);
    }
  }, [hiddenSidebarKeys, isLoading, sidebarFilterCtx]);

  const visibleGroups = useMemo(() => {
    if (isDriver) return [];
    return filterSidebarMenuGroupsForBusinessType(SIDEBAR_MENU_GROUPS, sidebarFilterCtx);
  }, [isDriver, sidebarFilterCtx]);

  const updateMutation = useMutation({
    mutationFn: (keys) => settingsService.updateSidebarPreferences({ hiddenSidebarKeys: keys }),
    onSuccess: (data) => {
      const nextKeys = filterHiddenSidebarKeysForTenant(
        data?.hiddenSidebarKeys ?? [],
        sidebarFilterCtx
      );
      setDraftHiddenKeys(nextKeys);
      queryClient.setQueryData(
        ['settings', 'sidebar-preferences', activeTenant?.id],
        nextKeys
      );
      showSuccess('Sidebar menu preferences saved');
    },
    onError: (error) => {
      showError(error, 'Failed to save sidebar menu preferences');
    },
  });

  const handleToggle = useCallback((key, visible) => {
    setDraftHiddenKeys((prev) => {
      const next = new Set(prev);
      if (visible) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return Array.from(next);
    });
  }, []);

  const handleReset = useCallback(() => {
    setDraftHiddenKeys([]);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(filterHiddenSidebarKeysForTenant(draftHiddenKeys, sidebarFilterCtx));
  }, [draftHiddenKeys, sidebarFilterCtx, updateMutation]);

  const hasChanges = useMemo(() => {
    if (!initialized) return false;
    const current = filterHiddenSidebarKeysForTenant(hiddenSidebarKeys, sidebarFilterCtx)
      .sort()
      .join('|');
    const draft = [...draftHiddenKeys].sort().join('|');
    return current !== draft;
  }, [draftHiddenKeys, hiddenSidebarKeys, initialized, sidebarFilterCtx]);

  if (isDriver || (isPlatformAdmin && visibleGroups.length === 0)) {
    return null;
  }

  return (
    <Card className="border-0 shadow-none bg-transparent md:border md:bg-card">
      <CardHeader className="p-0 md:p-6 pb-2 md:pb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <CardTitle className="text-base md:text-2xl flex items-center gap-2">
              <PanelLeft className="h-5 w-5 text-muted-foreground shrink-0" />
              Sidebar menus
            </CardTitle>
            <CardDescription className="mt-1 md:mt-0 text-xs md:text-sm">
              Choose which optional menus appear in your sidebar for this workspace. Hidden pages stay
              reachable by URL or search.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              type="button"
              variant="secondaryStroke"
              disabled={isLoading || updateMutation.isPending || draftHiddenKeys.length === 0}
              onClick={handleReset}
            >
              Reset to defaults
            </Button>
            <Button
              type="button"
              disabled={isLoading || !hasChanges || updateMutation.isPending}
              onClick={handleSave}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Save preferences'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-6 pt-0 space-y-4 md:space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sidebar preferences…
          </p>
        ) : (
          visibleGroups.map((group, index) => (
            <div key={group.id}>
              {index > 0 ? <Separator className="mb-4 md:mb-6" /> : null}
              <h3 className="text-sm font-medium mb-3">{group.label}</h3>
              <div className="space-y-3">
                {group.items.map((item) => {
                  const visible = !draftHiddenKeys.includes(item.key);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 py-1"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{item.label}</p>
                        {item.description ? (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        ) : null}
                      </div>
                      <Switch
                        checked={visible}
                        disabled={updateMutation.isPending}
                        onCheckedChange={(checked) => handleToggle(item.key, checked)}
                        aria-label={`Show ${item.label} in sidebar`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
