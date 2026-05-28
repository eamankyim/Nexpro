import { useState, useEffect } from 'react';
import { Users, Info, Rocket, Loader2 } from 'lucide-react';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardStatsCard from './DashboardStatsCard';

/**
 * Reusable component to display seat usage and limits
 */
function SeatUsageCard({
  style,
  size = 'default',
  showUpgradeButton = true,
  className = '',
  seatUsage: seatUsageProp,
  loading: loadingProp,
  onUpgradePlan,
}) {
  const { activeTenantId } = useAuth();
  const [seatUsageInternal, setSeatUsageInternal] = useState(null);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const isControlled = seatUsageProp !== undefined;
  const seatUsage = isControlled ? seatUsageProp : seatUsageInternal;
  const loading = isControlled ? Boolean(loadingProp) : loadingInternal;

  useEffect(() => {
    if (isControlled || !activeTenantId) {
      if (!isControlled && !activeTenantId) {
        setLoadingInternal(false);
      }
      return;
    }
    const fetchSeatUsage = async () => {
      try {
        setLoadingInternal(true);
        const response = await inviteService.getSeatUsage();
        if (response?.success) {
          setSeatUsageInternal(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch seat usage:', error);
      } finally {
        setLoadingInternal(false);
      }
    };

    fetchSeatUsage();
  }, [activeTenantId, isControlled]);

  if (loading) {
    return (
      <Card style={style}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Seats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!seatUsage) {
    return null;
  }

  const {
    current,
    limit,
    remaining,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canAddMore,
    planName,
    pricePerAdditional
  } = seatUsage;

  // Determine progress bar color
  const getProgressColor = () => {
    if (isUnlimited) return '#22c55e';
    if (isAtLimit) return '#ef4444';
    if (isNearLimit) return '#eab308';
    return '#22c55e';
  };

  if (size === 'wide') {
    return (
      <Card style={style} className={`w-full border bg-card ${className}`}>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col xl:flex-row xl:items-center gap-6">
            <div className="flex items-center gap-4 min-w-[240px]">
              <div className="h-20 w-20 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                <Users className="h-10 w-10 text-brand" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Team Seats</h3>
                  {planName && (
                    <Badge className="bg-green-50 text-brand hover:bg-green-50 border border-green-100">
                      {planName} Plan
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Seat limits are enforced by your current plan.
                </p>
              </div>
            </div>

            {isUnlimited ? (
              <Alert className="flex-1">
                <Users className="h-4 w-4" />
                <AlertTitle>Unlimited Seats</AlertTitle>
                <AlertDescription>
                  You can invite as many team members as needed on your {planName} plan.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                  <div className="border-l border-border pl-4">
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">{current}</p>
                    <p className="text-xs text-muted-foreground">of {limit} seat{limit === 1 ? '' : 's'}</p>
                  </div>
                  <div className="border-l border-border pl-4">
                    <p className="text-sm text-muted-foreground">Total Seats</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">{limit}</p>
                    <p className="text-xs text-muted-foreground">seat{limit === 1 ? '' : 's'}</p>
                  </div>
                  <div className="border-l border-border pl-4">
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-semibold text-foreground mt-2">{remaining}</p>
                    <p className="text-xs text-muted-foreground">seat{remaining === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <div className="w-full xl:max-w-xs">
                  <div className="flex justify-between mb-2 text-sm font-medium">
                    <span>Seat Usage</span>
                    <span>{percentageUsed}%</span>
                  </div>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${Math.min(percentageUsed || 0, 100)}%`,
                        backgroundColor: getProgressColor(),
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {isAtLimit && !isUnlimited && (
            <Alert variant="destructive" className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <AlertTitle>Seat Limit Reached</AlertTitle>
                <AlertDescription>
                  You&apos;ve reached your {limit}-seat limit. Please upgrade your plan to add more team members.
                </AlertDescription>
              </div>
              {showUpgradeButton && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-destructive/30"
                  onClick={onUpgradePlan}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Button>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={style} className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Seats
            {planName && (
              <Badge className="ml-2 bg-brand text-primary-foreground hover:bg-brand-dark border-0">
                {planName} Plan
              </Badge>
            )}
          </CardTitle>
          {isUnlimited && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Unlimited
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isUnlimited ? (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertTitle>Unlimited Seats</AlertTitle>
            <AlertDescription>
              You can invite as many team members as needed on your {planName} plan.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <DashboardStatsCard
                title="Active Users"
                value={current}
                prefix={<Users className="h-4 w-4 inline mr-1" />}
                className={isAtLimit ? 'text-red-600' : 'text-green-600'}
              />
              <DashboardStatsCard
                title="Total Seats"
                value={limit}
                suffix=" seats"
              />
              <DashboardStatsCard
                title="Available"
                value={remaining}
                suffix=" seats"
                className={remaining > 0 ? 'text-green-600' : 'text-red-600'}
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2 text-sm">
                <span>Seat Usage</span>
                <span>
                  <strong>{current}</strong> of <strong>{limit}</strong> ({percentageUsed}%)
                </span>
              </div>
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full w-full flex-1 transition-all"
                  style={{ 
                    transform: `translateX(-${100 - (percentageUsed || 0)}%)`,
                    backgroundColor: getProgressColor()
                  }}
                />
              </div>
            </div>

            {isAtLimit && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Seat Limit Reached</AlertTitle>
                <AlertDescription>
                  {pricePerAdditional ? (
                    <span>
                      You've reached your {limit}-seat limit. 
                      Add more seats for <strong>₵ {pricePerAdditional}</strong> per user or upgrade your plan.
                    </span>
                  ) : (
                    <span>
                      You've reached your {limit}-seat limit. 
                      Please upgrade your plan to add more team members.
                    </span>
                  )}
                </AlertDescription>
                {showUpgradeButton && (
                  <div className="mt-4">
                    <Button type="button" size="sm" onClick={onUpgradePlan}>
                      <Rocket className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  </div>
                )}
              </Alert>
            )}

            {isNearLimit && !isAtLimit && (
              <Alert className="mb-4">
                <AlertTitle>Running Low on Seats</AlertTitle>
                <AlertDescription>
                  Only {remaining} seat{remaining > 1 ? 's' : ''} remaining. Consider upgrading soon.
                </AlertDescription>
              </Alert>
            )}

            {pricePerAdditional && canAddMore && (
              <div className="p-3 bg-blue-50 rounded-md mt-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4 text-brand" />
                        <span>
                          Need more seats? Add them for <strong>₵ {pricePerAdditional}</strong> per user
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add seats beyond your base limit</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SeatUsageCard;
