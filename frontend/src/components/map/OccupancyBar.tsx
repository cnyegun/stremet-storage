import { cn } from '@/lib/utils';
import { getOccupancyPalette, getOccupancyRatio } from './utils';

interface OccupancyBarProps {
  used: number;
  total: number;
  label?: string;
  compact?: boolean;
}

export function OccupancyBar({ used, total, label, compact = false }: OccupancyBarProps) {
  const ratio = getOccupancyRatio(used, total);
  const palette = getOccupancyPalette(used, total);

  return (
    <div className={cn('grid', compact ? 'gap-1' : 'gap-1.5')}>
      <div className={cn('flex justify-between text-app-textMuted', compact ? 'text-[11px]' : 'text-xs')}>
        <span>{label ?? 'Occupancy'}</span>
        <span>{used}/{total}</span>
      </div>
      <div className={cn('overflow-hidden border border-app-border bg-app-panelMuted', compact ? 'h-1.5' : 'h-2')}>
        <div
          className="h-full transition-[width] duration-150 ease-out"
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%`, background: palette.border }}
        />
      </div>
    </div>
  );
}
