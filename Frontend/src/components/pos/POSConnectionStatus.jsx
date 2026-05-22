/**
 * POSConnectionStatus — online/offline indicator (web is online-only for sales).
 */
import { Wifi, WifiOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ONLINE_REQUIRED_MESSAGE } from '@/utils/onlineRequired';

/**
 * @param {Object} props
 * @param {boolean} props.isOnline
 * @param {string} [props.className]
 */
const POSConnectionStatus = ({ isOnline, className = '' }) => {
  const config = isOnline
    ? {
        icon: Wifi,
        label: 'Online',
        description: 'Connected',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      }
    : {
        icon: WifiOff,
        label: 'Offline',
        description: ONLINE_REQUIRED_MESSAGE,
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      };

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
            <Icon className={`h-4 w-4 ${config.textColor}`} />
            <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const POSConnectionStatusCompact = ({ isOnline }) => {
  if (!isOnline) {
    return <WifiOff className="h-4 w-4 text-red-600" />;
  }
  return <Wifi className="h-4 w-4 text-green-600" />;
};

export default POSConnectionStatus;
