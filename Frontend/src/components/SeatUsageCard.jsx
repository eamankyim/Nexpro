import { useState, useEffect } from 'react';
import { Users, Info, Rocket, Loader2 } from 'lucide-react';
import inviteService from '../services/inviteService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatisticCard } from '@/components/ui/statistic-card';

/**
 * Reusable component to display seat usage and limits
 */
function SeatUsageCard({ style, size = 'default', showUpgradeButton = true }) {
  const [seatUsage, setSeatUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeatUsage = async () => {
      try {
        setLoading(true);
        const response = await inviteService.getSeatUsage();
        if (response?.success) {
          setSeatUsage(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch seat usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeatUsage();
  }, []);

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

  return (
    <Card style={style}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Seats
            {planName && (
              <Badge className="ml-2" style={{ backgroundColor: '#166534' }}>
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
              <StatisticCard
                title="Active Users"
                value={current}
                prefix={<Users className="h-4 w-4 inline mr-1" />}
                className={isAtLimit ? 'text-red-600' : 'text-green-600'}
              />
              <StatisticCard
                title="Total Seats"
                value={limit}
                suffix=" seats"
              />
              <StatisticCard
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
                      Add more seats for <strong>GHS {pricePerAdditional}</strong> per user or upgrade your plan.
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
                    <Button size="sm">
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
                        <Info className="h-4 w-4 text-[#166534]" />
                        <span>
                          Need more seats? Add them for <strong>GHS {pricePerAdditional}</strong> per user
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
