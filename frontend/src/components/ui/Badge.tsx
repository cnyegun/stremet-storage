import { cn, toTitleCase } from '@/lib/utils';

type BadgeProps = {
  children: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide',
        variant === 'default' && 'border-app-border bg-app-panelMuted text-app-textMuted',
        variant === 'primary' && 'border-blue-300 bg-blue-100 text-app-primary',
        variant === 'success' && 'border-green-300 bg-green-100 text-app-success',
        variant === 'warning' && 'border-amber-300 bg-amber-100 text-app-warning',
        variant === 'danger' && 'border-red-300 bg-red-100 text-app-danger',
        className,
      )}
    >
      {toTitleCase(children)}
    </span>
  );
}
