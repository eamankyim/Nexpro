import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * StatusChip - A consistent status indicator component used throughout the app
 * 
 * Maps all status values to consistent colors and styling:
 * - in_progress/inprogress: Blue
 * - completed/paid/approved: Green
 * - pending/pending_approval: Orange
 * - cancelled/lost/terminated: Red
 * - new/draft: Yellow/Gold
 * - on_hold/overdue: Orange
 * - sent/contacted/qualified: Gray/Blue
 * - converted: Green
 * - active: Green
 * - partial: Orange
 * - processing: Blue
 * - posted: Green
 */
const StatusChip = ({ status, className, ...props }) => {
  if (!status) return null;

  // Normalize status to lowercase and handle variations
  const normalizedStatus = String(status).toLowerCase().trim();
  
  // Map status to consistent color classes
  const getStatusClasses = (status) => {
    // In Progress / Active work statuses
    if (status === 'in_progress' || status === 'inprogress' || status === 'processing' || status === 'active') {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    
    // Completed / Success statuses
    if (status === 'completed' || status === 'paid' || status === 'approved' || status === 'converted' || status === 'posted' || status === 'accepted') {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    
    // Pending / Waiting statuses
    if (status === 'pending' || status === 'pending_approval' || status === 'on_hold' || status === 'partial' || status === 'overdue') {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    
    // Cancelled / Failed / Lost statuses
    if (status === 'cancelled' || status === 'lost' || status === 'terminated' || status === 'declined' || status === 'expired') {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    
    // New / Draft statuses
    if (status === 'new' || status === 'draft') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    
    // Sent / In Progress communication statuses
    if (status === 'sent' || status === 'contacted' || status === 'qualified') {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    
    // On Leave / Probation statuses
    if (status === 'on_leave' || status === 'probation') {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    
    // Stock statuses
    if (status === 'in_stock' || status === 'instock') {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (status === 'low_stock' || status === 'lowstock') {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    if (status === 'out_of_stock' || status === 'outofstock') {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    
    // Default fallback
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Format status text for display
  const formatStatusText = (status) => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'px-2.5 py-0.5 text-xs font-semibold border',
        getStatusClasses(normalizedStatus),
        className
      )}
      {...props}
    >
      {formatStatusText(normalizedStatus).toUpperCase()}
    </Badge>
  );
};

export default StatusChip;
