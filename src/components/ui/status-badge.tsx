import { cn } from "@/lib/utils";

type StatusType = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'generated' 
  | 'printed' 
  | 'delivered'
  | 'draft'
  | 'active'
  | 'archived'
  | 'assigned'
  | 'received'
  | 'printing';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showPulse?: boolean;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-success/10 text-success border-success/20',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  generated: {
    label: 'Generated',
    className: 'bg-info/10 text-info border-info/20',
  },
  printed: {
    label: 'Printed',
    className: 'bg-success/10 text-success border-success/20',
  },
  delivered: {
    label: 'Delivered',
    className: 'bg-success/10 text-success border-success/20',
  },
  draft: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
  },
  active: {
    label: 'Active',
    className: 'bg-success/10 text-success border-success/20',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
  },
  assigned: {
    label: 'Assigned',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  received: {
    label: 'Received',
    className: 'bg-info/10 text-info border-info/20',
  },
  printing: {
    label: 'Printing',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
};

export function StatusBadge({ status, className, showPulse = false }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        config.className,
        showPulse && 'status-pulse',
        className
      )}
    >
      {config.label}
    </span>
  );
}
