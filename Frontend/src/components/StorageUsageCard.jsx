import { useState, useEffect } from 'react';
import { Cloud, Info, Rocket, Database, Loader2 } from 'lucide-react';
import inviteService from '../services/inviteService';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DashboardStatsCard from './DashboardStatsCard';

/**
 * Reusable component to display storage usage and limits
 */
function StorageUsageCard({ style, showUpgradeButton = true }) {
  const { activeTenantId } = useAuth();
  const [storageUsage, setStorageUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenantId) {
      setLoading(false);
      return;
    }
    const fetchStorageUsage = async () => {
      try {
        setLoading(true);
        const response = await inviteService.getStorageUsage();
        if (response?.success) {
          setStorageUsage(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch storage usage:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorageUsage();
  }, [activeTenantId]);

  if (loading) {
    return (
      <Card style={style}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Storage Usage
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

  if (!storageUsage) {
    return null;
  }

  const {
    currentGB,
    limitGB,
    remainingGB,
    percentageUsed,
    isUnlimited,
    isNearLimit,
    isAtLimit,
    canUploadMore,
    planName,
    price100GB
  } = storageUsage;

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
            <Cloud className="h-4 w-4" />
            Storage Usage
            {planName && (
              <Badge variant="secondary" className="ml-2 border-0">
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
            <Cloud className="h-4 w-4" />
            <AlertTitle>Unlimited Storage</AlertTitle>
            <AlertDescription>
              Your {planName} plan includes unlimited file storage.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <DashboardStatsCard
                title="Used"
                value={parseFloat(currentGB || 0).toFixed(2)}
                suffix=" GB"
                prefix={<Database className="h-4 w-4 inline mr-1" />}
                className={isAtLimit ? 'text-red-600' : 'text-green-600'}
              />
              <DashboardStatsCard
                title="Total Limit"
                value={limitGB}
                suffix=" GB"
              />
              <DashboardStatsCard
                title="Available"
                value={parseFloat(remainingGB || 0).toFixed(2)}
                suffix=" GB"
                className={parseFloat(remainingGB || 0) > 0 ? 'text-green-600' : 'text-red-600'}
              />
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-2 text-sm">
                <span>Storage Usage</span>
                <span>
                  <strong>{currentGB} GB</strong> of <strong>{limitGB} GB</strong> ({percentageUsed}%)
                </span>
              </div>
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full w-full flex-1 transition-all"
                  style={{ 
                    transform: `translateX(-${100 - (parseFloat(percentageUsed) || 0)}%)`,
                    backgroundColor: getProgressColor()
                  }}
                />
              </div>
            </div>

            {isAtLimit && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Storage Limit Reached</AlertTitle>
                <AlertDescription>
                  {price100GB ? (
                    <span>
                      You've used {currentGB} GB of your {limitGB} GB limit. 
                      Add more storage for <strong>₵ {price100GB} per 100GB</strong> or upgrade your plan.
                    </span>
                  ) : (
                    <span>
                      You've used {currentGB} GB of your {limitGB} GB limit. 
                      Please upgrade your plan for more storage.
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
                <AlertTitle>Storage Running Low</AlertTitle>
                <AlertDescription>
                  Only {remainingGB} GB remaining ({100 - (parseFloat(percentageUsed) || 0)}% available). Consider upgrading soon.
                </AlertDescription>
              </Alert>
            )}

            {price100GB && canUploadMore && (
              <div className="p-3 bg-blue-50 rounded-md mt-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4 text-brand" />
                        <span>
                          Need more storage? Add 100GB for <strong>₵ {price100GB}</strong>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add storage beyond your base limit</p>
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

export default StorageUsageCard;
