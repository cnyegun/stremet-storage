'use client';

import { cn } from '@/lib/utils';

interface MapToggleProps {
  value: 'floor' | 'grid';
  onChange: (value: 'floor' | 'grid') => void;
}

export function MapToggle({ value, onChange }: MapToggleProps) {
  const options = [
    { key: 'floor' as const, label: 'Floor plan' },
    { key: 'grid' as const, label: 'Grid view' },
  ];

  return (
    <div className="inline-flex border border-app-border bg-white">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              'min-h-11 px-4 text-sm font-medium transition-colors',
              option.key === 'floor' && 'border-r border-app-border',
              active ? 'bg-app-primary text-white' : 'bg-white text-app-text hover:bg-app-panelMuted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
