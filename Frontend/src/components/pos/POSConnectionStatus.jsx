/**
 * POSConnectionStatus Component
 * 
 * Visual indicator for online/offline status.
 * Shows pending sales count when offline.
 */

import { Wifi, WifiOff, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Connection status indicator
 * @param {Object} props
 * @param {boolean} props.isOnline - Whether the device is online
 * @param {number} props.pendingCount - Number of pending offline sales
 * @param {boolean} props.isSyncing - Whether sync is in progress
 * @param {string} [props.lastSyncError] - Last sync error message
 * @param {string} [props.className] - Additional CSS classes
 */
const POSConnectionStatus = ({ 
  isOnline, 
  pendingCount = 0, 
  isSyncing = false,
  lastSyncError = null,
  className = ''
}) => {
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        description: pendingCount > 0 
          ? `${pendingCount} sale${pendingCount > 1 ? 's' : ''} pending sync`
          : 'Sales will be saved locally',
        variant: 'destructive',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      };
    }

    if (isSyncing) {
      return {
        icon: Loader2,
        label: 'Syncing',
        description: 'Uploading offline sales...',
        variant: 'secondary',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        iconClassName: 'animate-spin'
      };
    }

    if (lastSyncError) {
      return {
        icon: CloudOff,
        label: 'Sync Error',
        description: lastSyncError,
        variant: 'warning',
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      };
    }

    if (pendingCount > 0) {
      return {
        icon: Cloud,
        label: 'Online',
        description: `${pendingCount} sale${pendingCount > 1 ? 's' : ''} waiting to sync`,
        variant: 'secondary',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200'
      };
    }

    return {
      icon: Wifi,
      label: 'Online',
      description: 'All sales synced',
      variant: 'outline',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200'
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full border
              ${config.bgColor} ${config.borderColor}
              ${className}
            `}
          >
            <Icon className={`h-4 w-4 ${config.textColor} ${config.iconClassName || ''}`} />
            <span className={`text-sm font-medium ${config.textColor}`}>
              {config.label}
            </span>
            {pendingCount > 0 && !isSyncing && (
              <Badge 
                variant="secondary" 
                className={`ml-1 h-5 min-w-5 flex items-center justify-center ${
                  isOnline ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {pendingCount}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Compact version for header use
 */
export const POSConnectionStatusCompact = ({ isOnline, pendingCount = 0, isSyncing = false }) => {
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-red-600">
        <WifiOff className="h-4 w-4" />
        {pendingCount > 0 && (
          <Badge variant="destructive" className="h-5 px-1.5 text-xs">
            {pendingCount}
          </Badge>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-blue-600">
        <Cloud className="h-4 w-4" />
        <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-blue-100">
          {pendingCount}
        </Badge>
      </div>
    );
  }

  return <Wifi className="h-4 w-4 text-green-600" />;
};

export default POSConnectionStatus;
